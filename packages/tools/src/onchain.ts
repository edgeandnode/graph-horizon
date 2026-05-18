import { getConfig } from "./config"

// Function selectors (keccak256 of signature, first 4 bytes)
const GET_STAKE_SELECTOR = "0x7a766460" // getStake(address)
const GET_SERVICE_PROVIDER_SELECTOR = "0x8cc01c86" // getServiceProvider(address)
const GET_PROVISION_SELECTOR = "0x25d9897e" // getProvision(address,address)
const GET_DELEGATION_POOL_SELECTOR = "0x561285e4" // getDelegationPool(address,address)
const GET_DELEGATION_FEE_CUT_SELECTOR = "0x7573ef4f" // getDelegationFeeCut(address,address,uint8)
const IS_AUTHORIZED_SELECTOR = "0x7c145cc7" // isAuthorized(address,address,address)
const MULTICALL_SELECTOR = "0xac9650d8" // multicall(bytes[])

export interface ServiceProviderData {
  tokensStaked: bigint
  tokensProvisioned: bigint
}

export interface ProvisionData {
  tokens: bigint
  tokensThawing: bigint
  sharesThawing: bigint
  maxVerifierCut: bigint
  thawingPeriod: bigint
  createdAt: bigint
  maxVerifierCutPending: bigint
  thawingPeriodPending: bigint
  lastParametersStagedAt: bigint
  thawingNonce: bigint
}

export interface DelegationPoolData {
  tokens: bigint
  shares: bigint
  tokensThawing: bigint
  sharesThawing: bigint
  thawingNonce: bigint
}

async function ethCall(to: string, data: string): Promise<string> {
  const config = getConfig()
  const response = await fetch(config.rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "eth_call",
      params: [{ to, data }, "latest"],
    }),
  })

  const json = await response.json()
  if (json.error) {
    throw new Error(`RPC error: ${JSON.stringify(json.error)}`)
  }
  return json.result
}

function padAddress(address: string): string {
  return address.toLowerCase().replace("0x", "").padStart(64, "0")
}

export async function getStake(address: string): Promise<bigint> {
  const config = getConfig()
  const callData = GET_STAKE_SELECTOR + padAddress(address)
  const result = await ethCall(config.stakingAddress, callData)
  return BigInt(result)
}

export async function getServiceProvider(address: string): Promise<ServiceProviderData> {
  const config = getConfig()
  const callData = GET_SERVICE_PROVIDER_SELECTOR + padAddress(address)
  const result = await ethCall(config.stakingAddress, callData)

  // Result is two packed uint256 values (tokensStaked, tokensProvisioned)
  const hex = result.slice(2) // remove 0x
  return {
    tokensStaked: BigInt("0x" + hex.slice(0, 64)),
    tokensProvisioned: BigInt("0x" + hex.slice(64, 128)),
  }
}

export async function getProvision(serviceProvider: string, verifier: string): Promise<ProvisionData> {
  const config = getConfig()
  const callData = GET_PROVISION_SELECTOR + padAddress(serviceProvider) + padAddress(verifier)
  const result = await ethCall(config.stakingAddress, callData)

  // Provision struct has 10 fields, but they're packed with different sizes:
  // - tokens: uint256 (32 bytes)
  // - tokensThawing: uint256 (32 bytes)
  // - sharesThawing: uint256 (32 bytes)
  // - maxVerifierCut: uint32 (packed)
  // - thawingPeriod: uint64 (packed)
  // - createdAt: uint64 (packed)
  // - maxVerifierCutPending: uint32 (packed)
  // - thawingPeriodPending: uint64 (packed)
  // - lastParametersStagedAt: uint256 (32 bytes)
  // - thawingNonce: uint256 (32 bytes)
  // In ABI encoding, each field is padded to 32 bytes
  const hex = result.slice(2)
  return {
    tokens: BigInt("0x" + hex.slice(0, 64)),
    tokensThawing: BigInt("0x" + hex.slice(64, 128)),
    sharesThawing: BigInt("0x" + hex.slice(128, 192)),
    maxVerifierCut: BigInt("0x" + hex.slice(192, 256)),
    thawingPeriod: BigInt("0x" + hex.slice(256, 320)),
    createdAt: BigInt("0x" + hex.slice(320, 384)),
    maxVerifierCutPending: BigInt("0x" + hex.slice(384, 448)),
    thawingPeriodPending: BigInt("0x" + hex.slice(448, 512)),
    lastParametersStagedAt: BigInt("0x" + hex.slice(512, 576)),
    thawingNonce: BigInt("0x" + hex.slice(576, 640)),
  }
}

export async function getDelegationPool(serviceProvider: string, verifier: string): Promise<DelegationPoolData> {
  const config = getConfig()
  const callData = GET_DELEGATION_POOL_SELECTOR + padAddress(serviceProvider) + padAddress(verifier)
  const result = await ethCall(config.stakingAddress, callData)

  // DelegationPool struct has 5 uint256 fields:
  // - tokens: uint256
  // - shares: uint256
  // - tokensThawing: uint256
  // - sharesThawing: uint256
  // - thawingNonce: uint256
  const hex = result.slice(2)
  return {
    tokens: BigInt("0x" + hex.slice(0, 64)),
    shares: BigInt("0x" + hex.slice(64, 128)),
    tokensThawing: BigInt("0x" + hex.slice(128, 192)),
    sharesThawing: BigInt("0x" + hex.slice(192, 256)),
    thawingNonce: BigInt("0x" + hex.slice(256, 320)),
  }
}

export async function getDelegationFeeCut(
  serviceProvider: string,
  verifier: string,
  paymentType: number
): Promise<bigint> {
  const config = getConfig()
  // paymentType is uint8, pad to 32 bytes
  const paymentTypePadded = paymentType.toString(16).padStart(64, "0")
  const callData = GET_DELEGATION_FEE_CUT_SELECTOR + padAddress(serviceProvider) + padAddress(verifier) + paymentTypePadded
  const result = await ethCall(config.stakingAddress, callData)
  return BigInt(result)
}

export async function isAuthorized(
  serviceProvider: string,
  verifier: string,
  operator: string
): Promise<boolean> {
  const config = getConfig()
  const callData = IS_AUTHORIZED_SELECTOR + padAddress(serviceProvider) + padAddress(verifier) + padAddress(operator)
  const result = await ethCall(config.stakingAddress, callData)
  // Result is a boolean encoded as uint256 (0 or 1)
  return BigInt(result) === 1n
}

// ============================================================================
// Multicall
// ============================================================================

// Encode call data helpers (for use with multicall)
export function encodeGetServiceProvider(address: string): string {
  return GET_SERVICE_PROVIDER_SELECTOR + padAddress(address)
}

export function encodeGetProvision(serviceProvider: string, verifier: string): string {
  return GET_PROVISION_SELECTOR + padAddress(serviceProvider) + padAddress(verifier)
}

export function encodeGetDelegationPool(serviceProvider: string, verifier: string): string {
  return GET_DELEGATION_POOL_SELECTOR + padAddress(serviceProvider) + padAddress(verifier)
}

export function encodeGetDelegationFeeCut(serviceProvider: string, verifier: string, paymentType: number): string {
  const paymentTypePadded = paymentType.toString(16).padStart(64, "0")
  return GET_DELEGATION_FEE_CUT_SELECTOR + padAddress(serviceProvider) + padAddress(verifier) + paymentTypePadded
}

// Decode result helpers
export function decodeServiceProviderResult(hex: string): ServiceProviderData {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!data || data.length < 128) {
    return { tokensStaked: 0n, tokensProvisioned: 0n }
  }
  return {
    tokensStaked: BigInt("0x" + data.slice(0, 64)),
    tokensProvisioned: BigInt("0x" + data.slice(64, 128)),
  }
}

export function decodeProvisionResult(hex: string): ProvisionData {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!data || data.length < 640) {
    return {
      tokens: 0n,
      tokensThawing: 0n,
      sharesThawing: 0n,
      maxVerifierCut: 0n,
      thawingPeriod: 0n,
      createdAt: 0n,
      maxVerifierCutPending: 0n,
      thawingPeriodPending: 0n,
      lastParametersStagedAt: 0n,
      thawingNonce: 0n,
    }
  }
  return {
    tokens: BigInt("0x" + data.slice(0, 64)),
    tokensThawing: BigInt("0x" + data.slice(64, 128)),
    sharesThawing: BigInt("0x" + data.slice(128, 192)),
    maxVerifierCut: BigInt("0x" + data.slice(192, 256)),
    thawingPeriod: BigInt("0x" + data.slice(256, 320)),
    createdAt: BigInt("0x" + data.slice(320, 384)),
    maxVerifierCutPending: BigInt("0x" + data.slice(384, 448)),
    thawingPeriodPending: BigInt("0x" + data.slice(448, 512)),
    lastParametersStagedAt: BigInt("0x" + data.slice(512, 576)),
    thawingNonce: BigInt("0x" + data.slice(576, 640)),
  }
}

export function decodeDelegationPoolResult(hex: string): DelegationPoolData {
  const data = hex.startsWith("0x") ? hex.slice(2) : hex
  if (!data || data.length < 320) {
    return { tokens: 0n, shares: 0n, tokensThawing: 0n, sharesThawing: 0n, thawingNonce: 0n }
  }
  return {
    tokens: BigInt("0x" + data.slice(0, 64)),
    shares: BigInt("0x" + data.slice(64, 128)),
    tokensThawing: BigInt("0x" + data.slice(128, 192)),
    sharesThawing: BigInt("0x" + data.slice(192, 256)),
    thawingNonce: BigInt("0x" + data.slice(256, 320)),
  }
}

/**
 * Executes multiple calls in a single RPC request using HorizonStaking's built-in multicall.
 * @param calls Array of encoded call data (without 0x prefix is fine)
 * @returns Array of result hex strings
 */
export async function multicall(calls: string[]): Promise<string[]> {
  const config = getConfig()

  // ABI encode bytes[] parameter
  // - offset to array data (32 bytes): 0x20
  // - array length (32 bytes)
  // - offsets to each bytes element (32 bytes each)
  // - each bytes element: length (32 bytes) + data (padded to 32 bytes)

  const normalizedCalls = calls.map((c) => (c.startsWith("0x") ? c.slice(2) : c))

  // Calculate offsets for each element
  // Offsets are relative to the start of the array data (after the length)
  const headerSize = normalizedCalls.length * 32 // space for all offset pointers
  const offsets: number[] = []
  let currentOffset = headerSize

  for (const call of normalizedCalls) {
    offsets.push(currentOffset)
    const dataLen = call.length / 2 // bytes length
    const paddedLen = Math.ceil(dataLen / 32) * 32
    currentOffset += 32 + paddedLen // 32 for length + padded data
  }

  // Build the encoded data
  let encoded = MULTICALL_SELECTOR.slice(2) // remove 0x
  encoded += "0000000000000000000000000000000000000000000000000000000000000020" // offset to array = 32
  encoded += normalizedCalls.length.toString(16).padStart(64, "0") // array length

  // Add offsets
  for (const offset of offsets) {
    encoded += offset.toString(16).padStart(64, "0")
  }

  // Add each bytes element
  for (const call of normalizedCalls) {
    const dataLen = call.length / 2
    encoded += dataLen.toString(16).padStart(64, "0") // length
    const paddedLen = Math.ceil(dataLen / 32) * 32
    encoded += call.padEnd(paddedLen * 2, "0") // data padded to 32-byte boundary
  }

  const result = await ethCall(config.stakingAddress, "0x" + encoded)

  // Decode bytes[] result
  // ABI encoding of bytes[]:
  // - bytes 0-31: offset to array data (value 32)
  // - bytes 32-63: array length
  // - bytes 64+: offset pointers (32 bytes each), relative to byte 64
  // - then: each bytes element as (length + data)
  const resultHex = result.slice(2)
  const resultLength = parseInt(resultHex.slice(64, 128), 16)

  const results: string[] = []
  for (let i = 0; i < resultLength; i++) {
    const offsetPos = 128 + i * 64 // Position of offset[i] (byte 64 + i*32)
    const offset = parseInt(resultHex.slice(offsetPos, offsetPos + 64), 16) * 2
    const lengthPos = 128 + offset // Offsets are relative to byte 64 (hex pos 128)
    const length = parseInt(resultHex.slice(lengthPos, lengthPos + 64), 16)
    const dataStart = lengthPos + 64
    const data = resultHex.slice(dataStart, dataStart + length * 2)
    results.push("0x" + data)
  }

  return results
}
