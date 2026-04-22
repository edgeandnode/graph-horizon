import * as Args from "@effect/cli/Args"
import * as Command from "@effect/cli/Command"
import { Console, Effect } from "effect"
import { ConfigService } from "../services/ConfigService.js"
import { NetworkService } from "../services/network/NetworkService.js"
import { Display } from "../utils/Display.js"
import { fetchIndexerVersion } from "./migration.js"

export const indexer = Command.make(
  "indexer",
  {
    address: Args.text({ name: "address" }).pipe(
      Args.withDescription("The indexer address to query")
    )
  },
  ({ address }) =>
    Effect.gen(function*() {
      yield* Display.header("Graph Protocol Indexer")

      const config = yield* ConfigService
      const network = yield* NetworkService
      const indexerResult = yield* network.getIndexer(address.toLowerCase())
      const version = yield* fetchIndexerVersion(indexerResult.data).pipe(
        Effect.map((response) => JSON.parse(response).version),
        Effect.catchAll(() => Effect.succeed("Unreachable"))
      )

      const allMismatches = [
        ...indexerResult.mismatches
      ]

      yield* Display.section("Indexer Details")
      yield* Display.keyValue("Address", indexerResult.data.id)

      yield* Display.section("Stake Details")
      yield* Display.totalTokenValue("Staked Tokens", indexerResult.data.stakedTokens)
      yield* Display.tokenValue("• Legacy Tokens Locked", indexerResult.data.tokensLocked)
      yield* Display.tokenValue("• Legacy Tokens Allocated", indexerResult.data.legacyTokensAllocated)
      yield* Display.tokenValue("• Idle Tokens", indexerResult.data.idleTokens)
      yield* Display.tokenValue("• Provisioned Tokens", indexerResult.data.provisionedTokens)

      yield* Display.section("Subgraph Service - Provisioned stake")
      yield* Display.totalTokenValue(
        "Total Tokens",
        indexerResult.data.provisionedTokens + indexerResult.data.delegatedTokens
      )
      yield* Display.tokenValue("• Provisioned Tokens", indexerResult.data.provisionedTokens)
      yield* Display.tokenValue("• Delegated Tokens", indexerResult.data.delegatedTokens)
      yield* Display.totalTokenValue(
        "Total Tokens",
        indexerResult.data.provisionedTokens + indexerResult.data.delegatedTokens
      )
      yield* Display.tokenValue("• Available Tokens", indexerResult.data.availableTokens)
      yield* Display.tokenValue("• Thawing Tokens", indexerResult.data.thawingTokens)
      yield* Display.tokenValue("• Delegated Thawing Tokens", indexerResult.data.delegatedThawingTokens)

      yield* Display.section("Subgraph Service - Available stake utilization")
      yield* Display.totalTokenValue("Allocation tracker", indexerResult.data.availableTokens)
      yield* Display.tokenValue(
        "• Tokens free",
        indexerResult.data.availableTokens - indexerResult.data.allocatedTokens
      )
      yield* Display.tokenValue("• Allocated Tokens", indexerResult.data.allocatedTokens)
      yield* Display.totalTokenValue("Query fee tracker", indexerResult.data.availableTokens)
      yield* Display.tokenValue(
        "• Tokens free",
        indexerResult.data.tokensFree
      )
      yield* Display.tokenValue("• Stake claims Tokens", indexerResult.data.feesProvisionedTokens)

      yield* Display.section("Escrow Account Details")
      yield* Display.keyValue("• Gateway Payer", config.gatewayPayer)
      yield* Display.tokenValue("• Balance", indexerResult.data.escrowAccountBalance)
      yield* Display.tokenValue("• Tokens Thawing", indexerResult.data.escrowAccountTokensThawing)

      yield* Display.section("Subgraph Service - Registration Details")
      yield* Display.keyValue("URL", indexerResult.data.url)
      yield* Display.keyValue("Indexer Service Version", version)
      yield* Display.keyValue("Geo Hash", indexerResult.data.geoHash)
      yield* Display.keyValue("Rewards Destination", indexerResult.data.rewardsDestination)
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
