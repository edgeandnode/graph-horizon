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
  "Singleton entity, always '1'"
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
  "Active payers"
  countPayers: Int!
  "Active collectors"
  countCollectors: Int!
  "Active escrow accounts"
  countEscrowAccounts: Int!

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
  "Total tokens collected in the protocol"
  tokensCollected: BigInt!
  "Tokens burned as protocol tax"
  tokensDistributedAsProtocolTax: BigInt!
  "Tokens distributed to service providers"
  tokensDistributedToServiceProviders: BigInt!
  "Tokens distributed to delegation pools"
  tokensDistributedToDelegationPools: BigInt!
  "Tokens distributed to data services"
  tokensDistributedToDataServices: BigInt!

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
  "Signer revocation thawing period for payments escrow (seconds)"
  revokeSignerThawingPeriod: BigInt!
}
```

### ServiceProvider

An account that stakes GRT to provide services.

```graphql
type ServiceProvider @entity {
  "Service provider address"
  id: ID!

  # Relationships
  "Provisions created by this service provider"
  provisions: [Provision!]! @derivedFrom(field: "serviceProvider")
  "Operator authorizations for this service provider"
  operatorAuthorizations: [OperatorAuthorization!]! @derivedFrom(field: "serviceProvider")
  "Escrow accounts where this service provider is the receiver"
  escrowAccounts: [EscrowAccount!]! @derivedFrom(field: "serviceProvider")

  # Counts
  "Active provisions"
  countProvisions: Int!
  "Active delegators"
  countDelegators: Int!
  "Pending thaw requests"
  countThawRequests: Int!
  "Slash events"
  countSlashEvents: Int!
  "Active escrow accounts"
  countEscrowAccounts: Int!

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

  # Payment collection
  "Total tokens collected by the service provider"
  tokensCollected: BigInt!
  "Tokens burned as protocol tax"
  tokensDistributedAsProtocolTax: BigInt!
  "Tokens kept by the service provider"
  tokensDistributedToServiceProvider: BigInt!
  "Tokens distributed to delegation pools"
  tokensDistributedToDelegationPools: BigInt!
  "Tokens distributed to data services"
  tokensDistributedToDataServices: BigInt!

  # Escrow
  "Total tokens in escrow for this service provider"
  tokensEscrowed: BigInt!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### DataService

Represents a data service (verifier) in the protocol.

```graphql
type DataService @entity {
  "Data service (verifier) contract address"
  id: ID!

  # Relationships
  "Provisions for this data service"
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
  "Slash events"
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

  # Payment collection
  "Total tokens collected by service providers for this data service"
  tokensCollected: BigInt!
  "Tokens burned as protocol tax"
  tokensDistributedAsProtocolTax: BigInt!
  "Tokens distributed to service providers"
  tokensDistributedToServiceProviders: BigInt!
  "Tokens distributed to delegation pools"
  tokensDistributedToDelegationPools: BigInt!
  "Tokens kept by the data service"
  tokensDistributedToDataService: BigInt!

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

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### Provision

Stake allocated by a service provider to a specific data service.

```graphql
type Provision @entity {
  "Concatenation of service provider address and data service address (serviceProvider-dataService)"
  id: ID!

  # References
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # Relationships
  "Delegation pool for this provision"
  delegationPool: DelegationPool! @derivedFrom(field: "provision")
  "Thaw requests for this provision"
  thawRequests: [ProvisionThawRequest!]! @derivedFrom(field: "provision")

  # Counts
  "Active delegators"
  countDelegators: Int!
  "Pending thaw requests"
  countThawRequests: Int!
  "Slash events"
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

  # Payment collection
  "Total tokens collected by this provision"
  tokensCollected: BigInt!
  "Tokens burned as protocol tax"
  tokensDistributedAsProtocolTax: BigInt!
  "Tokens distributed to service provider"
  tokensDistributedToServiceProvider: BigInt!
  "Tokens distributed to delegation pool"
  tokensDistributedToDelegationPool: BigInt!
  "Tokens distributed to data service"
  tokensDistributedToDataService: BigInt!

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

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### ProvisionThawRequest

Pending deprovision request to remove stake from a provision.

```graphql
type ProvisionThawRequest @entity {
  "Thaw request ID from contract event"
  id: ID!

  # References
  "Provision being thawed"
  provision: Provision!
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # State
  "Shares being thawed"
  shares: BigInt!
  "Timestamp when thaw completes"
  thawingUntil: BigInt!
  "Thawing nonce at time of creation"
  thawingNonce: BigInt!

  # Status
  "False if invalidated by slashing"
  valid: Boolean!
  "True when tokens have been withdrawn"
  fulfilled: Boolean!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### DelegationPool

Aggregate delegation pool for a provision.

```graphql
type DelegationPool @entity {
  "Same as Provision ID (serviceProvider-dataService)"
  id: ID!

  # References
  "Provision this pool belongs to"
  provision: Provision!
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # Relationships
  "Delegations in this pool"
  delegations: [Delegation!]! @derivedFrom(field: "pool")
  "Thaw requests for delegations in this pool"
  thawRequests: [DelegationThawRequest!]! @derivedFrom(field: "pool")

  # Counts
  "Active delegators"
  countDelegators: Int!
  "Pending thaw requests"
  countThawRequests: Int!
  "Slash events"
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

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### Delegator

An account that delegates tokens to service providers.

```graphql
type Delegator @entity {
  "Delegator address"
  id: ID!

  # Relationships
  "Delegations by this delegator"
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

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### Delegation

Individual delegator's stake in a delegation pool.

```graphql
type Delegation @entity {
  "Concatenation of delegator, service provider, and data service addresses (delegator-serviceProvider-dataService)"
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
  "Thaw requests for this delegation"
  thawRequests: [DelegationThawRequest!]! @derivedFrom(field: "delegation")

  # Counts
  "Pending thaw requests"
  countThawRequests: Int!

  # Tokens
  "Tokens delegated (input amount, not current valuation)"
  tokensDelegated: BigInt!
  "Delegator's shares in pool"
  shares: BigInt!
  "Tokens currently thawing"
  tokensThawing: BigInt!
  "Shares currently thawing"
  sharesThawing: BigInt!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### DelegationThawRequest

Pending undelegation request to remove stake from a delegation.

```graphql
type DelegationThawRequest @entity {
  "Thaw request ID from contract event"
  id: ID!

  # References
  "Delegation being thawed"
  delegation: Delegation!
  "Delegator"
  delegator: Delegator!
  "Delegation pool"
  pool: DelegationPool!
  "Service provider"
  serviceProvider: ServiceProvider!
  "Data service"
  dataService: DataService!

  # State
  "Shares being thawed"
  shares: BigInt!
  "Timestamp when thaw completes"
  thawingUntil: BigInt!
  "Thawing nonce at time of creation"
  thawingNonce: BigInt!

  # Status
  "False if invalidated by slashing"
  valid: Boolean!
  "True when tokens have been withdrawn"
  fulfilled: Boolean!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### Operator

An operator account that can be authorized to act on behalf of service providers.

```graphql
type Operator @entity {
  "Operator address"
  id: ID!

  # Relationships
  "Authorizations granted to this operator"
  authorizations: [OperatorAuthorization!]! @derivedFrom(field: "operator")

  # Counts
  "Active authorizations"
  countAuthorizations: Int!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### OperatorAuthorization

Authorization for an operator to act on behalf of a service provider on a specific data service.

```graphql
type OperatorAuthorization @entity {
  "Concatenation of operator, service provider, and data service addresses (operator-serviceProvider-dataService)"
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

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### Payer

An account that pays for services via GraphPayments.

```graphql
type Payer @entity {
  "Payer address"
  id: ID!

  # Relationships
  "Escrow accounts funded by this payer"
  escrowAccounts: [EscrowAccount!]! @derivedFrom(field: "payer")

  # Counts
  "Active escrow accounts"
  countEscrowAccounts: Int!

  # Tokens
  "Total tokens in escrow"
  tokensEscrowed: BigInt!
  "Total tokens thawing"
  tokensThawing: BigInt!
  "Total tokens collected from escrow"
  tokensCollected: BigInt!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### Collector

A contract that facilitates payment collection through GraphPayments (e.g., GraphTallyCollector).

```graphql
type Collector @entity {
  "Collector contract address"
  id: ID!

  # Relationships
  "Escrow accounts using this collector"
  escrowAccounts: [EscrowAccount!]! @derivedFrom(field: "collector")

  # Counts
  "Active escrow accounts"
  countEscrowAccounts: Int!

  # Tokens
  "Total tokens in escrow"
  tokensEscrowed: BigInt!
  "Total tokens thawing"
  tokensThawing: BigInt!
  "Total tokens collected"
  tokensCollected: BigInt!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### EscrowAccount

Escrow balance for a payer-collector-serviceProvider tuple in GraphPayments.

```graphql
type EscrowAccount @entity {
  "Concatenation of payer, collector, and service provider addresses (payer-collector-serviceProvider)"
  id: ID!

  # References
  "Payer that deposited funds into the escrow account"
  payer: Payer!
  "Collector allowed to withdraw funds from the account"
  collector: Collector!
  "Service provider that can collect funds from the account"
  serviceProvider: ServiceProvider!

  # Tokens
  "Available tokens"
  tokens: BigInt!
  "Tokens currently thawing"
  tokensThawing: BigInt!
  "Timestamp when thawing completes (0 if not thawing)"
  thawEndTimestamp: BigInt!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### GraphTallySigner

An account authorized to sign RAVs on behalf of payers.

```graphql
type GraphTallySigner @entity {
  "Signer address"
  id: ID!

  # Relationships
  "Authorizations granted to this signer"
  authorizations: [GraphTallySignerAuthorization!]! @derivedFrom(field: "signer")

  # Counts
  "Active authorizations"
  countAuthorizations: Int!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
}
```

### GraphTallySignerAuthorization

Authorization for a signer to sign RAVs on behalf of a payer.

```graphql
type GraphTallySignerAuthorization @entity {
  "Concatenation of signer and payer addresses (signer-payer)"
  id: ID!

  # References
  "Signer"
  signer: GraphTallySigner!
  "Payer address"
  payer: Payer!

  # State
  "Current authorization status"
  authorized: Boolean!
  "Timestamp when thawing completes (0 if not thawing)"
  thawEndTimestamp: BigInt!

  # Metadata
  "Block number when entity was created"
  createdAtBlock: BigInt!
  "Timestamp when entity was created"
  createdAt: BigInt!
  "Block number when entity was last updated"
  updatedAtBlock: BigInt!
  "Timestamp when entity was last updated"
  updatedAt: BigInt!
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
| `ThawRequestCreated` | Create `ProvisionThawRequest` or `DelegationThawRequest`, update counts on related entities |
| `ThawRequestFulfilled` | Update thaw request's `fulfilled` field, update counts |
| `ThawRequestsFulfilled` | Batch update thaw request entities, update counts |
| `OperatorSet` | Create/update `Operator`, `OperatorAuthorization` |
| `MaxThawingPeriodSet` | Update `GraphNetwork.maxThawingPeriod` |
| `DelegationSlashingEnabled` | Update `GraphNetwork.delegationSlashingEnabled` |

### GraphPayments

| Event | Handler Action |
|-------|----------------|
| `GraphPaymentCollected` | Update `GraphNetwork`, `ServiceProvider`, `DataService`, `Provision`, `DelegationPool` payment collection aggregates |

### PaymentsEscrow

| Event | Handler Action |
|-------|----------------|
| `Deposit` | Create/update `Payer`, `Collector`, `EscrowAccount`, update `GraphNetwork.tokensEscrowed` |
| `Thaw` | Update `EscrowAccount`, `Payer`, `Collector` thawing fields, update `GraphNetwork.tokensThawingFromEscrow` |
| `CancelThaw` | Reset `EscrowAccount`, `Payer`, `Collector` thawing fields, update `GraphNetwork.tokensThawingFromEscrow` |
| `Withdraw` | Update `EscrowAccount`, `Payer`, `Collector`, `GraphNetwork.tokensEscrowed` |
| `EscrowCollected` | Update `EscrowAccount`, `Payer`, `Collector`, `GraphNetwork.tokensEscrowed` |

### GraphTallyCollector

| Event | Handler Action |
|-------|----------------|
| `SignerAuthorized` | Create/update `GraphTallySigner`, `GraphTallySignerAuthorization` |
| `SignerThawing` | Update `GraphTallySignerAuthorization.thawEndTimestamp` |
| `SignerRevoked` | Update `GraphTallySignerAuthorization.authorized` |
| `SignerThawCanceled` | Reset `GraphTallySignerAuthorization.thawEndTimestamp` |

### DataService (ProvisionManager)

| Event | Handler Action |
|-------|----------------|
| `ProvisionTokensRangeSet` | Update `DataService.minProvisionTokens`, `DataService.maxProvisionTokens` |
| `DelegationRatioSet` | Update `DataService.delegationRatio` |
| `VerifierCutRangeSet` | Update `DataService.minVerifierCut`, `DataService.maxVerifierCut` |
| `ThawingPeriodRangeSet` | Update `DataService.minThawingPeriod`, `DataService.maxThawingPeriod` |
