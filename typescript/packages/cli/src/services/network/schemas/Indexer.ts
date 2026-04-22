import { Schema } from "@effect/schema"

export const Indexer = Schema.Struct({
  id: Schema.String,
  url: Schema.String,
  geoHash: Schema.String,
  rewardsDestination: Schema.String,
  stakedTokens: Schema.BigIntFromSelf,
  delegatedTokens: Schema.BigIntFromSelf,
  delegatedThawingTokens: Schema.BigIntFromSelf,
  totalProvisionedTokens: Schema.BigIntFromSelf,
  legacyTokensAllocated: Schema.BigIntFromSelf,
  tokensLocked: Schema.BigIntFromSelf,
  idleTokens: Schema.BigIntFromSelf,
  availableTokens: Schema.BigIntFromSelf,
  provisionedTokens: Schema.BigIntFromSelf,
  allocatedTokens: Schema.BigIntFromSelf,
  feesProvisionedTokens: Schema.BigIntFromSelf,
  thawingTokens: Schema.BigIntFromSelf,
  tokensFree: Schema.BigIntFromSelf,
  escrowAccountBalance: Schema.BigIntFromSelf,
  escrowAccountTokensThawing: Schema.BigIntFromSelf,
  escrowAccountThawEndTimestamp: Schema.BigIntFromSelf
})

export const IndexerSubgraphResponse = Schema.Struct({
  indexers: Schema.Array(Schema.Any),
  provisions: Schema.Array(Schema.Any),
  paymentsEscrowAccounts: Schema.Array(Schema.Any)
})

export type Indexer = Schema.Schema.Type<typeof Indexer>
export type IndexerSubgraphResponse = Schema.Schema.Type<typeof IndexerSubgraphResponse>
