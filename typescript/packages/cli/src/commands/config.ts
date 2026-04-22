import * as Command from "@effect/cli/Command"
import { Console, Effect } from "effect"
import { ConfigService } from "../services/ConfigService.js"
import { Display } from "../utils/Display.js"

export const config = Command.make("config", {
  args: {}
}).pipe(
  Command.withDescription("Show the current configuration."),
  Command.withHandler(() =>
    Effect.gen(function*() {
      const config = yield* ConfigService
      yield* Display.section("Configuration")
      yield* Console.log(`RPC URL: ${config.rpcUrl}`)
      yield* Console.log(`Subgraph URL: ${config.subgraphUrl}`)
      yield* Console.log(`Studio API Key: ${config.studioApiKey}`)
    })
  )
)
