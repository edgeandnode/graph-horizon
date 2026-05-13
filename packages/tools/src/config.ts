import "dotenv/config"
import * as path from "path"

export interface NetworkConfig {
  name: string
  rpcUrl: string
  stakingAddress: string
  subgraphServiceAddress: string
  legacySubgraphId: string
  horizonGenesisBlock: number
  subgraphConfigPath: string
}

const configs: Record<string, NetworkConfig> = {
  "arbitrum-one": {
    name: "arbitrum-one",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    stakingAddress: "0x00669A4CF01450B64E8A2A20E9b1FCB71E61eF03",
    subgraphServiceAddress: "0xb2Bb92d0DE618878E438b55D5846cfecD9301105",
    legacySubgraphId: "DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp",
    horizonGenesisBlock: 408825706,
    subgraphConfigPath: path.resolve(process.cwd(), "../subgraph/src/config/arbitrum-one"),
  },
  // Add more networks here
}

export function getConfig(): NetworkConfig {
  const network = process.env.NETWORK || "arbitrum-one"
  const config = configs[network]

  if (!config) {
    const available = Object.keys(configs).join(", ")
    throw new Error(`Unknown network: ${network}. Available: ${available}`)
  }

  // Allow RPC_URL override
  if (process.env.RPC_URL) {
    config.rpcUrl = process.env.RPC_URL
  }

  return config
}

export function getGraphApiKey(): string {
  const apiKey = process.env.GRAPH_API_KEY
  if (!apiKey) {
    console.error("Error: GRAPH_API_KEY not set in environment")
    console.error("Add GRAPH_API_KEY=your-key to .env file")
    process.exit(1)
  }
  return apiKey
}

export function getLegacySubgraphUrl(): string {
  const config = getConfig()
  const apiKey = getGraphApiKey()
  return `https://gateway.thegraph.com/api/${apiKey}/subgraphs/id/${config.legacySubgraphId}`
}
