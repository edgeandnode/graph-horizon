export interface NetworkConfig {
  name: string
  rpcUrl: string
  stakingAddress: string
}

const configs: Record<string, NetworkConfig> = {
  "arbitrum-one": {
    name: "arbitrum-one",
    rpcUrl: "https://arb1.arbitrum.io/rpc",
    stakingAddress: "0x00669A4CF01450B64E8A2A20E9b1FCB71E61eF03",
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
