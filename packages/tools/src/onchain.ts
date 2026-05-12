import { getConfig } from "./config"

// Function selectors (keccak256 of signature, first 4 bytes)
const GET_STAKE_SELECTOR = "0x7a766460" // getStake(address)
const GET_SERVICE_PROVIDER_SELECTOR = "0x8cc01c86" // getServiceProvider(address)
const GET_PROVISION_SELECTOR = "0x25d9897e" // getProvision(address,address)
const GET_DELEGATION_POOL_SELECTOR = "0x561285e4" // getDelegationPool(address,address)

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
