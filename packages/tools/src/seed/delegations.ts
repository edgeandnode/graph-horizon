/**
 * Exports delegation data for seeding the Network Subgraph.
 *
 * Exports:
 * 1. All indexer addresses with delegations (for DelegationPool seeding)
 * 2. All delegations >= threshold GRT (for Delegation seeding)
 *
 * Usage: NETWORK=arbitrum-one pnpm seed:delegations
 *
 * Requires GRAPH_API_KEY in .env
 */

import * as fs from "fs"
import * as path from "path"
import { getConfig, getLegacySubgraphUrl } from "../config"
import { querySubgraph } from "../common"

const ONE_GRT = BigInt("1000000000000000000")

interface DelegatedStake {
  id: string
  delegator: { id: string }
  indexer: { id: string }
  stakedTokens: string
  shareAmount: string
}

interface Indexer {
  id: string
  delegatedTokens: string
}

async function main() {
  const config = getConfig()
  const subgraphUrl = getLegacySubgraphUrl()
  const thresholdGRT = config.delegationSeedThresholdGRT
  const thresholdWei = (BigInt(thresholdGRT) * ONE_GRT).toString()

  console.log("=== Delegation Seed Export ===")
  console.log(`Network: ${config.name}`)
  console.log(`Legacy Subgraph: ${config.legacySubgraphId}`)
  console.log(`Threshold: >= ${thresholdGRT} GRT`)
  console.log("")

  // 1. Fetch all indexers with delegations
  console.log("Fetching indexers with delegations...")
  let allIndexers: Indexer[] = []
  let indexerLastId = ""

  while (true) {
    const whereClause = indexerLastId
      ? `where: { delegatedTokens_gt: "0", id_gt: "${indexerLastId}" }`
      : `where: { delegatedTokens_gt: "0" }`
    const data = await querySubgraph<{ indexers: Indexer[] }>(
      subgraphUrl,
      `{ indexers(first: 1000, orderBy: id, ${whereClause}) {
        id
        delegatedTokens
      } }`
    )

    if (data.indexers.length === 0) break
    allIndexers.push(...data.indexers)
    indexerLastId = data.indexers[data.indexers.length - 1].id
    if (data.indexers.length < 1000) break
  }

  // Sort for deterministic output
  allIndexers.sort((a, b) => a.id.localeCompare(b.id))

  console.log(`  Found ${allIndexers.length} indexers with delegations`)
  console.log("")

  // 2. Fetch all delegations above threshold
  console.log(`Fetching delegations >= ${thresholdGRT} GRT...`)
  let allDelegations: DelegatedStake[] = []
  let lastId = ""
  let page = 0

  while (true) {
    page++
    const whereClause = lastId
      ? `where: { stakedTokens_gte: "${thresholdWei}", id_gt: "${lastId}" }`
      : `where: { stakedTokens_gte: "${thresholdWei}" }`

    const data = await querySubgraph<{ delegatedStakes: DelegatedStake[] }>(
      subgraphUrl,
      `{ delegatedStakes(first: 1000, orderBy: id, ${whereClause}) {
        id
        delegator { id }
        indexer { id }
        stakedTokens
        shareAmount
      } }`
    )

    if (data.delegatedStakes.length === 0) break

    allDelegations.push(...data.delegatedStakes)
    lastId = data.delegatedStakes[data.delegatedStakes.length - 1].id

    if (page % 10 === 0) {
      console.log(`  Page ${page}: ${allDelegations.length} delegations fetched...`)
    }

    if (data.delegatedStakes.length < 1000) break
  }

  console.log(`  Found ${allDelegations.length} delegations >= ${thresholdGRT} GRT`)
  console.log("")

  // 3. Get unique delegators
  const uniqueDelegators = new Set(allDelegations.map((d) => d.delegator.id))
  console.log(`  Unique delegators: ${uniqueDelegators.size}`)
  console.log("")

  // 4. Generate output file in subgraph package
  if (!fs.existsSync(config.subgraphConfigPath)) {
    console.error(`Error: Subgraph config directory not found: ${config.subgraphConfigPath}`)
    process.exit(1)
  }

  const seedFilePath = path.join(config.subgraphConfigPath, "delegation-seed.ts")

  const output = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Regenerate with: cd packages/tools && NETWORK=${config.name} pnpm seed:delegations ${thresholdGRT}
// Generated: ${new Date().toISOString()}
// Network: ${config.name}
// Threshold: >= ${thresholdGRT} GRT
//
// Indexers with delegations: ${allIndexers.length}
// Delegations above threshold: ${allDelegations.length}
// Unique delegators: ${uniqueDelegators.size}

// Indexer addresses with delegations (for DelegationPool seeding)
export const DELEGATED_INDEXER_ADDRESSES: string[] = [
${allIndexers.map((i) => `  "${i.id}",`).join("\n")}
]

// Delegation data: [delegator, indexer]
// For seeding individual Delegation entities above threshold
export const DELEGATION_SEED_DATA: string[][] = [
${allDelegations.map((d) => `  ["${d.delegator.id}", "${d.indexer.id}"],`).join("\n")}
]
`

  fs.writeFileSync(seedFilePath, output)
  console.log(`Written: ${seedFilePath}`)

  // Summary
  console.log("")
  console.log("=== Summary ===")
  console.log(`  Indexers to seed DelegationPools: ${allIndexers.length}`)
  console.log(`  Delegations to seed: ${allDelegations.length}`)
  console.log(`  Unique delegators: ${uniqueDelegators.size}`)
  console.log("")
  console.log("  Estimated data size:")
  const indexerBytes = allIndexers.length * 42
  const delegationBytes = allDelegations.length * 84 // two addresses
  const totalKB = (indexerBytes + delegationBytes) / 1024
  console.log(`    Indexer addresses: ${(indexerBytes / 1024).toFixed(1)} KB`)
  console.log(`    Delegation pairs: ${(delegationBytes / 1024).toFixed(1)} KB`)
  console.log(`    Total: ${totalKB.toFixed(1)} KB (~${(totalKB / 1024).toFixed(2)} MB)`)
  console.log("")
  console.log("  Contract calls at genesis:")
  console.log(`    getDelegationPool(): ${allIndexers.length} calls`)
  console.log(`    getDelegation(): ${allDelegations.length} calls`)
  console.log(`    With multicall (500/batch): ~${Math.ceil(allDelegations.length / 500)} batched calls`)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
