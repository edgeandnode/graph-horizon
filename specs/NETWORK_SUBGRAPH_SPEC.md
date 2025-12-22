# Network Subgraph Specification

A subgraph for indexing The Graph protocol's core staking and payments infrastructure.

## Overview

This subgraph indexes the Horizon protocol contracts to provide queryable data about:
- Service provider stake and provisions
- Delegations and delegation pools
- Thaw requests (deprovisioning and undelegating)
- Payment collections and escrow
- Payment collectors: GraphTally
- Operators

The subgraph is **data-service agnostic** - it captures the concept of data services (verifiers) but contains nothing specific to any particular data service. Each data service can create their own subgraph for service-specific data.

## Data Sources

### Contracts

| Contract | Purpose |
|----------|---------|
| `HorizonStaking` | Core staking, provisions, delegations, slashing |
| `GraphPayments` | Payment distribution |
| `PaymentsEscrow` | Escrow account management |
| `GraphTallyCollector` | RAV-based payment collection and signer authorization |

## Entities

### GraphNetwork

Singleton entity for protocol-wide aggregates and parameters.

```graphql
type GraphNetwork @entity {
  id: ID!

  # Counts
  "Active service providers"
  countServiceProviders: Int!
  "Active delegators"
  countDelegators: Int!
  "Active data services"
  countDataServices: Int!
  "Active provisions"
  countProvisions: Int!

  # Stake aggregates
  "Total tokens staked by service providers"
  tokensStaked: BigInt!
  "Total tokens delegated"
  tokensDelegated: BigInt!
  "Total tokens currently thawing from provisions"
  tokensThawingFromProvisions: BigInt!
  "Total tokens currently thawing from delegation pools"
  tokensThawingFromDelegationPools: BigInt!

  # Slashing aggregates
  "Total slash events"
  countSlashEvents: Int!
  "Total tokens slashed"
  tokensSlashed: BigInt!
  "Total tokens slashed from provisions"
  tokensSlashedFromProvisions: BigInt!
  "Total tokens slashed from delegation pools"
  tokensSlashedFromDelegationPools: BigInt!

  # Payment collection aggregates
  "Total tokens collected"
  tokensCollected: BigInt!
  "Total tokens burnt as protocol tax"
  tokensCollectedByProtocolTax: BigInt!
  "Total tokens collected by service providers"
  tokensCollectedByServiceProviders: BigInt!
  "Total tokens collected by delegators"
  tokensCollectedByDelegators: BigInt!
  "Total tokens collected by data services"
  tokensCollectedByDataServices: BigInt!

  # Payment escrow aggregates
  "Total tokens held in escrow"
  tokensEscrowed: BigInt!
  "Total tokens currently thawing in escrow"
  tokensThawingFromEscrow: BigInt!

  # Protocol parameters (mutable)
  "Max allowed thawing period (seconds)"
  maxThawingPeriod: BigInt!
  "Delegation slashing status"
  delegationSlashingEnabled: Boolean!

  # Protocol parameters (immutable)
  "Protocol tax on payments collected (PPM)"
  protocolPaymentCut: BigInt!
  "Withdrawal thawing period for payments escrow (seconds)"
  escrowThawingPeriod: BigInt!
  "Signer revocation thawing period for payments escrow(seconds)"
  revokeSignerThawingPeriod: BigInt!
}
```

### ServiceProvider

An account that stakes GRT to provide services.

```graphql
type ServiceProvider @entity {
  id: ID!

  # Relationships
  provisions: [Provision!]! @derivedFrom(field: "serviceProvider")
  operatorAuthorizations: [OperatorAuthorization!]! @derivedFrom(field: "serviceProvider")

  # Counts
  "Active provisions"
  countProvisions: Int!
  "Active delegators"
  countDelegators: Int!
  "Active operators"
  countOperators: Int!
  "Pending thaw requests for the service provider"
  countThawRequests: Int!
  "Amount of times slashed"
  countSlashEvents: Int!

  # Stake
  "Tokens staked by the service provider"
  tokensStaked: BigInt!
  "Tokens provisioned to data services"
  tokensProvisioned: BigInt!
  "Tokens that are not locked in provisions"
  tokensIdle: BigInt!
  "Tokens currently thawing from provisions"
  tokensThawing: BigInt!

  # Delegation
  "Total tokens delegated to this service provider"
  tokensDelegated: BigInt!
  "Tokens currently thawing from delegation pools"
  tokensDelegatedThawing: BigInt!

  # Slashing
  "Total tokens slashed"
  tokensSlashed: BigInt!
  "Tokens slashed from provisions"
  tokensSlashedFromProvisions: BigInt!
  "Tokens slashed from delegation pools"
  tokensSlashedFromDelegationPools: BigInt!

  # Payments
  "Total tokens collected"
  tokensCollected: BigInt!
}
```

### DataService

Represents a data service (verifier) in the protocol.

```graphql
type DataService @entity {
  id: ID!

  # Relationships
  provisions: [Provision!]! @derivedFrom(field: "dataService")

  # Counts
  "Active service providers"
  countServiceProviders: Int!
  "Active delegators"
  countDelegators: Int!
  "Pending provision thaw requests"
  countThawRequestsProvision: Int!
  "Pending delegation thaw requests"
  countThawRequestsDelegation: Int!
  "Amount of times slashed"
  countSlashEvents: Int!

  # Tokens
  "Total tokens provisioned"
  tokensProvisioned: BigInt!
  "Total tokens delegated"
  tokensDelegated: BigInt!
  "Tokens currently thawing from provisions"
  tokensThawingFromProvisions: BigInt!
  "Tokens currently thawing from delegation pools"
  tokensThawingFromDelegationPools: BigInt!
  "Total tokens slashed"
  tokensSlashed: BigInt!
  "Total tokens collected"
  tokensCollected: BigInt!

  # Parameters
  "Max delegation multiplier on service provider stake"
  delegationRatio: BigInt!
  "Minimum tokens required for a provision"
  minProvisionTokens: BigInt!
  "Maximum tokens allowed for a provision"
  maxProvisionTokens: BigInt!
  "Minimum verifier cut (PPM)"
  minVerifierCut: BigInt!
  "Maximum verifier cut (PPM)"
  maxVerifierCut: BigInt!
  "Minimum thawing period (seconds)"
  minThawingPeriod: BigInt!
  "Maximum thawing period (seconds)"
  maxThawingPeriod: BigInt!
}
```

### Provision

Stake allocated by a service provider to a specific data service.

```graphql
type Provision @entity {
  id: ID!

  # References
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!
  "Delegation pool"
  delegationPool: DelegationPool!

  # Relationships
  thawRequests: [ThawRequest!]! @derivedFrom(field: "provision")

  # Counts
  "Active delegators"
  countDelegators: Int!
  "Pending thaw requests"
  countThawRequests: Int!
  "Amount of times slashed"
  countSlashEvents: Int!

  # Tokens
  "Tokens in provision"
  tokens: BigInt!
  "Tokens currently thawing"
  tokensThawing: BigInt!
  "Shares representing thawing tokens"
  sharesThawing: BigInt!
  "Total tokens delegated"
  tokensDelegated: BigInt!
  "Total tokens slashed"
  tokensSlashed: BigInt!
  "Total tokens collected"
  tokensCollected: BigInt!

  # Parameters
  "Max verifier reward on slash (PPM)"
  maxVerifierCut: BigInt!
  "Thawing period for deprovisioning stake (seconds)"
  thawingPeriod: BigInt!

  # Staged parameters
  "Pending max verifier cut (PPM)"
  maxVerifierCutPending: BigInt!
  "Pending thawing period (seconds)"
  thawingPeriodPending: BigInt!
  "Timestamp when parameters were staged"
  lastParametersStagedAt: BigInt!

  # Fee cuts
  "Query fee cut for delegators (PPM)"
  queryFeeCut: BigInt!
  "Indexing fee cut for delegators (PPM)"
  indexingFeeCut: BigInt!
  "Indexing reward cut for delegators (PPM)"
  indexingRewardCut: BigInt!

  # State
  "Thawing nonce - incremented on slash to invalidate pending thaw requests"
  thawingNonce: BigInt!
}
```

### DelegationPool

Aggregate delegation pool for a provision.

```graphql
type DelegationPool @entity {
  id: ID!

  # References
  "Provision"
  provision: Provision!

  # Relationships
  delegations: [Delegation!]! @derivedFrom(field: "pool")

  # Counts
  "Active delegators"
  countDelegators: Int!
  "Pending thaw requests"
  countThawRequests: Int!
  "Amount of times slashed"
  countSlashEvents: Int!

  # Tokens
  "Total delegated tokens"
  tokens: BigInt!
  "Total shares issued"
  shares: BigInt!
  "Tokens being undelegated"
  tokensThawing: BigInt!
  "Shares representing thawing"
  sharesThawing: BigInt!
  "Total tokens slashed"
  tokensSlashed: BigInt!
  "Total tokens collected by delegators"
  tokensCollected: BigInt!

  # State
  "Thawing nonce - incremented on slash to invalidate pending thaw requests"
  thawingNonce: BigInt!
}
```

### Delegator

An account that delegates tokens to service providers.

```graphql
type Delegator @entity {
  id: ID!

  # Relationships
  delegations: [Delegation!]! @derivedFrom(field: "delegator")

  # Counts
  "Active delegations"
  countDelegations: Int!
  "Pending thaw requests"
  countThawRequests: Int!

  # Tokens
  "Total tokens delegated"
  tokensDelegated: BigInt!
  "Tokens currently thawing"
  tokensThawing: BigInt!
  "Total tokens collected"
  tokensCollected: BigInt!
}
```

### Delegation

Individual delegator's stake in a delegation pool.

```graphql
type Delegation @entity {
  id: ID!

  # References
  "Delegator"
  delegator: Delegator!
  "Delegation pool"
  pool: DelegationPool!
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # Relationships
  thawRequests: [ThawRequest!]! @derivedFrom(field: "delegation")

  # Counts
  "Pending thaw requests"
  countThawRequests: Int!

  # Tokens
  "Tokens delegated - note that this does not represent current delegation valuation"
  tokensDelegated: BigInt!
  "Delegator's shares in pool"
  shares: BigInt!
  "Tokens currently thawing"
  tokensThawing: BigInt!
  "Tokens collected by this delegator"
  tokensCollected: BigInt!
}
```

### ThawRequest

Pending deprovision or undelegate request.

```graphql
enum ThawRequestType {
  PROVISION
  DELEGATION
}

type ThawRequest @entity {
  id: ID!

  # Type
  "Thaw request type"
  type: ThawRequestType!

  # References
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!
  "Owner address - service provider (provision) or delegator (delegation)"
  owner: Bytes!
  "Provision - for provision thaws"
  provision: Provision
  "Delegation - for delegation thaws"
  delegation: Delegation

  # State
  "Shares being thawed"
  shares: BigInt!
  "Timestamp when thaw completes"
  thawingUntil: BigInt!
  "Thawing nonce"
  thawingNonce: BigInt!

  # Status
  "False if invalidated by slashing"
  valid: Boolean!
  "True when tokens withdrawn"
  fulfilled: Boolean!
}
```

### Operator

An operator account that can be authorized to act on behalf of service providers.

```graphql
type Operator @entity {
  id: ID!

  # Relationships
  authorizations: [OperatorAuthorization!]! @derivedFrom(field: "operator")

  # Counts
  "Active authorizations"
  countAuthorizations: Int!
}
```

### OperatorAuthorization

Authorization for an operator to act on behalf of a service provider on a specific data service.

```graphql
type OperatorAuthorization @entity {
  id: ID!

  # References
  "Operator"
  operator: Operator!
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # State
  "Current authorization status"
  allowed: Boolean!
}
```

### EscrowAccount

Escrow balance for a payer-collector-receiver tuple.

```graphql
type EscrowAccount @entity {
  id: ID!

  # References
  "Payer address"
  payer: Bytes!
  "Collector address"
  collector: Bytes!
  "Receiver address"
  receiver: Bytes!

  # Tokens
  "Available tokens"
  tokens: BigInt!
  "Tokens currently thawing"
  tokensThawing: BigInt!
  "Timestamp when thawing completes (0 if not thawing)"
  thawEndTimestamp: BigInt!
}
```

### PaymentCollection

Record of a payment distribution event.

```graphql
enum PaymentType {
  QUERY_FEE
  INDEXING_FEE
  INDEXING_REWARDS
}

type PaymentCollection @entity {
  id: ID!

  # References
  "Payer address"
  payer: Bytes!
  "Receiver address"
  receiver: Bytes!
  "Data service"
  dataService: DataService!

  # Payment details
  "Payment type"
  paymentType: PaymentType!
  "Total payment amount"
  tokens: BigInt!

  # Distribution
  "Protocol tax (burned)"
  tokensProtocol: BigInt!
  "Data service cut"
  tokensDataService: BigInt!
  "Delegation pool rewards"
  tokensDelegationPool: BigInt!
  "Receiver's share"
  tokensReceiver: BigInt!
  "Where receiver tokens went"
  receiverDestination: Bytes!
}
```

### GraphTallySigner

An account authorized to sign RAVs on behalf of payers.

```graphql
type GraphTallySigner @entity {
  id: ID!

  # Relationships
  authorizations: [GraphTallySignerAuthorization!]! @derivedFrom(field: "signer")

  # Counts
  "Active authorizations"
  countAuthorizations: Int!
}
```

### GraphTallySignerAuthorization

Authorization for a signer to sign RAVs on behalf of a payer.

```graphql
type GraphTallySignerAuthorization @entity {
  id: ID!

  # References
  "Signer"
  signer: GraphTallySigner!
  "Payer address"
  payer: Bytes!

  # State
  "Current authorization status"
  authorized: Boolean!
  "Timestamp when thawing completes (0 if not thawing)"
  thawEndTimestamp: BigInt!
}
```

### GraphTallyRAVCollection

Record of a RAV redemption event.

```graphql
type GraphTallyRAVCollection @entity {
  id: ID!

  # References
  "Payer address"
  payer: Bytes!
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # Details
  "Collection ID"
  collectionId: Bytes!
  "Timestamp in nanoseconds"
  timestampNs: BigInt!
  "Cumulative payment amount"
  valueAggregate: BigInt!
  "Tokens collected in this redemption"
  tokensCollected: BigInt!
}
```

## Event Handlers

### HorizonStaking

| Event | Handler Action |
|-------|----------------|
| `HorizonStakeDeposited` | Update `ServiceProvider.tokensStaked`, `GraphNetwork.tokensStaked` |
| `HorizonStakeLocked` | Update `ServiceProvider` |
| `HorizonStakeWithdrawn` | Update `ServiceProvider.tokensStaked`, `GraphNetwork.tokensStaked` |
| `ProvisionCreated` | Create `Provision`, `DelegationPool`, update `ServiceProvider`, `DataService`, `GraphNetwork` |
| `ProvisionIncreased` | Update `Provision`, `ServiceProvider`, `DataService`, `GraphNetwork` |
| `ProvisionThawed` | Update `Provision` thawing fields |
| `TokensDeprovisioned` | Update `Provision`, `ServiceProvider`, `DataService`, `GraphNetwork` |
| `ProvisionParametersStaged` | Update pending parameters on `Provision` |
| `ProvisionParametersSet` | Update active parameters on `Provision` |
| `ProvisionSlashed` | Update `Provision`, `ServiceProvider`, `DataService`, `GraphNetwork` slashing fields |
| `DelegationSlashed` | Update `DelegationPool`, `Provision`, `ServiceProvider`, `DataService`, `GraphNetwork` slashing fields |
| `DelegationSlashingSkipped` | No action required |
| `VerifierTokensSent` | No action required (informational) |
| `TokensDelegated` | Create/update `Delegator`, `Delegation`, `DelegationPool`, `Provision`, `ServiceProvider`, `DataService`, `GraphNetwork` |
| `TokensUndelegated` | Update `Delegation`, `Delegator`, `DelegationPool` thawing fields |
| `DelegatedTokensWithdrawn` | Update `Delegation`, `Delegator`, `DelegationPool`, `Provision`, `ServiceProvider`, `DataService`, `GraphNetwork` |
| `TokensToDelegationPoolAdded` | Update `DelegationPool.tokens` |
| `DelegationFeeCutSet` | Update fee cut fields on `Provision` |
| `ThawRequestCreated` | Create `ThawRequest`, update counts on related entities |
| `ThawRequestFulfilled` | Update `ThawRequest.fulfilled`, update counts |
| `ThawRequestsFulfilled` | Batch update `ThawRequest` entities, update counts |
| `OperatorSet` | Create/update `Operator`, `OperatorAuthorization` |
| `MaxThawingPeriodSet` | Update `GraphNetwork.maxThawingPeriod` |
| `DelegationSlashingEnabled` | Update `GraphNetwork.delegationSlashingEnabled` |

### GraphPayments

| Event | Handler Action |
|-------|----------------|
| `GraphPaymentCollected` | Create `PaymentCollection`, update `GraphNetwork`, `ServiceProvider`, `DataService`, `Provision`, `DelegationPool` token aggregates |

### PaymentsEscrow

| Event | Handler Action |
|-------|----------------|
| `Deposit` | Create/update `EscrowAccount`, update `GraphNetwork.tokensEscrowed` |
| `Thaw` | Update `EscrowAccount` thawing fields, update `GraphNetwork.tokensThawingFromEscrow` |
| `CancelThaw` | Reset `EscrowAccount` thawing fields, update `GraphNetwork.tokensThawingFromEscrow` |
| `Withdraw` | Update `EscrowAccount.tokens`, update `GraphNetwork.tokensEscrowed` |
| `EscrowCollected` | Update `EscrowAccount.tokens`, update `GraphNetwork.tokensEscrowed` |

### GraphTallyCollector

| Event | Handler Action |
|-------|----------------|
| `SignerAuthorized` | Create/update `GraphTallySigner`, `GraphTallySignerAuthorization` |
| `SignerThawing` | Update `GraphTallySignerAuthorization.thawEndTimestamp` |
| `SignerRevoked` | Update `GraphTallySignerAuthorization.authorized` |
| `SignerThawCanceled` | Reset `GraphTallySignerAuthorization.thawEndTimestamp` |
| `PaymentCollected` | Create `GraphTallyRAVCollection`, update `GraphNetwork.countRAVsCollected` |
| `RAVCollected` | Update `GraphTallyRAVCollection` with RAV details |

### DataService (ProvisionManager)

| Event | Handler Action |
|-------|----------------|
| `ProvisionTokensRangeSet` | Update `DataService.minProvisionTokens`, `DataService.maxProvisionTokens` |
| `DelegationRatioSet` | Update `DataService.delegationRatio` |
| `VerifierCutRangeSet` | Update `DataService.minVerifierCut`, `DataService.maxVerifierCut` |
| `ThawingPeriodRangeSet` | Update `DataService.minThawingPeriod`, `DataService.maxThawingPeriod` |
