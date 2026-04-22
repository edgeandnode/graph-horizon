import * as Command from "@effect/cli/Command"
import { Console, Effect, Layer } from "effect"
import { config, indexer, migration, protocol } from "./commands/index.js"
import { ConfigServiceLive } from "./services/ConfigService.js"
import { NetworkRPCLive } from "./services/network/NetworkRPC.js"
import { NetworkServiceLive } from "./services/network/NetworkService.js"
import { NetworkSubgraphlive } from "./services/network/NetworkSubgraph.js"
import { QoSSubgraphLive } from "./services/qos/QoSSubgraph.js"

const AppLayer = Layer.mergeAll(
  ConfigServiceLive,
  NetworkSubgraphlive.pipe(Layer.provide(ConfigServiceLive)),
  NetworkRPCLive.pipe(Layer.provide(ConfigServiceLive)),
  QoSSubgraphLive.pipe(Layer.provide(ConfigServiceLive)),
  NetworkServiceLive.pipe(
    Layer.provide(
      Layer.mergeAll(
        NetworkRPCLive.pipe(Layer.provide(ConfigServiceLive)),
        NetworkSubgraphlive.pipe(Layer.provide(ConfigServiceLive))
      )
    )
  )
)

const command = Command.make("horizon", {
  args: {}
}).pipe(
  Command.withDescription("Graph Horizon CLI application - The Graph protocol at a glance."),
  Command.withSubcommands([config, protocol, indexer, migration])
)

export const run = (args: ReadonlyArray<string>) =>
  Command.run(command, {
    name: "Graph Horizon",
    version: "0.0.0"
  })(args).pipe(
    Effect.provide(AppLayer),
    Effect.catchAll((error) =>
      Console.error(error).pipe(
        Effect.zipRight(Effect.fail(error))
      )
    )
  )
