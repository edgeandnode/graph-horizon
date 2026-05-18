/**
 * Validates subgraph ServiceProvider fields against on-chain HorizonStaking
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:onchain:service-providers <subgraph-url>
 */

import {
  multicall,
  encodeGetServiceProvider,
  encodeGetProvision,
  encodeGetDelegationPool,
  decodeServiceProviderResult,
  decodeProvisionResult,
  decodeDelegationPoolResult,
} from "../../onchain"
import {
  querySubgraph,
  formatGRT,
  getSubgraphUrlFromArgs,
  printHeader,
  runValidation,
  printValidationSummary,
  type ValidationResult,
} from "../../common"

interface ServiceProvider {
  id: string
  tokensStaked: string
  tokensProvisioned: string
  tokensThawing: string
  tokensDelegated: string
  tokensDelegatedThawing: string
}

interface Provision {
  id: string
  serviceProvider: { id: string }
  dataService: { id: string }
}

interface DelegationPool {
  id: string
  serviceProvider: { id: string }
  dataService: { id: string }
}

async function main(): Promise<number> {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl)

  // Fetch all data from subgraph
  console.log("=== Fetching subgraph data ===")
  const [spData, provisionData, poolData] = await Promise.all([
    querySubgraph<{ serviceProviders: ServiceProvider[] }>(
      subgraphUrl,
      `{ serviceProviders(first: 1000, orderBy: tokensStaked, orderDirection: desc) {
        id
        tokensStaked
        tokensProvisioned
        tokensThawing
        tokensDelegated
        tokensDelegatedThawing
      } }`
    ),
    querySubgraph<{ provisions: Provision[] }>(
      subgraphUrl,
      `{ provisions(first: 1000) { id serviceProvider { id } dataService { id } } }`
    ),
    querySubgraph<{ delegationPools: DelegationPool[] }>(
      subgraphUrl,
      `{ delegationPools(first: 1000) { id serviceProvider { id } dataService { id } } }`
    ),
  ])

  const serviceProviders = spData.serviceProviders
  const provisions = provisionData.provisions
  const pools = poolData.delegationPools

  // Group provisions by service provider
  const provisionsBySP = new Map<string, Provision[]>()
  for (const provision of provisions) {
    const spId = provision.serviceProvider.id
    if (!provisionsBySP.has(spId)) {
      provisionsBySP.set(spId, [])
    }
    provisionsBySP.get(spId)!.push(provision)
  }

  // Group delegation pools by service provider
  const poolsBySP = new Map<string, DelegationPool[]>()
  for (const pool of pools) {
    const spId = pool.serviceProvider.id
    if (!poolsBySP.has(spId)) {
      poolsBySP.set(spId, [])
    }
    poolsBySP.get(spId)!.push(pool)
  }

  console.log(`  Found ${serviceProviders.length} service providers`)
  console.log(`  Found ${provisions.length} provisions`)
  console.log(`  Found ${pools.length} delegation pools`)
  console.log("")

  // Compare each SP against on-chain using multicall (1 RPC call per SP)
  console.log("=== Comparing against on-chain state ===")
  let mismatches = 0
  let matches = 0

  for (const sp of serviceProviders) {
    const spProvisions = provisionsBySP.get(sp.id) || []
    const spPools = poolsBySP.get(sp.id) || []

    // Build multicall batch: 1 SP call + N provision calls + M pool calls
    const calls: string[] = [encodeGetServiceProvider(sp.id)]
    for (const provision of spProvisions) {
      calls.push(encodeGetProvision(sp.id, provision.dataService.id))
    }
    for (const pool of spPools) {
      calls.push(encodeGetDelegationPool(sp.id, pool.dataService.id))
    }

    // Execute single multicall for this SP
    const results = await multicall(calls)

    // Decode results
    const onChainSP = decodeServiceProviderResult(results[0])

    let onChainThawing = 0n
    for (let i = 0; i < spProvisions.length; i++) {
      const provisionResult = decodeProvisionResult(results[1 + i])
      onChainThawing += provisionResult.tokensThawing
    }

    let onChainDelegated = 0n
    let onChainDelegatedThawing = 0n
    for (let i = 0; i < spPools.length; i++) {
      const poolResult = decodeDelegationPoolResult(results[1 + spProvisions.length + i])
      onChainDelegated += poolResult.tokens
      onChainDelegatedThawing += poolResult.tokensThawing
    }

    // Compare values
    const issues: string[] = []

    const subgraphStaked = BigInt(sp.tokensStaked)
    const subgraphProvisioned = BigInt(sp.tokensProvisioned)
    const subgraphThawing = BigInt(sp.tokensThawing)
    const subgraphDelegated = BigInt(sp.tokensDelegated)
    const subgraphDelegatedThawing = BigInt(sp.tokensDelegatedThawing)

    if (subgraphStaked !== onChainSP.tokensStaked) {
      const diff = onChainSP.tokensStaked - subgraphStaked
      issues.push(
        `tokensStaked: subgraph=${formatGRT(subgraphStaked)}, chain=${formatGRT(onChainSP.tokensStaked)}, ` +
        `diff=${formatGRT(diff > 0n ? diff : -diff)} (${diff > 0n ? "chain higher" : "subgraph higher"})`
      )
    }

    if (subgraphProvisioned !== onChainSP.tokensProvisioned) {
      const diff = onChainSP.tokensProvisioned - subgraphProvisioned
      issues.push(
        `tokensProvisioned: subgraph=${formatGRT(subgraphProvisioned)}, chain=${formatGRT(onChainSP.tokensProvisioned)}, ` +
        `diff=${formatGRT(diff > 0n ? diff : -diff)} (${diff > 0n ? "chain higher" : "subgraph higher"})`
      )
    }

    if (subgraphThawing !== onChainThawing) {
      const diff = onChainThawing - subgraphThawing
      issues.push(
        `tokensThawing: subgraph=${formatGRT(subgraphThawing)}, chain=${formatGRT(onChainThawing)}, ` +
        `diff=${formatGRT(diff > 0n ? diff : -diff)} (${diff > 0n ? "chain higher" : "subgraph higher"})`
      )
    }

    if (subgraphDelegated !== onChainDelegated) {
      const diff = onChainDelegated - subgraphDelegated
      issues.push(
        `tokensDelegated: subgraph=${formatGRT(subgraphDelegated)}, chain=${formatGRT(onChainDelegated)}, ` +
        `diff=${formatGRT(diff > 0n ? diff : -diff)} (${diff > 0n ? "chain higher" : "subgraph higher"})`
      )
    }

    if (subgraphDelegatedThawing !== onChainDelegatedThawing) {
      const diff = onChainDelegatedThawing - subgraphDelegatedThawing
      issues.push(
        `tokensDelegatedThawing: subgraph=${formatGRT(subgraphDelegatedThawing)}, chain=${formatGRT(onChainDelegatedThawing)}, ` +
        `diff=${formatGRT(diff > 0n ? diff : -diff)} (${diff > 0n ? "chain higher" : "subgraph higher"})`
      )
    }

    if (issues.length > 0) {
      mismatches++
      console.log(`MISMATCH: ${sp.id}`)
      for (const issue of issues) {
        console.log(`  ${issue}`)
      }
      console.log("")
    } else {
      matches++
    }
  }

  // Summary
  const results: ValidationResult[] = [
    { label: "ServiceProviders", total: serviceProviders.length, matches, mismatches },
  ]
  printValidationSummary(results)

  if (mismatches === 0) {
    console.log("All service providers match on-chain state!")
  }

  return mismatches > 0 ? 1 : 0
}

runValidation(main)
