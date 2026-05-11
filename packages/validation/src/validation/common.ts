/**
 * Common utilities for validation scripts
 */

import { getConfig } from "../config"

export async function querySubgraph<T>(url: string, query: string): Promise<T> {
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

export function formatGRT(wei: bigint): string {
  const decimals = 18n
  const divisor = 10n ** decimals
  const whole = wei / divisor
  const fraction = wei % divisor
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 4)
  return `${whole.toLocaleString()}.${fractionStr} GRT`
}

export function getSubgraphUrl(): string {
  const url = process.argv[2]
  if (!url) {
    const scriptName = process.argv[1]?.split("/").pop() || "script"
    console.error(`Usage: pnpm validate:${scriptName.replace(".ts", "")} <subgraph-url>`)
    process.exit(1)
  }
  return url
}

export function printHeader(subgraphUrl: string): void {
  const config = getConfig()
  console.log("Subgraph URL:", subgraphUrl)
  console.log("RPC URL:", config.rpcUrl)
  console.log("Staking contract:", config.stakingAddress)
  console.log("")
}

// Rate limiting delay between RPC calls
export const RPC_DELAY_MS = 50

export async function delay(ms: number = RPC_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
