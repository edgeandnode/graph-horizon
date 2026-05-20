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
  provision: {
    id: string
    serviceProvider: { id: string }
    dataService: { id: string }
  }
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
      provision {
        id
        serviceProvider { id }
        dataService { id }
      }
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

  for (const feeCut of feeCuts) {
    const onChainFeeCut = await getDelegationFeeCut(
      feeCut.provision.serviceProvider.id,
      feeCut.provision.dataService.id,
      feeCut.paymentType
    )

    const fields = [compareField("feeCut", BigInt(feeCut.feeCut), onChainFeeCut)]

    const fieldMismatches = fields.filter((f) => !f.match)
    if (fieldMismatches.length > 0) {
      mismatches++
      console.log(
        `MISMATCH: ${feeCut.provision.serviceProvider.id} -> ${feeCut.provision.dataService.id} (paymentType=${feeCut.paymentType})`
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

  // Summary
  const results: ValidationResult[] = [{ label: "ProvisionFeeCuts", total: feeCuts.length, matches, mismatches }]
  printValidationSummary(results)

  if (mismatches === 0) {
    console.log("All fee cuts match on-chain state!")
  }

  return mismatches > 0 ? 1 : 0
}

runValidation(main)
