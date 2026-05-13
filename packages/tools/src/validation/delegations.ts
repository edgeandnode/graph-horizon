/**
 * Validates subgraph DelegationPool entities against on-chain HorizonStaking.getDelegationPool()
 * Also validates ServiceProvider.tokensDelegated and GraphNetwork.tokensDelegated.
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:delegations <subgraph-url>
 */

import { getDelegationPool } from "../onchain"
import { querySubgraph, formatGRT, getSubgraphUrlFromArgs, printHeader, delay } from "../common"

interface SubgraphDelegationPool {
  id: string
  serviceProvider: { id: string }
  verifier: string
  tokens: string
  shares: string
  tokensThawing: string
}

interface SubgraphServiceProvider {
  id: string
  tokensDelegated: string
}

interface GraphNetwork {
  id: string
  tokensDelegated: string
  countDelegationPools: number
}

function compareField(
  name: string,
  subgraphValue: bigint,
  onChainValue: bigint,
  isTokens = false
): { match: boolean; message?: string } {
  if (subgraphValue === onChainValue) {
    return { match: true }
  }
  const subgraphStr = isTokens ? formatGRT(subgraphValue) : subgraphValue.toString()
  const onChainStr = isTokens ? formatGRT(onChainValue) : onChainValue.toString()
  return {
    match: false,
    message: `  ${name}: subgraph=${subgraphStr}, chain=${onChainStr}`,
  }
}

async function main() {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl)

  // Fetch GraphNetwork
  const networkData = await querySubgraph<{ graphNetwork: GraphNetwork }>(
    subgraphUrl,
    `{ graphNetwork(id: "0x01000000") { id tokensDelegated countDelegationPools } }`
  )
  const graphNetwork = networkData.graphNetwork

  if (!graphNetwork) {
    console.error("GraphNetwork entity not found")
    process.exit(1)
  }

  console.log("=== GraphNetwork ===")
  console.log(`  countDelegationPools: ${graphNetwork.countDelegationPools}`)
  console.log(`  tokensDelegated: ${formatGRT(BigInt(graphNetwork.tokensDelegated))}`)
  console.log("")

  // Fetch all DelegationPools
  console.log("=== Fetching DelegationPools ===")
  const poolData = await querySubgraph<{ delegationPools: SubgraphDelegationPool[] }>(
    subgraphUrl,
    `{ delegationPools(first: 1000, orderBy: tokens, orderDirection: desc) {
      id
      serviceProvider { id }
      verifier
      tokens
      shares
      tokensThawing
    } }`
  )
  const pools = poolData.delegationPools

  console.log(`  Found ${pools.length} delegation pools`)
  console.log("")

  // Validate count
  if (pools.length !== graphNetwork.countDelegationPools) {
    console.log(
      `WARNING: Pool count mismatch - GraphNetwork says ${graphNetwork.countDelegationPools}, found ${pools.length}`
    )
    console.log("")
  }

  // Validate sum of tokens
  const subgraphSum = pools.reduce((sum, p) => sum + BigInt(p.tokens), 0n)
  if (subgraphSum.toString() !== graphNetwork.tokensDelegated) {
    console.log(`WARNING: tokensDelegated sum mismatch`)
    console.log(`  GraphNetwork.tokensDelegated: ${formatGRT(BigInt(graphNetwork.tokensDelegated))}`)
    console.log(`  Sum of pool tokens:           ${formatGRT(subgraphSum)}`)
    console.log("")
  }

  // Compare each DelegationPool against on-chain
  console.log("=== Comparing DelegationPools against on-chain state ===")
  let poolMismatches = 0
  let poolMatches = 0

  for (const pool of pools) {
    const onChain = await getDelegationPool(pool.serviceProvider.id, pool.verifier)

    const fields = [
      compareField("tokens", BigInt(pool.tokens), onChain.tokens, true),
      compareField("shares", BigInt(pool.shares), onChain.shares),
      compareField("tokensThawing", BigInt(pool.tokensThawing), onChain.tokensThawing, true),
    ]

    const mismatches = fields.filter((f) => !f.match)
    if (mismatches.length > 0) {
      poolMismatches++
      console.log(`MISMATCH: ${pool.serviceProvider.id} -> ${pool.verifier}`)
      for (const m of mismatches) {
        console.log(m.message)
      }
      console.log("")
    } else {
      poolMatches++
    }

    await delay()
  }

  // Fetch and validate ServiceProviders
  console.log("=== Validating ServiceProvider.tokensDelegated ===")
  const spData = await querySubgraph<{ serviceProviders: SubgraphServiceProvider[] }>(
    subgraphUrl,
    `{ serviceProviders(first: 1000, where: { tokensDelegated_gt: "0" }) { id tokensDelegated } }`
  )
  const serviceProviders = spData.serviceProviders

  console.log(`  Found ${serviceProviders.length} service providers with delegations`)
  console.log("")

  let spMismatches = 0
  let spMatches = 0

  for (const sp of serviceProviders) {
    // Sum up all delegation pools for this SP
    const spPools = pools.filter((p) => p.serviceProvider.id === sp.id)
    const onChainSum = await Promise.all(
      spPools.map(async (p) => {
        const onChain = await getDelegationPool(p.serviceProvider.id, p.verifier)
        await delay()
        return onChain.tokens
      })
    ).then((tokens) => tokens.reduce((sum, t) => sum + t, 0n))

    const subgraphDelegated = BigInt(sp.tokensDelegated)
    if (subgraphDelegated !== onChainSum) {
      spMismatches++
      console.log(`MISMATCH: ${sp.id}`)
      console.log(`  tokensDelegated: subgraph=${formatGRT(subgraphDelegated)}, chain=${formatGRT(onChainSum)}`)
      console.log("")
    } else {
      spMatches++
    }
  }

  // Summary
  console.log("=== Summary ===")
  console.log(`DelegationPools:`)
  console.log(`  Total:      ${pools.length}`)
  console.log(`  Matches:    ${poolMatches}`)
  console.log(`  Mismatches: ${poolMismatches}`)
  console.log("")
  console.log(`ServiceProviders (tokensDelegated):`)
  console.log(`  Total:      ${serviceProviders.length}`)
  console.log(`  Matches:    ${spMatches}`)
  console.log(`  Mismatches: ${spMismatches}`)

  const totalMismatches = poolMismatches + spMismatches
  if (totalMismatches === 0) {
    console.log("")
    console.log("All delegation pools match on-chain state!")
  }

  process.exit(totalMismatches > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
