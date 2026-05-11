/**
 * Fetches all indexer/service provider addresses from the legacy Graph Network subgraph.
 * Outputs to packages/subgraph/src/config/{network}/seed.ts
 *
 * Usage: NETWORK=arbitrum-one pnpm seed:indexers
 *
 * Requires GRAPH_API_KEY in .env
 */

import * as fs from "fs"
import * as path from "path"
import { getConfig, getLegacySubgraphUrl } from "../config"
import { querySubgraph } from "../common"

interface Indexer {
  id: string
}

async function main() {
  const config = getConfig()
  const subgraphUrl = getLegacySubgraphUrl()

  console.log("=== Indexer Seed Export ===")
  console.log(`Network: ${config.name}`)
  console.log(`Legacy Subgraph: ${config.legacySubgraphId}`)
  console.log(`Block: ${config.horizonGenesisBlock}`)
  console.log("")

  // Fetch all indexers with stake at the specified block
  console.log("Fetching indexers...")
  let allIndexers: Indexer[] = []
  let lastId = ""

  while (true) {
    const whereClause = lastId
      ? `where: { stakedTokens_gt: "0", id_gt: "${lastId}" }`
      : `where: { stakedTokens_gt: "0" }`

    const data = await querySubgraph<{ indexers: Indexer[] }>(
      subgraphUrl,
      `{ indexers(first: 1000, orderBy: id, block: { number: ${config.horizonGenesisBlock} }, ${whereClause}) { id } }`
    )

    if (data.indexers.length === 0) break

    allIndexers.push(...data.indexers)
    lastId = data.indexers[data.indexers.length - 1].id

    if (data.indexers.length < 1000) break
  }

  // Sort addresses for deterministic output
  allIndexers.sort((a, b) => a.id.localeCompare(b.id))

  console.log(`Found ${allIndexers.length} indexers with stake`)
  console.log("")

  // Generate output file in subgraph package
  if (!fs.existsSync(config.subgraphConfigPath)) {
    console.error(`Error: Subgraph config directory not found: ${config.subgraphConfigPath}`)
    process.exit(1)
  }

  const seedFilePath = path.join(config.subgraphConfigPath, "indexer-seed.ts")

  const output = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Regenerate with: cd packages/tools && NETWORK=${config.name} pnpm seed:indexers
// Generated: ${new Date().toISOString()}
// Network: ${config.name}
// Block: ${config.horizonGenesisBlock}
// Count: ${allIndexers.length}

export const SERVICE_PROVIDER_ADDRESSES: string[] = [
${allIndexers.map((i) => `  "${i.id}",`).join("\n")}
]
`

  fs.writeFileSync(seedFilePath, output)
  console.log(`Written: ${seedFilePath}`)
  console.log(`  ${allIndexers.length} service provider addresses`)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
