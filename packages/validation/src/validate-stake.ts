/**
 * Validates subgraph ServiceProvider.tokensStaked against on-chain HorizonStaking.getStake()
 *
 * Usage: npx tsx scripts/validate-stake.ts <subgraph-url>
 *
 * Example:
 *   npx tsx scripts/validate-stake.ts https://api.studio.thegraph.com/query/xxx/graph-horizon-network/version/latest
 */

const RPC_URL = process.env.RPC_URL || "https://arb1.arbitrum.io/rpc"
const STAKING_ADDRESS = "0x00669A4CF01450B64E8A2A20E9b1FCB71E61eF03"

// getStake(address) selector = keccak256("getStake(address)")[:4]
const GET_STAKE_SELECTOR = "0x7a766460"

interface ServiceProvider {
  id: string
  tokensStaked: string
}

interface GraphNetwork {
  id: string
  tokensStaked: string
  countServiceProviders: number
}

async function querySubgraph<T>(url: string, query: string): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  })
  const json = await response.json()
  if (json.errors) {
    throw new Error(`Subgraph error: ${JSON.stringify(json.errors)}`)
  }
  return json.data
}

async function getStakeOnChain(address: string): Promise<bigint> {
  // Encode call data: selector + address padded to 32 bytes
  const paddedAddress = address.toLowerCase().replace("0x", "").padStart(64, "0")
  const callData = GET_STAKE_SELECTOR + paddedAddress

  const response = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: STAKING_ADDRESS, data: callData }, "latest"],
    }),
  })
  const json = await response.json()
  if (json.error) {
    throw new Error(`RPC error: ${JSON.stringify(json.error)}`)
  }
  return BigInt(json.result)
}

async function main() {
  const subgraphUrl = process.argv[2]
  if (!subgraphUrl) {
    console.error("Usage: npx tsx scripts/validate-stake.ts <subgraph-url>")
    process.exit(1)
  }

  console.log("Subgraph URL:", subgraphUrl)
  console.log("RPC URL:", RPC_URL)
  console.log("Staking contract:", STAKING_ADDRESS)
  console.log("")

  // Fetch GraphNetwork
  const networkData = await querySubgraph<{ graphNetwork: GraphNetwork }>(
    subgraphUrl,
    `{ graphNetwork(id: "0x01") { id tokensStaked countServiceProviders } }`
  )
  const graphNetwork = networkData.graphNetwork

  if (!graphNetwork) {
    console.error("GraphNetwork entity not found")
    process.exit(1)
  }

  console.log("=== GraphNetwork ===")
  console.log(`  countServiceProviders: ${graphNetwork.countServiceProviders}`)
  console.log(`  tokensStaked: ${graphNetwork.tokensStaked}`)
  console.log("")

  // Fetch all ServiceProviders
  console.log("=== Fetching ServiceProviders ===")
  const spData = await querySubgraph<{ serviceProviders: ServiceProvider[] }>(
    subgraphUrl,
    `{ serviceProviders(first: 1000, orderBy: tokensStaked, orderDirection: desc) { id tokensStaked } }`
  )
  const serviceProviders = spData.serviceProviders

  console.log(`  Found ${serviceProviders.length} service providers`)
  console.log("")

  // Validate count
  if (serviceProviders.length !== graphNetwork.countServiceProviders) {
    console.log(`WARNING: SP count mismatch - GraphNetwork says ${graphNetwork.countServiceProviders}, found ${serviceProviders.length}`)
  }

  // Validate sum
  const subgraphSum = serviceProviders.reduce((sum, sp) => sum + BigInt(sp.tokensStaked), 0n)
  if (subgraphSum.toString() !== graphNetwork.tokensStaked) {
    console.log(`WARNING: tokensStaked sum mismatch`)
    console.log(`  GraphNetwork.tokensStaked: ${graphNetwork.tokensStaked}`)
    console.log(`  Sum of SP stakes:          ${subgraphSum.toString()}`)
    console.log("")
  }

  // Compare each SP against on-chain
  console.log("=== Comparing against on-chain state ===")
  let mismatches = 0
  let matches = 0

  for (const sp of serviceProviders) {
    const onChainStake = await getStakeOnChain(sp.id)
    const subgraphStake = BigInt(sp.tokensStaked)

    if (onChainStake !== subgraphStake) {
      mismatches++
      const diff = onChainStake - subgraphStake
      console.log(`MISMATCH: ${sp.id}`)
      console.log(`  subgraph: ${subgraphStake.toString()}`)
      console.log(`  on-chain: ${onChainStake.toString()}`)
      console.log(`  diff:     ${diff.toString()} (${diff > 0 ? "chain higher" : "subgraph higher"})`)
      console.log("")
    } else {
      matches++
    }

    // Rate limiting - small delay between RPC calls
    await new Promise((resolve) => setTimeout(resolve, 50))
  }

  // Summary
  console.log("=== Summary ===")
  console.log(`  Total SPs:   ${serviceProviders.length}`)
  console.log(`  Matches:     ${matches}`)
  console.log(`  Mismatches:  ${mismatches}`)

  if (mismatches === 0) {
    console.log("")
    console.log("All service provider stakes match on-chain state!")
  }

  process.exit(mismatches > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
