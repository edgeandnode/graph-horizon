/**
 * Fetches all legacy operator authorizations from the legacy Graph Network subgraph.
 * Outputs to packages/subgraph/src/config/{network}/operator-seed.ts
 *
 * Usage: NETWORK=arbitrum-one pnpm seed:operators
 *
 * Requires GRAPH_API_KEY in .env
 */

import * as fs from "fs"
import * as path from "path"
import { getConfig, getLegacySubgraphUrl } from "../config"
import { querySubgraph } from "../common"

interface Indexer {
  id: string
  account: {
    operators: { id: string }[]
  }
}

interface OperatorPair {
  serviceProvider: string
  operator: string
}

async function main() {
  const config = getConfig()
  const subgraphUrl = getLegacySubgraphUrl()

  console.log("=== Operator Seed Export ===")
  console.log(`Network: ${config.name}`)
  console.log(`Legacy Subgraph: ${config.legacySubgraphId}`)
  console.log(`Block: ${config.horizonGenesisBlock}`)
  console.log("")

  // Fetch all indexers with their operators at the specified block
  console.log("Fetching indexers with operators...")
  let allIndexers: Indexer[] = []
  let lastId = ""

  while (true) {
    const whereClause = lastId
      ? `where: { stakedTokens_gt: "0", id_gt: "${lastId}" }`
      : `where: { stakedTokens_gt: "0" }`

    const data = await querySubgraph<{ indexers: Indexer[] }>(
      subgraphUrl,
      `{
        indexers(first: 1000, orderBy: id, block: { number: ${config.horizonGenesisBlock} }, ${whereClause}) {
          id
          account {
            operators {
              id
            }
          }
        }
      }`
    )

    if (data.indexers.length === 0) break

    allIndexers.push(...data.indexers)
    lastId = data.indexers[data.indexers.length - 1].id

    if (data.indexers.length < 1000) break
  }

  // Flatten to (serviceProvider, operator) pairs
  const operatorPairs: OperatorPair[] = []
  for (const indexer of allIndexers) {
    if (indexer.account && indexer.account.operators) {
      for (const operator of indexer.account.operators) {
        operatorPairs.push({
          serviceProvider: indexer.id,
          operator: operator.id,
        })
      }
    }
  }

  // Sort for deterministic output
  operatorPairs.sort((a, b) => {
    const spCompare = a.serviceProvider.localeCompare(b.serviceProvider)
    if (spCompare !== 0) return spCompare
    return a.operator.localeCompare(b.operator)
  })

  console.log(`Found ${allIndexers.length} indexers`)
  console.log(`Found ${operatorPairs.length} operator authorizations`)
  console.log("")

  // Generate output file in subgraph package
  if (!fs.existsSync(config.subgraphConfigPath)) {
    console.error(`Error: Subgraph config directory not found: ${config.subgraphConfigPath}`)
    process.exit(1)
  }

  const seedFilePath = path.join(config.subgraphConfigPath, "operator-seed.ts")

  // Create parallel arrays
  const serviceProviders = operatorPairs.map((p) => p.serviceProvider)
  const operators = operatorPairs.map((p) => p.operator)

  const output = `// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY
// Regenerate with: cd packages/tools && NETWORK=${config.name} pnpm seed:operators
// Generated: ${new Date().toISOString()}
// Network: ${config.name}
// Block: ${config.horizonGenesisBlock}
// Count: ${operatorPairs.length}

// Parallel arrays: OPERATOR_SERVICE_PROVIDERS[i] authorized OPERATORS[i]
export const OPERATOR_SERVICE_PROVIDERS: string[] = [
${serviceProviders.map((sp) => `  "${sp}",`).join("\n")}
]

export const OPERATORS: string[] = [
${operators.map((op) => `  "${op}",`).join("\n")}
]
`

  fs.writeFileSync(seedFilePath, output)
  console.log(`Written: ${seedFilePath}`)
  console.log(`  ${operatorPairs.length} operator authorizations`)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
