/**
 * Exports indexer addresses for seeding DelegationPools in the Network Subgraph.
 *
 * Only exports indexer addresses - individual delegators and delegations are
 * lazy-initialized when they first interact with the subgraph.
 *
 * Usage: NETWORK=arbitrum-one pnpm seed:delegations
 *
 * Requires GRAPH_API_KEY in .env
 */

import * as fs from "fs"
import * as path from "path"
import { getConfig, getLegacySubgraphUrl } from "../config"
import { querySubgraph } from "../common"

interface Indexer {
  id: string
  delegatedTokens: string
}

async function main() {
  const config = getConfig()
  const subgraphUrl = getLegacySubgraphUrl()

  console.log("=== Delegation Pool Seed Export ===")
  console.log(`Network: ${config.name}`)
  console.log(`Legacy Subgraph: ${config.legacySubgraphId}`)
  console.log(`Block: ${config.horizonGenesisBlock}`)
  console.log("")

  // Fetch all indexers with delegations at genesis block
  console.log("Fetching indexers with delegations...")
  let allIndexers: Indexer[] = []
  let indexerLastId = ""

  while (true) {
    const whereClause = indexerLastId
      ? `where: { delegatedTokens_gt: "0", id_gt: "${indexerLastId}" }`
      : `where: { delegatedTokens_gt: "0" }`
    const data = await querySubgraph<{ indexers: Indexer[] }>(
      subgraphUrl,
      `{ indexers(first: 1000, orderBy: id, block: { number: ${config.horizonGenesisBlock} }, ${whereClause}) {
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

  // Generate output file in subgraph package
  if (!fs.existsSync(config.subgraphConfigPath)) {
    console.error(`Error: Subgraph config directory not found: ${config.subgraphConfigPath}`)
    process.exit(1)
  }

  const seedFilePath = path.join(config.subgraphConfigPath, "delegation-seed.ts")

  const output = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Regenerate with: cd packages/tools && NETWORK=${config.name} pnpm seed:delegations
// Generated: ${new Date().toISOString()}
// Network: ${config.name}
// Block: ${config.horizonGenesisBlock}
//
// Indexers with delegations: ${allIndexers.length}
// Note: Individual delegators/delegations are lazy-initialized, not seeded at genesis

// Indexer addresses with delegations (for DelegationPool seeding)
export const DELEGATED_INDEXER_ADDRESSES: string[] = [
${allIndexers.map((i) => `  "${i.id}",`).join("\n")}
]
`

  fs.writeFileSync(seedFilePath, output)
  console.log(`Written: ${seedFilePath}`)

  // Summary
  console.log("")
  console.log("=== Summary ===")
  console.log(`  Indexers to seed DelegationPools: ${allIndexers.length}`)
  console.log("")
  console.log("  Estimated data size:")
  const indexerBytes = allIndexers.length * 42
  console.log(`    Indexer addresses: ${(indexerBytes / 1024).toFixed(1)} KB`)
  console.log("")
  console.log("  Contract calls at genesis:")
  console.log(`    getDelegationPool(): ${allIndexers.length} calls`)
  console.log(`    With multicall (100/batch): ~${Math.ceil(allIndexers.length / 100)} batched calls`)
  console.log("")
  console.log("  Note: Delegators and delegations are lazy-initialized when they")
  console.log("  first interact (delegate, undelegate, withdraw).")
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
