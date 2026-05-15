/**
 * Common utilities shared across tools
 */

import { getConfig } from "./config"

// ============================================================================
// Subgraph Queries
// ============================================================================

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

// ============================================================================
// Formatting
// ============================================================================

export function formatGRT(wei: bigint): string {
  const decimals = 18n
  const divisor = 10n ** decimals
  const whole = wei / divisor
  const fraction = wei % divisor
  const fractionStr = fraction.toString().padStart(18, "0").slice(0, 4)
  return `${whole.toLocaleString()}.${fractionStr} GRT`
}

export function formatValue(value: bigint, isTokens: boolean): string {
  return isTokens ? formatGRT(value) : value.toString()
}

// ============================================================================
// Rate Limiting
// ============================================================================

export const RPC_DELAY_MS = 50

export async function delay(ms: number = RPC_DELAY_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// ============================================================================
// CLI Helpers
// ============================================================================

export function printHeader(subgraphUrl: string, includeRpc: boolean = true): void {
  const config = getConfig()
  console.log(`Network: ${config.name}`)
  console.log(`Subgraph URL: ${subgraphUrl}`)
  if (includeRpc) {
    console.log(`RPC URL: ${config.rpcUrl}`)
    console.log(`Staking contract: ${config.stakingAddress}`)
  }
  console.log("")
}

export function getSubgraphUrlFromArgs(): string {
  const url = process.argv[2]
  if (!url) {
    const scriptName = process.argv[1]?.split("/").pop() || "script"
    console.error(`Usage: NETWORK=arbitrum-one pnpm ${scriptName.replace(".ts", "")} <subgraph-url>`)
    process.exit(1)
  }
  return url
}

export async function runValidation(main: () => Promise<number>): Promise<void> {
  try {
    const exitCode = await main()
    process.exit(exitCode)
  } catch (err) {
    console.error("Error:", err)
    process.exit(1)
  }
}

// ============================================================================
// Validation Utilities
// ============================================================================

export interface FieldComparison {
  match: boolean
  message?: string
}

export function compareField(
  name: string,
  subgraphValue: bigint,
  onChainValue: bigint,
  isTokens = false
): FieldComparison {
  if (subgraphValue === onChainValue) {
    return { match: true }
  }
  const subgraphStr = formatValue(subgraphValue, isTokens)
  const onChainStr = formatValue(onChainValue, isTokens)
  return {
    match: false,
    message: `  ${name}: subgraph=${subgraphStr}, chain=${onChainStr}`,
  }
}

export interface ValidationResult {
  label: string
  total: number
  matches: number
  mismatches: number
}

export function printValidationSummary(results: ValidationResult[]): void {
  console.log("=== Summary ===")
  for (const result of results) {
    console.log(`${result.label}:`)
    console.log(`  Total:      ${result.total}`)
    console.log(`  Matches:    ${result.matches}`)
    console.log(`  Mismatches: ${result.mismatches}`)
    console.log("")
  }
}

export function validateCount(label: string, actual: number, expected: number): boolean {
  if (actual !== expected) {
    console.log(`WARNING: ${label} count mismatch - expected ${expected}, found ${actual}`)
    console.log("")
    return false
  }
  return true
}

export function validateSum<T>(
  label: string,
  items: T[],
  field: keyof T,
  expected: bigint
): boolean {
  const actual = items.reduce((sum, item) => sum + BigInt(item[field] as string), 0n)
  if (actual !== expected) {
    console.log(`WARNING: ${label} sum mismatch`)
    console.log(`  Expected: ${formatGRT(expected)}`)
    console.log(`  Actual:   ${formatGRT(actual)}`)
    console.log("")
    return false
  }
  return true
}
