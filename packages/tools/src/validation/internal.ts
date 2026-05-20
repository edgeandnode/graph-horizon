/**
 * Validates internal consistency of subgraph data.
 * Checks that aggregates match entity sums and counts match entity counts.
 * This is fast (no RPC calls) and catches mapping bugs.
 *
 * Usage: pnpm validate:internal <subgraph-url>
 */

import {
  querySubgraph,
  formatGRT,
  getSubgraphUrlFromArgs,
  printHeader,
  runValidation,
  validateCount,
  validateSum,
} from "../common"

// ============================================================================
// Types
// ============================================================================

interface GraphNetwork {
  id: string
  countServiceProviders: number
  countDataServices: number
  countProvisions: number
  countDelegationPools: number
  tokensStaked: string
  tokensProvisioned: string
  tokensDelegated: string
  tokensThawingFromProvisions: string
  tokensThawingFromDelegationPools: string
}

interface ServiceProvider {
  id: string
  tokensStaked: string
  tokensProvisioned: string
  tokensDelegated: string
  tokensThawing: string
  tokensDelegatedThawing: string
  tokensIdle: string
}

interface DataService {
  id: string
  countServiceProviders: number
  countProvisions: number
  countDelegationPools: number
  tokensProvisioned: string
  tokensDelegated: string
  tokensThawingFromProvisions: string
  tokensThawingFromDelegationPools: string
}

interface Provision {
  id: string
  serviceProvider: { id: string }
  dataService: { id: string }
  tokens: string
  tokensThawing: string
}

interface DelegationPool {
  id: string
  serviceProvider: { id: string }
  dataService: { id: string }
  tokens: string
  tokensThawing: string
}

interface ProvisionThawRequest {
  id: string
  provision: { id: string }
  serviceProvider: { id: string }
  dataService: { id: string }
  fulfilled: boolean
}

interface ProvisionFeeCut {
  id: string
  provision: { id: string }
  paymentType: number
  feeCut: string
}

// ============================================================================
// Queries
// ============================================================================

const GRAPH_NETWORK_QUERY = `{
  graphNetwork(id: "0x01000000") {
    id
    countServiceProviders
    countDataServices
    countProvisions
    countDelegationPools
    tokensStaked
    tokensProvisioned
    tokensDelegated
    tokensThawingFromProvisions
    tokensThawingFromDelegationPools
  }
}`

const SERVICE_PROVIDERS_QUERY = `{
  serviceProviders(first: 1000, orderBy: tokensStaked, orderDirection: desc) {
    id
    tokensStaked
    tokensProvisioned
    tokensDelegated
    tokensThawing
    tokensDelegatedThawing
    tokensIdle
  }
}`

const DATA_SERVICES_QUERY = `{
  dataServices(first: 1000) {
    id
    countServiceProviders
    countProvisions
    countDelegationPools
    tokensProvisioned
    tokensDelegated
    tokensThawingFromProvisions
    tokensThawingFromDelegationPools
  }
}`

const PROVISIONS_QUERY = `{
  provisions(first: 1000) {
    id
    serviceProvider { id }
    dataService { id }
    tokens
    tokensThawing
  }
}`

const DELEGATION_POOLS_QUERY = `{
  delegationPools(first: 1000) {
    id
    serviceProvider { id }
    dataService { id }
    tokens
    tokensThawing
  }
}`

const PROVISION_THAW_REQUESTS_QUERY = `{
  provisionThawRequests(first: 1000) {
    id
    provision { id }
    serviceProvider { id }
    dataService { id }
    fulfilled
  }
}`

const PROVISION_FEE_CUTS_QUERY = `{
  provisionFeeCuts(first: 1000) {
    id
    provision { id }
    paymentType
    feeCut
  }
}`

// ============================================================================
// Main
// ============================================================================

async function main(): Promise<number> {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl, false)

  let warnings = 0

  // Fetch all data
  console.log("=== Fetching subgraph data ===")
  const [networkData, spData, dsData, provisionData, poolData, thawRequestData, feeCutData] = await Promise.all([
    querySubgraph<{ graphNetwork: GraphNetwork }>(subgraphUrl, GRAPH_NETWORK_QUERY),
    querySubgraph<{ serviceProviders: ServiceProvider[] }>(subgraphUrl, SERVICE_PROVIDERS_QUERY),
    querySubgraph<{ dataServices: DataService[] }>(subgraphUrl, DATA_SERVICES_QUERY),
    querySubgraph<{ provisions: Provision[] }>(subgraphUrl, PROVISIONS_QUERY),
    querySubgraph<{ delegationPools: DelegationPool[] }>(subgraphUrl, DELEGATION_POOLS_QUERY),
    querySubgraph<{ provisionThawRequests: ProvisionThawRequest[] }>(subgraphUrl, PROVISION_THAW_REQUESTS_QUERY),
    querySubgraph<{ provisionFeeCuts: ProvisionFeeCut[] }>(subgraphUrl, PROVISION_FEE_CUTS_QUERY),
  ])

  const graphNetwork = networkData.graphNetwork
  if (!graphNetwork) {
    console.error("GraphNetwork entity not found")
    return 1
  }

  const serviceProviders = spData.serviceProviders
  const dataServices = dsData.dataServices
  const provisions = provisionData.provisions
  const pools = poolData.delegationPools
  const thawRequests = thawRequestData.provisionThawRequests
  const feeCuts = feeCutData.provisionFeeCuts

  // Filter to only SPs with stake > 0 (matches countServiceProviders semantics)
  const stakedSPs = serviceProviders.filter((sp) => BigInt(sp.tokensStaked) > 0n)

  // Filter to only pools with tokens > 0 (matches countDelegationPools semantics)
  const activePools = pools.filter((p) => BigInt(p.tokens) > 0n)

  // Filter thaw requests by status
  const pendingThawRequests = thawRequests.filter((t) => !t.fulfilled)
  const fulfilledThawRequests = thawRequests.filter((t) => t.fulfilled)

  console.log(`  GraphNetwork: found`)
  console.log(`  ServiceProviders: ${serviceProviders.length} total, ${stakedSPs.length} with stake`)
  console.log(`  DataServices: ${dataServices.length}`)
  console.log(`  Provisions: ${provisions.length}`)
  console.log(`  DelegationPools: ${pools.length} total, ${activePools.length} with tokens`)
  console.log(`  ProvisionThawRequests: ${thawRequests.length} total, ${pendingThawRequests.length} pending, ${fulfilledThawRequests.length} fulfilled`)
  console.log(`  ProvisionFeeCuts: ${feeCuts.length}`)
  console.log("")

  // ============================================================================
  // GraphNetwork Count Validations
  // ============================================================================

  console.log("=== GraphNetwork Count Validations ===")

  if (!validateCount("ServiceProviders", stakedSPs.length, graphNetwork.countServiceProviders)) {
    warnings++
  }

  if (!validateCount("DataServices", dataServices.length, graphNetwork.countDataServices)) {
    warnings++
  }

  if (!validateCount("Provisions", provisions.length, graphNetwork.countProvisions)) {
    warnings++
  }

  if (!validateCount("DelegationPools", activePools.length, graphNetwork.countDelegationPools)) {
    warnings++
  }

  if (warnings === 0) {
    console.log("All counts match!")
    console.log("")
  }

  // ============================================================================
  // GraphNetwork Sum Validations
  // ============================================================================

  console.log("=== GraphNetwork Sum Validations ===")
  const sumWarningsBefore = warnings

  // tokensStaked: sum of SP.tokensStaked
  if (!validateSum("tokensStaked", serviceProviders, "tokensStaked", BigInt(graphNetwork.tokensStaked))) {
    warnings++
  }

  // tokensProvisioned: sum of Provision.tokens (not SP.tokensProvisioned, to catch SP aggregate drift)
  if (!validateSum("tokensProvisioned", provisions, "tokens", BigInt(graphNetwork.tokensProvisioned))) {
    warnings++
  }

  // tokensDelegated: sum of DelegationPool.tokens
  if (!validateSum("tokensDelegated", pools, "tokens", BigInt(graphNetwork.tokensDelegated))) {
    warnings++
  }

  // tokensThawingFromProvisions: sum of Provision.tokensThawing
  if (!validateSum("tokensThawingFromProvisions", provisions, "tokensThawing", BigInt(graphNetwork.tokensThawingFromProvisions))) {
    warnings++
  }

  // tokensThawingFromDelegationPools: sum of DelegationPool.tokensThawing
  if (!validateSum("tokensThawingFromDelegationPools", pools, "tokensThawing", BigInt(graphNetwork.tokensThawingFromDelegationPools))) {
    warnings++
  }

  if (warnings === sumWarningsBefore) {
    console.log("All sums match!")
    console.log("")
  }

  // ============================================================================
  // ServiceProvider Aggregate Validations
  // ============================================================================

  console.log("=== ServiceProvider Aggregate Validations ===")
  let spWarnings = 0

  for (const sp of serviceProviders) {
    const spProvisions = provisions.filter((p) => p.serviceProvider.id === sp.id)
    const spPools = pools.filter((p) => p.serviceProvider.id === sp.id)

    const issues: string[] = []

    // tokensProvisioned should equal sum of provision tokens
    const provisionedSum = spProvisions.reduce((sum, p) => sum + BigInt(p.tokens), 0n)
    if (BigInt(sp.tokensProvisioned) !== provisionedSum) {
      issues.push(`tokensProvisioned: SP=${formatGRT(BigInt(sp.tokensProvisioned))}, sum=${formatGRT(provisionedSum)}`)
    }

    // tokensThawing should equal sum of provision tokensThawing
    const thawingSum = spProvisions.reduce((sum, p) => sum + BigInt(p.tokensThawing), 0n)
    if (BigInt(sp.tokensThawing) !== thawingSum) {
      issues.push(`tokensThawing: SP=${formatGRT(BigInt(sp.tokensThawing))}, sum=${formatGRT(thawingSum)}`)
    }

    // tokensDelegated should equal sum of pool tokens
    const delegatedSum = spPools.reduce((sum, p) => sum + BigInt(p.tokens), 0n)
    if (BigInt(sp.tokensDelegated) !== delegatedSum) {
      issues.push(`tokensDelegated: SP=${formatGRT(BigInt(sp.tokensDelegated))}, sum=${formatGRT(delegatedSum)}`)
    }

    // tokensDelegatedThawing should equal sum of pool tokensThawing
    const delegatedThawingSum = spPools.reduce((sum, p) => sum + BigInt(p.tokensThawing), 0n)
    if (BigInt(sp.tokensDelegatedThawing) !== delegatedThawingSum) {
      issues.push(`tokensDelegatedThawing: SP=${formatGRT(BigInt(sp.tokensDelegatedThawing))}, sum=${formatGRT(delegatedThawingSum)}`)
    }

    // tokensIdle should equal tokensStaked - tokensProvisioned
    const expectedIdle = BigInt(sp.tokensStaked) - BigInt(sp.tokensProvisioned)
    if (BigInt(sp.tokensIdle) !== expectedIdle) {
      issues.push(`tokensIdle: SP=${formatGRT(BigInt(sp.tokensIdle))}, expected=${formatGRT(expectedIdle)}`)
    }

    if (issues.length > 0) {
      spWarnings++
      console.log(`WARNING: ${sp.id}`)
      for (const issue of issues) {
        console.log(`  ${issue}`)
      }
      console.log("")
    }
  }

  if (spWarnings === 0) {
    console.log("All ServiceProvider aggregates match!")
    console.log("")
  }

  warnings += spWarnings

  // ============================================================================
  // DataService Aggregate Validations
  // ============================================================================

  console.log("=== DataService Aggregate Validations ===")
  let dsWarnings = 0

  for (const ds of dataServices) {
    const dsProvisions = provisions.filter((p) => p.dataService.id === ds.id)
    const dsPools = pools.filter((p) => p.dataService.id === ds.id)
    const dsActivePools = dsPools.filter((p) => BigInt(p.tokens) > 0n)

    // Count unique service providers with provisions to this data service
    const uniqueSPs = new Set(dsProvisions.map((p) => p.serviceProvider.id))

    const issues: string[] = []

    // countServiceProviders should equal unique SPs with provisions
    if (ds.countServiceProviders !== uniqueSPs.size) {
      issues.push(`countServiceProviders: DS=${ds.countServiceProviders}, actual=${uniqueSPs.size}`)
    }

    // countProvisions should equal number of provisions
    if (ds.countProvisions !== dsProvisions.length) {
      issues.push(`countProvisions: DS=${ds.countProvisions}, actual=${dsProvisions.length}`)
    }

    // countDelegationPools should equal number of active pools
    if (ds.countDelegationPools !== dsActivePools.length) {
      issues.push(`countDelegationPools: DS=${ds.countDelegationPools}, actual=${dsActivePools.length}`)
    }

    // tokensProvisioned should equal sum of provision tokens
    const provisionedSum = dsProvisions.reduce((sum, p) => sum + BigInt(p.tokens), 0n)
    if (BigInt(ds.tokensProvisioned) !== provisionedSum) {
      issues.push(`tokensProvisioned: DS=${formatGRT(BigInt(ds.tokensProvisioned))}, sum=${formatGRT(provisionedSum)}`)
    }

    // tokensThawingFromProvisions should equal sum of provision tokensThawing
    const provisionThawingSum = dsProvisions.reduce((sum, p) => sum + BigInt(p.tokensThawing), 0n)
    if (BigInt(ds.tokensThawingFromProvisions) !== provisionThawingSum) {
      issues.push(`tokensThawingFromProvisions: DS=${formatGRT(BigInt(ds.tokensThawingFromProvisions))}, sum=${formatGRT(provisionThawingSum)}`)
    }

    // tokensDelegated should equal sum of pool tokens
    const delegatedSum = dsPools.reduce((sum, p) => sum + BigInt(p.tokens), 0n)
    if (BigInt(ds.tokensDelegated) !== delegatedSum) {
      issues.push(`tokensDelegated: DS=${formatGRT(BigInt(ds.tokensDelegated))}, sum=${formatGRT(delegatedSum)}`)
    }

    // tokensThawingFromDelegationPools should equal sum of pool tokensThawing
    const poolThawingSum = dsPools.reduce((sum, p) => sum + BigInt(p.tokensThawing), 0n)
    if (BigInt(ds.tokensThawingFromDelegationPools) !== poolThawingSum) {
      issues.push(`tokensThawingFromDelegationPools: DS=${formatGRT(BigInt(ds.tokensThawingFromDelegationPools))}, sum=${formatGRT(poolThawingSum)}`)
    }

    if (issues.length > 0) {
      dsWarnings++
      console.log(`WARNING: ${ds.id}`)
      for (const issue of issues) {
        console.log(`  ${issue}`)
      }
      console.log("")
    }
  }

  if (dsWarnings === 0) {
    console.log("All DataService aggregates match!")
    console.log("")
  }

  warnings += dsWarnings

  // ============================================================================
  // ProvisionThawRequest Referential Integrity
  // ============================================================================

  console.log("=== ProvisionThawRequest Referential Integrity ===")
  let trWarnings = 0

  // Build lookup sets for fast existence checks
  const provisionIds = new Set(provisions.map((p) => p.id))
  const spIds = new Set(serviceProviders.map((sp) => sp.id))
  const dsIds = new Set(dataServices.map((ds) => ds.id))

  for (const tr of thawRequests) {
    const issues: string[] = []

    if (!provisionIds.has(tr.provision.id)) {
      issues.push(`references non-existent Provision: ${tr.provision.id}`)
    }

    if (!spIds.has(tr.serviceProvider.id)) {
      issues.push(`references non-existent ServiceProvider: ${tr.serviceProvider.id}`)
    }

    if (!dsIds.has(tr.dataService.id)) {
      issues.push(`references non-existent DataService: ${tr.dataService.id}`)
    }

    if (issues.length > 0) {
      trWarnings++
      console.log(`WARNING: ${tr.id}`)
      for (const issue of issues) {
        console.log(`  ${issue}`)
      }
      console.log("")
    }
  }

  if (trWarnings === 0) {
    console.log("All ProvisionThawRequest references are valid!")
    console.log("")
  }

  warnings += trWarnings

  // ============================================================================
  // ProvisionFeeCut Referential Integrity
  // ============================================================================

  console.log("=== ProvisionFeeCut Referential Integrity ===")
  let fcWarnings = 0

  // Valid payment types (from IGraphPayments.PaymentTypes enum)
  const validPaymentTypes = new Set([0, 1, 2]) // QueryFee, IndexingFee, IndexingReward
  const MAX_FEE_CUT = 1000000n // 100% in PPM

  for (const fc of feeCuts) {
    const issues: string[] = []

    if (!provisionIds.has(fc.provision.id)) {
      issues.push(`references non-existent Provision: ${fc.provision.id}`)
    }

    if (!validPaymentTypes.has(fc.paymentType)) {
      issues.push(`invalid paymentType: ${fc.paymentType}`)
    }

    const feeCutValue = BigInt(fc.feeCut)
    if (feeCutValue < 0n || feeCutValue > MAX_FEE_CUT) {
      issues.push(`feeCut out of range [0, 1000000]: ${fc.feeCut}`)
    }

    if (issues.length > 0) {
      fcWarnings++
      console.log(`WARNING: ${fc.id}`)
      for (const issue of issues) {
        console.log(`  ${issue}`)
      }
      console.log("")
    }
  }

  if (fcWarnings === 0) {
    console.log("All ProvisionFeeCut references are valid!")
    console.log("")
  }

  warnings += fcWarnings

  // ============================================================================
  // Summary
  // ============================================================================

  console.log("=== Summary ===")
  if (warnings === 0) {
    console.log("All internal consistency checks passed!")
  } else {
    console.log(`Found ${warnings} warning(s)`)
  }

  return warnings > 0 ? 1 : 0
}

runValidation(main)
