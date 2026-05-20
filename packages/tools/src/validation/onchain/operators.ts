/**
 * Validates subgraph OperatorAuthorization entities against on-chain HorizonStaking.isAuthorized()
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:onchain:operators <subgraph-url>
 */

import { isAuthorized } from "../../onchain"
import {
  querySubgraph,
  getSubgraphUrlFromArgs,
  printHeader,
  delay,
  runValidation,
  printValidationSummary,
  type ValidationResult,
} from "../../common"

interface OperatorAuthorization {
  id: string
  operator: { id: string }
  serviceProvider: { id: string } | null
  dataService: { id: string } | null
  allowed: boolean
}

async function main(): Promise<number> {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl)

  // Fetch all OperatorAuthorizations
  console.log("=== Fetching OperatorAuthorizations ===")
  const authData = await querySubgraph<{ operatorAuthorizations: OperatorAuthorization[] }>(
    subgraphUrl,
    `{ operatorAuthorizations(first: 1000) {
      id
      operator { id }
      serviceProvider { id }
      dataService { id }
      allowed
    } }`
  )
  const authorizations = authData.operatorAuthorizations

  // Filter to only allowed authorizations (revoked ones should return false on-chain)
  const allowedAuths = authorizations.filter((a) => a.allowed)
  const revokedAuths = authorizations.filter((a) => !a.allowed)

  console.log(`  Found ${authorizations.length} authorizations (${allowedAuths.length} allowed, ${revokedAuths.length} revoked)`)
  console.log("")

  // Compare each OperatorAuthorization against on-chain
  console.log("=== Comparing OperatorAuthorizations against on-chain state ===")
  let mismatches = 0
  let matches = 0
  const skippedEntities: { id: string; reason: string }[] = []

  for (const auth of authorizations) {
    // Skip if serviceProvider or dataService entity doesn't exist yet
    if (!auth.serviceProvider || !auth.dataService) {
      const missing = []
      if (!auth.serviceProvider) missing.push("ServiceProvider")
      if (!auth.dataService) missing.push("DataService")
      skippedEntities.push({ id: auth.id, reason: `${missing.join(", ")} entity doesn't exist` })
      continue
    }

    const onChainAllowed = await isAuthorized(
      auth.serviceProvider.id,
      auth.dataService.id,
      auth.operator.id
    )

    if (auth.allowed !== onChainAllowed) {
      mismatches++
      console.log(
        `MISMATCH: operator=${auth.operator.id} sp=${auth.serviceProvider.id} ds=${auth.dataService.id}`
      )
      console.log(`  subgraph: allowed=${auth.allowed}`)
      console.log(`  on-chain: allowed=${onChainAllowed}`)
      console.log("")
    } else {
      matches++
    }

    await delay()
  }

  if (skippedEntities.length > 0) {
    console.log(`=== Skipped ${skippedEntities.length} authorizations ===`)
    for (const skipped of skippedEntities) {
      console.log(`  ${skipped.id}: ${skipped.reason}`)
    }
    console.log("")
  }

  // Summary
  const results: ValidationResult[] = [{ label: "OperatorAuthorizations", total: authorizations.length, matches, mismatches }]
  printValidationSummary(results)

  if (mismatches === 0) {
    console.log("All operator authorizations match on-chain state!")
  }

  return mismatches > 0 ? 1 : 0
}

runValidation(main)
