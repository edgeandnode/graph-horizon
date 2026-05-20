/**
 * Validates subgraph ProvisionFeeCut entities against on-chain HorizonStaking.getDelegationFeeCut()
 *
 * Usage: NETWORK=arbitrum-one pnpm validate:onchain:fee-cuts <subgraph-url>
 */

import { getDelegationFeeCut } from "../../onchain"
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

interface ProvisionFeeCut {
  id: string
  serviceProvider: { id: string } | null
  dataService: { id: string } | null
  paymentType: number
  feeCut: string
}

async function main(): Promise<number> {
  const subgraphUrl = getSubgraphUrlFromArgs()
  printHeader(subgraphUrl)

  // Fetch all ProvisionFeeCuts
  console.log("=== Fetching ProvisionFeeCuts ===")
  const feeCutData = await querySubgraph<{ provisionFeeCuts: ProvisionFeeCut[] }>(
    subgraphUrl,
    `{ provisionFeeCuts(first: 1000) {
      id
      serviceProvider { id }
      dataService { id }
      paymentType
      feeCut
    } }`
  )
  const feeCuts = feeCutData.provisionFeeCuts

  console.log(`  Found ${feeCuts.length} fee cuts`)
  console.log("")

  // Compare each ProvisionFeeCut against on-chain
  console.log("=== Comparing ProvisionFeeCuts against on-chain state ===")
  let mismatches = 0
  let matches = 0
  const skippedEntities: { id: string; reason: string }[] = []

  for (const feeCut of feeCuts) {
    // Skip if serviceProvider or dataService entity doesn't exist yet
    if (!feeCut.serviceProvider || !feeCut.dataService) {
      const missing = []
      if (!feeCut.serviceProvider) missing.push("ServiceProvider")
      if (!feeCut.dataService) missing.push("DataService")
      skippedEntities.push({ id: feeCut.id, reason: `${missing.join(", ")} entity doesn't exist` })
      continue
    }

    const onChainFeeCut = await getDelegationFeeCut(
      feeCut.serviceProvider.id,
      feeCut.dataService.id,
      feeCut.paymentType
    )

    const fields = [compareField("feeCut", BigInt(feeCut.feeCut), onChainFeeCut)]

    const fieldMismatches = fields.filter((f) => !f.match)
    if (fieldMismatches.length > 0) {
      mismatches++
      console.log(
        `MISMATCH: ${feeCut.serviceProvider.id} -> ${feeCut.dataService.id} (paymentType=${feeCut.paymentType})`
      )
      for (const m of fieldMismatches) {
        console.log(m.message)
      }
      console.log("")
    } else {
      matches++
    }

    await delay()
  }

  if (skippedEntities.length > 0) {
    console.log(`=== Skipped ${skippedEntities.length} fee cuts ===`)
    for (const skipped of skippedEntities) {
      console.log(`  ${skipped.id}: ${skipped.reason}`)
    }
    console.log("")
  }

  // Summary
  const results: ValidationResult[] = [{ label: "ProvisionFeeCuts", total: feeCuts.length, matches, mismatches }]
  printValidationSummary(results)

  if (mismatches === 0) {
    console.log("All fee cuts match on-chain state!")
  }

  return mismatches > 0 ? 1 : 0
}

runValidation(main)
