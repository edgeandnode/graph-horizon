import * as Command from "@effect/cli/Command"
import { Console, Effect } from "effect"
import { NetworkService } from "../services/network/NetworkService.js"
import { Display } from "../utils/Display.js"

export const protocol = Command.make(
  "protocol",
  {},
  () =>
    Effect.gen(function*() {
      yield* Display.header("Graph Protocol Network")

      const network = yield* NetworkService
      const horizonResult = yield* network.getGraphNetwork()
      const subgraphServiceResult = yield* network.getSubgraphService()
      const disputeManagerResult = yield* network.getDisputeManager()

      const allMismatches = [
        ...horizonResult.mismatches,
        ...subgraphServiceResult.mismatches,
        ...disputeManagerResult.mismatches
      ]

      yield* Display.section("Graph Horizon Details")
      yield* Display.bigNumber("Max Thawing Period", horizonResult.data.maxThawingPeriod)
      yield* Console.log("")

      yield* Display.section("Subgraph Service Details")
      yield* Display.tokenRangeValue(
        "Provision Token Range",
        subgraphServiceResult.data.minimumProvisionTokens,
        subgraphServiceResult.data.maximumProvisionTokens
      )
      yield* Display.ppmRangeValue(
        "Verifier Cut Range",
        subgraphServiceResult.data.minimumVerifierCut,
        subgraphServiceResult.data.maximumVerifierCut
      )
      yield* Display.timeRangeValue(
        "Thawing Period Range",
        subgraphServiceResult.data.minimumThawingPeriod,
        subgraphServiceResult.data.maximumThawingPeriod
      )
      yield* Display.timeValue("Max POI Staleness", subgraphServiceResult.data.maxPOIStaleness)
      yield* Display.bigNumber("Delegation Ratio", subgraphServiceResult.data.delegationRatio)
      yield* Display.bigNumber("Stake to Fees Ratio", subgraphServiceResult.data.stakeToFeesRatio)
      yield* Display.ppmValue("Curation Cut", subgraphServiceResult.data.curationCut)

      yield* Display.section("Dispute Manager Details")
      yield* Display.timeValue("Dispute Period", disputeManagerResult.data.disputePeriod)
      yield* Display.ppmValue("Fisherman Reward Cut", disputeManagerResult.data.fishermanRewardCut)
      yield* Display.tokenValue("Dispute Deposit", disputeManagerResult.data.disputeDeposit)

      yield* Display.divider()

      if (allMismatches.length > 0) {
        yield* Display.error(`⚠️  CRITICAL: Found ${allMismatches.length} data mismatch(es) between RPC and Subgraph!`)
        for (const mismatch of allMismatches) {
          yield* Display.warning(`${mismatch.key}`)
          yield* Display.keyValue("  RPC Value", String(mismatch.rpcValue))
          yield* Display.keyValue("  Subgraph Value", String(mismatch.subgraphValue))
        }
      } else {
        yield* Display.success("All data sources match - validation successful!")
      }
      yield* Display.divider()
    }).pipe(
      Effect.catchAll((error) => {
        return Effect.gen(function*() {
          yield* Display.error(`Failed to fetch protocol data: ${error}`)
          return yield* Console.error(error)
        })
      })
    )
).pipe(
  Command.withDescription("Fetch protocol data with automatic RPC/Subgraph validation")
)
