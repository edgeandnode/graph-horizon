import { Schema } from "@effect/schema"

export const GraphNetwork = Schema.Struct({
  maxThawingPeriod: Schema.BigIntFromSelf
})

export const GraphNetworkSubgraphResponse = Schema.Struct({
  graphNetworks: Schema.Array(Schema.Any)
})

export type GraphNetwork = Schema.Schema.Type<typeof GraphNetwork>
export type GraphNetworkSubgraphResponse = Schema.Schema.Type<typeof GraphNetworkSubgraphResponse>
