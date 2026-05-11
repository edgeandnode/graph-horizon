/**
 * Validates subgraph ServiceProvider.tokensStaked against on-chain HorizonStaking.getStake()
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:stake <subgraph-url>
 */

import { getConfig } from "./config"
import { getStake } from "./onchain"

const config = getConfig()

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

// Format token amount with 18 decimals as GRT
function formatGRT(wei: bigint): string {
  const decimals = 18n
  const divisor = 10n ** decimals
  const whole = wei / divisor
  const fraction = wei % divisor
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 4)
  return `${whole.toLocaleString()}.${fractionStr} GRT`
}

async function main() {
  const subgraphUrl = process.argv[2]
  if (!subgraphUrl) {
    console.error("Usage: npx tsx scripts/validate-stake.ts <subgraph-url>")
    process.exit(1)
  }

  console.log("Subgraph URL:", subgraphUrl)
  console.log("RPC URL:", config.rpcUrl)
  console.log("Staking contract:", config.stakingAddress)
  console.log("")

  // Fetch GraphNetwork
  const networkData = await querySubgraph<{ graphNetwork: GraphNetwork }>(
    subgraphUrl,
    `{ graphNetwork(id: "0x01000000") { id tokensStaked countServiceProviders } }`
  )
  const graphNetwork = networkData.graphNetwork

  if (!graphNetwork) {
    console.error("GraphNetwork entity not found")
    process.exit(1)
  }

  console.log("=== GraphNetwork ===")
  console.log(`  countServiceProviders: ${graphNetwork.countServiceProviders}`)
  console.log(`  tokensStaked: ${formatGRT(BigInt(graphNetwork.tokensStaked))}`)
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
    console.log(`  GraphNetwork.tokensStaked: ${formatGRT(BigInt(graphNetwork.tokensStaked))}`)
    console.log(`  Sum of SP stakes:          ${formatGRT(subgraphSum)}`)
    console.log("")
  }

  // Compare each SP against on-chain
  console.log("=== Comparing against on-chain state ===")
  let mismatches = 0
  let matches = 0

  for (const sp of serviceProviders) {
    const onChainStake = await getStake(sp.id)
    const subgraphStake = BigInt(sp.tokensStaked)

    if (onChainStake !== subgraphStake) {
      mismatches++
      const diff = onChainStake - subgraphStake
      console.log(`MISMATCH: ${sp.id}`)
      console.log(`  subgraph: ${formatGRT(subgraphStake)}`)
      console.log(`  on-chain: ${formatGRT(onChainStake)}`)
      console.log(`  diff:     ${formatGRT(diff > 0n ? diff : -diff)} (${diff > 0n ? "chain higher" : "subgraph higher"})`)
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
