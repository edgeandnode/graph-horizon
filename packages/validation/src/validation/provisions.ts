/**
 * Validates subgraph Provision entities against on-chain HorizonStaking.getProvision()
 * Also validates ServiceProvider.tokensProvisioned against on-chain state.
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:provisions <subgraph-url>
 */

import { getProvision, getServiceProvider } from "../onchain"
import { querySubgraph, formatGRT, getSubgraphUrl, printHeader, delay } from "./common"

interface SubgraphProvision {
  id: string
  serviceProvider: { id: string }
  verifier: string
  tokens: string
  tokensThawing: string
  maxVerifierCut: string
  thawingPeriod: string
  maxVerifierCutPending: string
  thawingPeriodPending: string
  lastParametersStagedAt: string
}

interface SubgraphServiceProvider {
  id: string
  tokensStaked: string
  tokensProvisioned: string
}

interface GraphNetwork {
  id: string
  tokensProvisioned: string
  countProvisions: number
}

function compareField(
  name: string,
  subgraphValue: bigint,
  onChainValue: bigint,
  isTokens = false
): { match: boolean; message?: string } {
  if (subgraphValue === onChainValue) {
    return { match: true }
  }
  const subgraphStr = isTokens ? formatGRT(subgraphValue) : subgraphValue.toString()
  const onChainStr = isTokens ? formatGRT(onChainValue) : onChainValue.toString()
  return {
    match: false,
    message: `  ${name}: subgraph=${subgraphStr}, chain=${onChainStr}`,
  }
}

async function main() {
  const subgraphUrl = getSubgraphUrl()
  printHeader(subgraphUrl)

  // Fetch GraphNetwork
  const networkData = await querySubgraph<{ graphNetwork: GraphNetwork }>(
    subgraphUrl,
    `{ graphNetwork(id: "0x01000000") { id tokensProvisioned countProvisions } }`
  )
  const graphNetwork = networkData.graphNetwork

  if (!graphNetwork) {
    console.error("GraphNetwork entity not found")
    process.exit(1)
  }

  console.log("=== GraphNetwork ===")
  console.log(`  countProvisions: ${graphNetwork.countProvisions}`)
  console.log(`  tokensProvisioned: ${formatGRT(BigInt(graphNetwork.tokensProvisioned))}`)
  console.log("")

  // Fetch all Provisions
  console.log("=== Fetching Provisions ===")
  const provisionData = await querySubgraph<{ provisions: SubgraphProvision[] }>(
    subgraphUrl,
    `{ provisions(first: 1000, orderBy: tokens, orderDirection: desc) {
      id
      serviceProvider { id }
      verifier
      tokens
      tokensThawing
      maxVerifierCut
      thawingPeriod
      maxVerifierCutPending
      thawingPeriodPending
      lastParametersStagedAt
    } }`
  )
  const provisions = provisionData.provisions

  console.log(`  Found ${provisions.length} provisions`)
  console.log("")

  // Validate count
  if (provisions.length !== graphNetwork.countProvisions) {
    console.log(
      `WARNING: Provision count mismatch - GraphNetwork says ${graphNetwork.countProvisions}, found ${provisions.length}`
    )
    console.log("")
  }

  // Validate sum of tokens
  const subgraphSum = provisions.reduce((sum, p) => sum + BigInt(p.tokens), 0n)
  if (subgraphSum.toString() !== graphNetwork.tokensProvisioned) {
    console.log(`WARNING: tokensProvisioned sum mismatch`)
    console.log(`  GraphNetwork.tokensProvisioned: ${formatGRT(BigInt(graphNetwork.tokensProvisioned))}`)
    console.log(`  Sum of provision tokens:        ${formatGRT(subgraphSum)}`)
    console.log("")
  }

  // Compare each Provision against on-chain
  console.log("=== Comparing Provisions against on-chain state ===")
  let provisionMismatches = 0
  let provisionMatches = 0

  for (const provision of provisions) {
    const onChain = await getProvision(provision.serviceProvider.id, provision.verifier)

    const fields = [
      compareField("tokens", BigInt(provision.tokens), onChain.tokens, true),
      compareField("tokensThawing", BigInt(provision.tokensThawing), onChain.tokensThawing, true),
      compareField("maxVerifierCut", BigInt(provision.maxVerifierCut), onChain.maxVerifierCut),
      compareField("thawingPeriod", BigInt(provision.thawingPeriod), onChain.thawingPeriod),
      compareField("maxVerifierCutPending", BigInt(provision.maxVerifierCutPending), onChain.maxVerifierCutPending),
      compareField("thawingPeriodPending", BigInt(provision.thawingPeriodPending), onChain.thawingPeriodPending),
    ]

    const mismatches = fields.filter((f) => !f.match)
    if (mismatches.length > 0) {
      provisionMismatches++
      console.log(`MISMATCH: ${provision.serviceProvider.id} -> ${provision.verifier}`)
      for (const m of mismatches) {
        console.log(m.message)
      }
      console.log("")
    } else {
      provisionMatches++
    }

    await delay()
  }

  // Fetch and validate ServiceProviders
  console.log("=== Validating ServiceProvider.tokensProvisioned ===")
  const spData = await querySubgraph<{ serviceProviders: SubgraphServiceProvider[] }>(
    subgraphUrl,
    `{ serviceProviders(first: 1000, where: { tokensProvisioned_gt: "0" }) { id tokensStaked tokensProvisioned } }`
  )
  const serviceProviders = spData.serviceProviders

  console.log(`  Found ${serviceProviders.length} service providers with provisions`)
  console.log("")

  let spMismatches = 0
  let spMatches = 0

  for (const sp of serviceProviders) {
    const onChain = await getServiceProvider(sp.id)

    const subgraphProvisioned = BigInt(sp.tokensProvisioned)
    if (subgraphProvisioned !== onChain.tokensProvisioned) {
      spMismatches++
      console.log(`MISMATCH: ${sp.id}`)
      console.log(`  tokensProvisioned: subgraph=${formatGRT(subgraphProvisioned)}, chain=${formatGRT(onChain.tokensProvisioned)}`)
      console.log("")
    } else {
      spMatches++
    }

    await delay()
  }

  // Summary
  console.log("=== Summary ===")
  console.log(`Provisions:`)
  console.log(`  Total:      ${provisions.length}`)
  console.log(`  Matches:    ${provisionMatches}`)
  console.log(`  Mismatches: ${provisionMismatches}`)
  console.log("")
  console.log(`ServiceProviders (tokensProvisioned):`)
  console.log(`  Total:      ${serviceProviders.length}`)
  console.log(`  Matches:    ${spMatches}`)
  console.log(`  Mismatches: ${spMismatches}`)

  const totalMismatches = provisionMismatches + spMismatches
  if (totalMismatches === 0) {
    console.log("")
    console.log("All provisions match on-chain state!")
  }

  process.exit(totalMismatches > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error("Error:", err)
  process.exit(1)
})
