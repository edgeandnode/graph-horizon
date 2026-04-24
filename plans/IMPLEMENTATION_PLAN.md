# Network Subgraph Implementation Plan

Incremental implementation with validation checkpoints between stages.

## High-Level Stages

| Stage | Focus | Entities | Validation |
|-------|-------|----------|------------|
| 1 | Boilerplate | - | Project builds, deploys empty subgraph |
| 2 | Service Provider Stake | `GraphNetwork`, `ServiceProvider` | Query SPs, verify stake totals |
| 3 | Provisions | `Provision`, `DataService` | Query provisions, verify tokensProvisioned |
| 4 | Delegation | `Delegator`, `Delegation`, `DelegationPool` | Query delegations, verify pool math |
| 5 | Thaw Requests | `ProvisionThawRequest`, `DelegationThawRequest` | Query pending thaws, verify lifecycle |
| 6 | Operators | `Operator`, `OperatorAuthorization` | Query authorizations |
| 7 | Payments & Escrow | `Payer`, `Collector`, `EscrowAccount` | Query escrow balances |
| 8 | Slashing & Fees | Slashing fields, `ProvisionFeeCut` | Verify slash accounting |

---

## Stage 1: Boilerplate

### Goal
Project structure, build pipeline, empty deployable subgraph.

### Deliverables

**1. Project structure:**
```
network-subgraph/
├── src/
│   ├── common/
│   │   ├── constants.ts
│   │   ├── numbers.ts
│   │   └── ids.ts
│   ├── config/
│   │   ├── index.ts
│   │   └── mainnet.ts
│   ├── entities/
│   │   └── (empty for now)
│   └── handlers/
│       └── (empty for now)
├── abis/
│   └── HorizonStaking.json
├── schema.graphql
├── subgraph.yaml
├── package.json
└── tsconfig.json
```

**2. Minimal schema** (just enough to deploy):
```graphql
type GraphNetwork @entity {
  id: Bytes!
}
```

**3. Config setup:**
```typescript
// config/mainnet.ts
export const config = {
  network: "mainnet",
  horizonStakingAddress: "0x...",
  startBlock: 12345678,
}
```

**4. Common utilities:**
- `constants.ts`: BIGINT_ZERO, BIGINT_ONE
- `numbers.ts`: bigIntToBigDecimal, safeDiv (if needed)
- `ids.ts`: twoPartId, threePartId

**5. Manifest with placeholder handler:**
```yaml
specVersion: 1.0.0
indexerHints:
  prune: auto
dataSources:
  - kind: ethereum
    name: HorizonStaking
    source:
      address: "0x..."
      abi: HorizonStaking
      startBlock: 12345678
    mapping:
      kind: ethereum/events
      apiVersion: 0.0.7
      language: wasm/assemblyscript
      entities:
        - GraphNetwork
      abis:
        - name: HorizonStaking
          file: ./abis/HorizonStaking.json
      eventHandlers:
        - event: HorizonStakeDeposited(indexed address,uint256)
          handler: handleHorizonStakeDeposited
```

### Validation Checkpoint
- [ ] `graph codegen` succeeds
- [ ] `graph build` succeeds
- [ ] Deploy to local graph-node or hosted service
- [ ] GraphQL playground loads (empty data is fine)

---

## Stage 2: Service Provider Stake

### Goal
Service providers with stake, including migration of ~180 existing SPs.

### Deliverables

**1. Schema additions:**
```graphql
type GraphNetwork @entity {
  id: Bytes!
  countServiceProviders: Int!
  tokensStaked: BigInt!
}

type ServiceProvider @entity {
  id: Bytes!
  tokensStaked: BigInt!
  tokensProvisioned: BigInt!
  tokensIdle: BigInt!
  createdAtBlock: BigInt!
  createdAt: BigInt!
  updatedAtBlock: BigInt!
  updatedAt: BigInt!
}
```

**2. Entity helpers:**
```
src/entities/
├── graphNetwork.ts    # getOrCreateGraphNetwork()
└── serviceProvider.ts # getOrCreateServiceProvider()
```

**3. Migration handler:**
```
src/handlers/migration.ts  # handleStartBlock()
src/config/serviceProviders.ts  # List of 180 addresses
```

**4. Event handlers:**
```
src/handlers/staking.ts
├── handleHorizonStakeDeposited()
└── handleHorizonStakeWithdrawn()
```

**5. Manifest updates:**
- Add block handler with `filter: kind: once`
- Add HorizonStakeWithdrawn event handler

### Handler Logic Summary

**handleStartBlock:**
1. Create GraphNetwork singleton
2. Loop through 180 SP addresses
3. For each: call `getStake()`, `getIdleStake()`, create entity
4. Tally totals on GraphNetwork

**handleHorizonStakeDeposited:**
1. getOrCreateServiceProvider
2. Add tokens to `tokensStaked`
3. Recalculate `tokensIdle`
4. Update GraphNetwork totals
5. Update metadata (updatedAt, updatedAtBlock)

**handleHorizonStakeWithdrawn:**
1. Load ServiceProvider
2. Subtract tokens from `tokensStaked`
3. Recalculate `tokensIdle`
4. Update GraphNetwork totals
5. Update metadata

### Validation Checkpoint

**Queries to run:**
```graphql
# Check GraphNetwork totals
{
  graphNetwork(id: "0x01") {
    countServiceProviders
    tokensStaked
  }
}

# Check individual SP
{
  serviceProvider(id: "0x...known-sp-address...") {
    tokensStaked
    tokensIdle
  }
}

# List all SPs
{
  serviceProviders(first: 10, orderBy: tokensStaked, orderDirection: desc) {
    id
    tokensStaked
  }
}
```

**Validation checks:**
- [ ] `countServiceProviders` = 180 (or current count)
- [ ] `tokensStaked` on GraphNetwork = sum of all SP stakes
- [ ] Known SP addresses have expected stake values (compare to contract)
- [ ] After a new stake event: values update correctly

---

## Stages 3-8: To Be Detailed Later

Will detail these after Stage 2 is validated. High-level scope:

**Stage 3 - Provisions:** ProvisionCreated, ProvisionIncreased, ProvisionParametersStaged/Set, TokensDeprovisioned. Links SP to DataService.

**Stage 4 - Delegation:** Migration of legacy delegations to Subgraph Service. TokensDelegated, TokensUndelegated, DelegatedTokensWithdrawn.

**Stage 5 - Thaw Requests:** ThawRequestCreated, ThawRequestFulfilled, ThawRequestsFulfilled. Both provision and delegation types.

**Stage 6 - Operators:** OperatorSet event. Migration of legacy operators to Subgraph Service.

**Stage 7 - Payments & Escrow:** GraphPayments and PaymentsEscrow events. New entities only (no migration).

**Stage 8 - Slashing & Fees:** ProvisionSlashed, DelegationSlashed, DelegationFeeCutSet. Complete remaining fields.
