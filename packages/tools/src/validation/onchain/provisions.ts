/**
 * Validates subgraph Provision entities against on-chain HorizonStaking.getProvision()
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:onchain:provisions <subgraph-url>
 */

import { getProvision } from "../../onchain"
import {
  querySubgraph,
  getSubgraphUrlFromArgs,
  printHeader,
  delay,
  runValidation,
  compareField,
  printValidationSummary,
  type ValidationResult,
} from "../../common"

interface Provision {
  id: string
  serviceProvider: { id: string }
  verifier: string
  tokens: string
  tokensThawing: string
  maxVerifierCut: string
  thawingPeriod: string
  maxVerifierCutPending: string
  thawingPeriodPending: string
}

async function main(): Promise<number> {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl)

  // Fetch all Provisions
  console.log("=== Fetching Provisions ===")
  const provisionData = await querySubgraph<{ provisions: Provision[] }>(
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
    } }`
  )
  const provisions = provisionData.provisions

  console.log(`  Found ${provisions.length} provisions`)
  console.log("")

  // Compare each Provision against on-chain
  console.log("=== Comparing Provisions against on-chain state ===")
  let mismatches = 0
  let matches = 0

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

    const fieldMismatches = fields.filter((f) => !f.match)
    if (fieldMismatches.length > 0) {
      mismatches++
      console.log(`MISMATCH: ${provision.serviceProvider.id} -> ${provision.verifier}`)
      for (const m of fieldMismatches) {
        console.log(m.message)
      }
      console.log("")
    } else {
      matches++
    }

    await delay()
  }

  // Summary
  const results: ValidationResult[] = [
    { label: "Provisions", total: provisions.length, matches, mismatches },
  ]
  printValidationSummary(results)

  if (mismatches === 0) {
    console.log("All provisions match on-chain state!")
  }

  return mismatches > 0 ? 1 : 0
}

runValidation(main)
