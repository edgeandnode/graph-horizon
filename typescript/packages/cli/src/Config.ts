import { Schema } from "@effect/schema"
import { Config } from "effect"

export const AppConfig = Schema.Struct({
  rpcUrl: Schema.NonEmptyString.pipe(
    Schema.annotations({
      description: "Ethereum RPC endpoint URL",
      examples: ["https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY"]
    })
  ),
  subgraphUrl: Schema.NonEmptyString.pipe(
    Schema.annotations({
      description: "The Graph subgraph endpoint URL (including API key if needed)",
      examples: ["https://api.thegraph.com/subgraphs/name/..."]
    })
  ),
  qosSubgraphUrl: Schema.optional(Schema.NonEmptyString),
  studioApiKey: Schema.NonEmptyString.pipe(
    Schema.annotations({
      description: "The Graph Studio API key",
      examples: ["ca14fcc3d96ae6e16365f4d585481de6"]
    })
  ),
  gatewayPayer: Schema.NonEmptyString.pipe(
    Schema.annotations({
      description: "The address of the gateway payer",
      examples: ["0x0000000000000000000000000000000000000123"]
    })
  )
})
export type AppConfig = Schema.Schema.Type<typeof AppConfig>

export const loadConfig = Config.all({
  rpcUrl: Config.string("RPC_URL"),
  subgraphUrl: Config.string("SUBGRAPH_URL"),
  qosSubgraphUrl: Config.string("QOS_SUBGRAPH_URL").pipe(
    Config.map((s) => s || undefined),
    Config.withDefault(undefined)
  ),
  studioApiKey: Config.string("STUDIO_API_KEY"),
  gatewayPayer: Config.string("GATEWAY_PAYER")
})
