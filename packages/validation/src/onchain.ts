import { getConfig } from "./config"

// getStake(address) selector = keccak256("getStake(address)")[:4]
const GET_STAKE_SELECTOR = "0x7a766460"

export async function getStake(address: string): Promise<bigint> {
  const config = getConfig()
  const paddedAddress = address.toLowerCase().replace("0x", "").padStart(64, "0")
  const callData = GET_STAKE_SELECTOR + paddedAddress

  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to: config.stakingAddress, data: callData }, "latest"],
    }),
  })

  const json = await response.json()
  if (json.error) {
    throw new Error(`RPC error: ${JSON.stringify(json.error)}`)
  }

  return BigInt(json.result)
}
