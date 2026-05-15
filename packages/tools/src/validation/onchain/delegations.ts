/**
 * Validates subgraph DelegationPool entities against on-chain HorizonStaking.getDelegationPool()
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:onchain:delegations <subgraph-url>
 */

import { getDelegationPool } from "../../onchain"
import {
  querySubgraph,
  getSubgraphUrlFromArgs,
  printHeader,
  delay,
  runValidation,
  compareField,
  printValidationSummary,
  type ValidationResult,
} from "../../common"

interface DelegationPool {
  id: string
  serviceProvider: { id: string }
  dataService: { id: string }
  tokens: string
  shares: string
  tokensThawing: string
}

async function main(): Promise<number> {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl)

  // Fetch all DelegationPools
  console.log("=== Fetching DelegationPools ===")
  const poolData = await querySubgraph<{ delegationPools: DelegationPool[] }>(
    subgraphUrl,
    `{ delegationPools(first: 1000, orderBy: tokens, orderDirection: desc) {
      id
      serviceProvider { id }
      dataService { id }
      tokens
      shares
      tokensThawing
    } }`
  )
  const pools = poolData.delegationPools

  console.log(`  Found ${pools.length} delegation pools`)
  console.log("")

  // Compare each DelegationPool against on-chain
  console.log("=== Comparing DelegationPools against on-chain state ===")
  let mismatches = 0
  let matches = 0

  for (const pool of pools) {
    const onChain = await getDelegationPool(pool.serviceProvider.id, pool.dataService.id)

    const fields = [
      compareField("tokens", BigInt(pool.tokens), onChain.tokens, true),
      compareField("shares", BigInt(pool.shares), onChain.shares),
      compareField("tokensThawing", BigInt(pool.tokensThawing), onChain.tokensThawing, true),
    ]

    const fieldMismatches = fields.filter((f) => !f.match)
    if (fieldMismatches.length > 0) {
      mismatches++
      console.log(`MISMATCH: ${pool.serviceProvider.id} -> ${pool.dataService.id}`)
      for (const m of fieldMismatches) {
        console.log(m.message)
      }
      console.log("")
    } else {
      matches++
    }

    await delay()
  }

  // Summary
  const results: ValidationResult[] = [
    { label: "DelegationPools", total: pools.length, matches, mismatches },
  ]
  printValidationSummary(results)

  if (mismatches === 0) {
    console.log("All delegation pools match on-chain state!")
  }

  return mismatches > 0 ? 1 : 0
}

runValidation(main)
