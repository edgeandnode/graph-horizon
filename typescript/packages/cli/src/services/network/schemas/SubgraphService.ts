import { Schema } from "@effect/schema"

export const SubgraphService = Schema.Struct({
  minimumProvisionTokens: Schema.BigIntFromSelf,
  maximumProvisionTokens: Schema.BigIntFromSelf,
  minimumVerifierCut: Schema.BigIntFromSelf,
  maximumVerifierCut: Schema.BigIntFromSelf,
  minimumThawingPeriod: Schema.BigIntFromSelf,
  maximumThawingPeriod: Schema.BigIntFromSelf,
  maxPOIStaleness: Schema.BigIntFromSelf,
  delegationRatio: Schema.BigIntFromSelf,
  stakeToFeesRatio: Schema.BigIntFromSelf,
  curationCut: Schema.BigIntFromSelf
})

export const SubgraphServiceSubgraphResponse = Schema.Struct({
  dataServices: Schema.Array(Schema.Any),
  graphNetworks: Schema.Array(Schema.Any)
})

export type SubgraphService = Schema.Schema.Type<typeof SubgraphService>
export type SubgraphServiceSubgraphResponse = Schema.Schema.Type<typeof SubgraphServiceSubgraphResponse>
