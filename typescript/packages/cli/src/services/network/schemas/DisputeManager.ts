import { Schema } from "@effect/schema"

export const DisputeManager = Schema.Struct({
  disputePeriod: Schema.BigIntFromSelf,
  fishermanRewardCut: Schema.BigIntFromSelf,
  disputeDeposit: Schema.BigIntFromSelf
})

export const DisputeManagerSubgraphResponse = Schema.Struct({
  graphNetworks: Schema.Array(Schema.Any)
})

export type DisputeManager = Schema.Schema.Type<typeof DisputeManager>
export type DisputeManagerSubgraphResponse = Schema.Schema.Type<typeof DisputeManagerSubgraphResponse>
