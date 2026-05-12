# Network Subgraph Implementation Plan

Incremental implementation with validation checkpoints between stages.

## High-Level Stages

| Stage | Focus | Entities | Status |
|-------|-------|----------|--------|
| 1 | Boilerplate | - | ✅ Complete |
| 2 | Service Provider Stake | `GraphNetwork`, `ServiceProvider` | ✅ Complete |
| 3 | Provisions | `Provision`, `DataService` | ✅ Complete |
| 4 | Delegation | `Delegator`, `Delegation`, `DelegationPool` | ✅ Complete |
| 5 | Thaw Requests | `ProvisionThawRequest`, `DelegationThawRequest` | Pending |
| 6 | Operators | `Operator`, `OperatorAuthorization` | Pending |
| 7 | Payments & Escrow | `Payer`, `Collector`, `EscrowAccount` | Pending |
| 8 | Slashing & Fees | Slashing fields, `ProvisionFeeCut` | Pending |

---

## Stage 4: Delegation

### Goal
Track delegations to service providers, including migration of ~310k legacy delegators.

### Migration Challenge

Legacy delegations were auto-assigned to **Subgraph Service** without emitting events. Analysis:

| Metric | Count |
|--------|-------|
| Total delegators | ~310,000 |
| Delegations >= 100 GRT | ~23,000 (7%) |
| Delegations < 100 GRT | ~287,000 (93%) - mostly Coinbase Earn dust |

### Migration Strategy: Hybrid Seeding

**Tier 1 - Proactive seeding at genesis:**
- `DelegationPool` entities (~181) - one per service provider for Subgraph Service
- `Delegation` entities (~23k) - delegations >= 100 GRT threshold
- `Delegator` entities (~23k) - corresponding delegators

**Tier 2 - Lazy initialization on interaction:**
- Delegations < 100 GRT created when delegator first interacts with Horizon
- Contract call to `getDelegation()` fetches current state

### Seed Data

Generated via `packages/tools`:
```bash
cd packages/tools
NETWORK=arbitrum-one pnpm seed:indexers      # -> indexer-seed.ts
NETWORK=arbitrum-one pnpm seed:delegations   # -> delegation-seed.ts
```

Output files in `packages/subgraph/src/config/arbitrum-one/`:
- `indexer-seed.ts` - SERVICE_PROVIDER_ADDRESSES
- `delegation-seed.ts` - DELEGATED_INDEXER_ADDRESSES, DELEGATION_SEED_DATA

### Deliverables

**1. Schema additions:**
```graphql
type DelegationPool @entity {
  id: Bytes!  # serviceProvider-verifier
  serviceProvider: ServiceProvider!
  verifier: Bytes!
  tokens: BigInt!
  shares: BigInt!
  tokensThawing: BigInt!
  sharesThawing: BigInt!
  countDelegators: Int!
  createdAtBlock: BigInt!
  createdAt: BigInt!
  updatedAtBlock: BigInt!
  updatedAt: BigInt!
}

type Delegator @entity {
  id: Bytes!  # delegator address
  tokensDelegated: BigInt!
  countDelegations: Int!
  delegations: [Delegation!]! @derivedFrom(field: "delegator")
  createdAtBlock: BigInt!
  createdAt: BigInt!
  updatedAtBlock: BigInt!
  updatedAt: BigInt!
}

type Delegation @entity {
  id: Bytes!  # delegator-serviceProvider-verifier
  delegator: Delegator!
  pool: DelegationPool!
  shares: BigInt!
  tokensLocked: BigInt!
  tokensLockedUntil: BigInt!
  createdAtBlock: BigInt!
  createdAt: BigInt!
  updatedAtBlock: BigInt!
  updatedAt: BigInt!
}
```

**2. Update ServiceProvider:**
```graphql
type ServiceProvider @entity {
  # ... existing fields ...
  tokensDelegated: BigInt!
  countDelegators: Int!
  delegationPools: [DelegationPool!]! @derivedFrom(field: "serviceProvider")
}
```

**3. Update GraphNetwork:**
```graphql
type GraphNetwork @entity {
  # ... existing fields ...
  tokensDelegated: BigInt!
  countDelegators: Int!
  countDelegationPools: Int!
}
```

**4. Entity helpers:**
```
src/entities/
├── delegationPool.ts   # getOrCreateDelegationPool()
├── delegator.ts        # getOrCreateDelegator()
└── delegation.ts       # getOrCreateDelegation()
```

**5. Migration seeding (update existing handler):**
```
src/handlers/migration.ts
├── seedServiceProviders()      # existing
├── seedDelegationPools()       # NEW - seed ~181 pools
└── seedDelegations()           # NEW - seed ~23k delegations
```

**6. Event handlers:**
```
src/handlers/delegation.ts
├── handleTokensDelegated()
├── handleTokensUndelegated()
├── handleDelegatedTokensWithdrawn()
└── handleDelegationSlashed()
```

### Implementation Steps

**Step 1: Update schema** - Add DelegationPool, Delegator, Delegation entities ✅

**Step 2: Add entity helpers** - Create/load functions with contract call fallback ✅

**Step 3: Update genesis seeding** - Seed DelegationPools and Delegations from seed data ✅

**Step 4: Add event handlers** - Handle delegation lifecycle events ✅

**Step 5: Update subgraph.yaml** - Add delegation event handlers ✅

### Seeding Threshold

Due to AssemblyScript compiler limits, seeding uses a **50,000 GRT threshold**:
- Delegations seeded: 2,579
- Unique delegators: 1,754
- Delegations < 50k GRT are created lazily on first interaction

### Contract Calls

```typescript
// For seeding
getDelegationPool(serviceProvider, verifier) -> (tokens, shares, tokensThawing, sharesThawing)
getDelegation(serviceProvider, verifier, delegator) -> (shares, tokensLocked, tokensLockedUntil)

// Built-in multicall for batching
multicall(bytes[] calldata data) -> bytes[] results
```

### Validation Checkpoint

**Queries:**
```graphql
{
  graphNetwork(id: "0x01000000") {
    tokensDelegated
    countDelegators
    countDelegationPools
  }
}

{
  delegationPools(first: 10, orderBy: tokens, orderDirection: desc) {
    id
    tokens
    shares
    countDelegators
  }
}

{
  delegators(first: 10, orderBy: tokensDelegated, orderDirection: desc) {
    id
    tokensDelegated
    countDelegations
  }
}
```

**Checks:**
- [ ] DelegationPool count matches seeded indexers (~181)
- [ ] Delegation count matches seeded delegations (~23k)
- [ ] Pool tokens/shares match on-chain `getDelegationPool()` values
- [ ] ServiceProvider.tokensDelegated matches sum of pool tokens
- [ ] New delegation events update entities correctly

---

## Stages 5-8: To Be Detailed Later

**Stage 5 - Thaw Requests:** ThawRequestCreated, ThawRequestFulfilled, ThawRequestsFulfilled. Both provision and delegation types.

**Stage 6 - Operators:** OperatorSet event. Migration of legacy operators to Subgraph Service.

**Stage 7 - Payments & Escrow:** GraphPayments and PaymentsEscrow events. New entities only (no migration).

**Stage 8 - Slashing & Fees:** StakeSlashed (legacy), ProvisionSlashed, DelegationSlashed, DelegationFeeCutSet. Complete remaining fields.
