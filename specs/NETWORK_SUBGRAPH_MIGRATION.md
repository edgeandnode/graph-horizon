# Network Subgraph Migration

This document outlines the migration considerations for the Network Subgraph when transitioning from the legacy Graph protocol to Horizon.

## Overview

Graph Horizon is an upgrade to The Graph protocol, which has been live for 5 years. The Network Subgraph is designed to track Horizon state via events, but pre-existing participants have state that was never emitted as Horizon events.

**The problem:** If we only index Horizon events, pre-existing participants will have incorrect or missing state (e.g., a service provider showing 0 stake when they actually have 1M GRT staked from the legacy system).

## Migration Scope

### Entities That Do NOT Require Migration

These entities are new to Horizon - all state is created via Horizon events:

| Entity | Reason |
|--------|--------|
| `Provision` | Provisions are a new Horizon concept |
| `ProvisionFeeCut` | New concept |
| `ProvisionThawRequest` | New thaw request system |
| `DelegationThawRequest` | New thaw request system |
| `Payer` | PaymentsEscrow is new |
| `Collector` | New concept |
| `EscrowAccount` | New escrow system |

**Note:** `DelegationPool` entities for **Subgraph Service** DO require migration (see Delegation section below). DelegationPools for other data services are new and don't require migration.

### State That REQUIRES Migration

Pre-existing state falls into three categories: **Stake**, **Delegation**, and **Operators**.

## 1. Stake

Service providers (indexers) have stake that existed before Horizon.

| Entity | Field | Notes |
|--------|-------|-------|
| `ServiceProvider` | `tokensStaked` | Legacy stake carried over |
| `ServiceProvider` | `tokensIdle` | Derived: tokensStaked - tokensProvisioned |
| `GraphNetwork` | `tokensStaked` | Protocol-wide total |
| `GraphNetwork` | `countServiceProviders` | Total service providers |

**Note:** All service providers have pre-existing stake, regardless of which data service they provision to.

### Contract Calls for Stake

The `HorizonStaking` contract provides these view functions:

| Field | Contract Call | Returns |
|-------|---------------|---------|
| `ServiceProvider.tokensStaked` | `getStake(address serviceProvider)` | `uint256` |
| `ServiceProvider.tokensIdle` | `getIdleStake(address serviceProvider)` | `uint256` |

### Migration Approach: Proactive Seeding with Contract Calls

There are ~180 service providers. This is small enough to seed proactively at the start block.

**Approach:**
1. Hardcode the list of 180 service provider addresses in the subgraph
2. Use a block handler (triggered once at start block) to seed all entities
3. Fetch `tokensStaked` and `tokensIdle` via contract calls for fresh values
4. Tally `GraphNetwork` totals during seeding

**Benefits:**
- Correct `GraphNetwork.tokensStaked` and `countServiceProviders` from block 1
- Fresh values from contract state (not stale snapshot)
- Deterministic (same addresses indexed every time)
- 180 contract calls is negligible overhead (one-time)

## 2. Delegation

Legacy delegations were auto-assigned to **Subgraph Service** specifically.

| Entity | Field | Notes |
|--------|-------|-------|
| `ServiceProvider` | `tokensDelegated` | Total delegated to this SP |
| `ServiceProvider` | `countDelegators` | Number of delegators |
| `Delegator` | `tokensDelegated` | Total tokens this delegator has delegated |
| `Delegator` | `countDelegations` | Number of active delegations |
| `Delegation` | `tokensDelegated` | Amount delegated (Subgraph Service only) |
| `Delegation` | `shares` | Pool shares (Subgraph Service only) |
| `DelegationPool` | `tokens` | Total pool tokens (Subgraph Service only) |
| `DelegationPool` | `shares` | Total pool shares (Subgraph Service only) |
| `DelegationPool` | `countDelegators` | Delegators in pool (Subgraph Service only) |
| `DataService` | `tokensDelegated` | Total delegated (Subgraph Service only) |
| `DataService` | `countDelegators` | Total delegators (Subgraph Service only) |
| `GraphNetwork` | `tokensDelegated` | Protocol-wide total |
| `GraphNetwork` | `countDelegators` | Total delegators |

**Important:** `Delegation`, `DelegationPool`, and `DataService` delegation fields only have pre-existing state for **Subgraph Service**. Other data services start fresh.

### Delegation Analysis

Analysis of the legacy graph-network-subgraph reveals:

| Metric | Count |
|--------|-------|
| Total delegators | ~310,000 |
| Total DelegatedStake records | ~323,000 |
| Indexers with delegations | ~181 |

**Distribution by delegation size:**

| Range | Count | % |
|-------|-------|---|
| < 1 GRT | ~2,400 | 0.8% |
| 1-10 GRT | ~4,200 | 1.3% |
| 10-100 GRT | ~293,000 | 90.8% |
| 100-1k GRT | ~13,800 | 4.3% |
| 1k-10k GRT | ~4,000 | 1.2% |
| > 10k GRT | ~5,200 | 1.6% |

**Key finding:** ~91% of delegations are in the 10-100 GRT range, likely from the Coinbase Earn program. These are effectively dust delegators who are unlikely to ever interact with Horizon.

### Contract Calls for Delegation

The `HorizonStaking` contract provides:

| Function | Signature | Returns |
|----------|-----------|---------|
| `getDelegationPool` | `getDelegationPool(address sp, address verifier)` | `(tokens, shares, tokensThawing, sharesThawing, nonce)` |
| `getDelegation` | `getDelegation(address sp, address verifier, address delegator)` | `(shares, tokensLocked, tokensLockedUntil)` |

The contract also supports batched calls via built-in `multicall(bytes[] calldata data)`.

### Migration Approach: Hybrid Seeding

Given the large number of delegators (~310k) but concentration of value in larger delegations (~7%), we use a **hybrid approach**:

#### Tier 1: Proactive Seeding (at genesis block)

Seed entities for delegations **>= 100 GRT** (~23,000 delegations):

1. **DelegationPool** entities (~181) - one per service provider for Subgraph Service
2. **Delegation** entities (~23,000) - for delegators with >= 100 GRT
3. **Delegator** entities (~23,000) - corresponding delegator records

**Contract calls:**
- `getDelegationPool()` × 181 = 181 calls
- `getDelegation()` × 23,000 = 23,000 calls (batched via multicall, ~47 batches of 500)

**Data to hardcode:**
- ~181 indexer addresses (~7.6 KB)
- ~23,000 (delegator, indexer) pairs (~1.9 MB)
- Total: ~2 MB (well under WASM limits)

#### Tier 2: Lazy Initialization (on first interaction)

For delegations **< 100 GRT** (~300,000 delegations):

- `Delegator` and `Delegation` entities created when delegator first interacts with Horizon
- Contract call to `getDelegation()` fetches current state at interaction time
- These are mostly Coinbase Earn dust delegators unlikely to ever interact

**Trade-offs:**
- `countDelegators` on `DelegationPool`/`ServiceProvider`/`GraphNetwork` reflects only seeded delegators (~23k vs ~310k)
- Dust delegators (~92%) won't have entities until they interact
- Service providers get accurate `tokensDelegated` totals immediately (what matters for operations)

### Implementation

1. **Export delegation data** from legacy subgraph:
   ```bash
   cd packages/tools
   pnpm seed:delegations 100  # threshold in GRT
   ```
   This generates `packages/subgraph/src/config/arbitrum-one/delegation-seed.ts` with indexer addresses and (delegator, indexer) pairs.

2. **Genesis block handler**:
   ```typescript
   function handleBlock(block: ethereum.Block): void {
     // Seed DelegationPools
     for (let i = 0; i < INDEXER_ADDRESSES.length; i++) {
       seedDelegationPool(INDEXER_ADDRESSES[i], SUBGRAPH_SERVICE)
     }

     // Seed Delegations (batched multicall)
     for (let i = 0; i < DELEGATIONS.length; i++) {
       seedDelegation(DELEGATIONS[i][0], DELEGATIONS[i][1], SUBGRAPH_SERVICE)
     }
   }
   ```

3. **Lazy initialization** in event handlers:
   ```typescript
   function getOrCreateDelegation(delegator: Address, sp: Address, verifier: Address): Delegation {
     let id = delegationId(delegator, sp, verifier)
     let delegation = Delegation.load(id)
     if (delegation == null) {
       // Fetch current state from contract
       let onChain = contract.getDelegation(sp, verifier, delegator)
       delegation = new Delegation(id)
       delegation.shares = onChain.shares
       // ... populate fields
     }
     return delegation
   }
   ```

## 3. Operators

Legacy operator authorizations were auto-assigned to **Subgraph Service** specifically.

| Entity | Field | Notes |
|--------|-------|-------|
| `Operator` | `countAuthorizations` | Number of authorizations |
| `OperatorAuthorization` | `allowed` | Authorization status (Subgraph Service only) |
| `DataService` | `countServiceProviders` | SPs with operators (Subgraph Service only) |

**Important:** `OperatorAuthorization` entities only have pre-existing state for **Subgraph Service**. Other data services start fresh.

## The Subgraph Service Special Case

Subgraph Service is a specific data service that inherited all legacy state:
- All legacy delegations → assigned to Subgraph Service
- All legacy operators → assigned to Subgraph Service
- Legacy indexers → become service providers with provisions to Subgraph Service

This means:
1. `DataService` entity for Subgraph Service address has pre-existing aggregates
2. `DelegationPool` entities for `(serviceProvider, SubgraphService)` have pre-existing state
3. `Delegation` entities for `(delegator, serviceProvider, SubgraphService)` have pre-existing state
4. `OperatorAuthorization` entities for `(operator, serviceProvider, SubgraphService)` have pre-existing state

The Subgraph Service address needs to be known at indexing time.

## Migration Approaches

### Ruled Out: IPFS-Based Seeding

Loading seed data from IPFS was considered but is **not viable** for two reasons:

1. **`ipfs.cat` is non-deterministic**: If the file can't be retrieved before timeout, it returns null. This makes the subgraph ineligible for indexing rewards on the decentralized network.

2. **File Data Sources have entity isolation**: Entities created by File Data Sources are immutable and completely isolated from chain-based entities. Chain-based handlers cannot access or update them, and vice versa. This means seeded entities couldn't be updated by Horizon event handlers.

### Option A: Index from Protocol Genesis

Index all events from block 0, including legacy staking/delegation events. State builds up correctly over time.

**Pros:**
- Pure event-driven, no external dependencies
- Complete historical accuracy
- Deterministic

**Cons:**
- Complex handlers (legacy + Horizon event formats)
- Long sync time (5+ years of events)
- Need to handle event format changes over protocol history

### Option B: Bootstrap from Old Subgraph (Grafting)

Use subgraph grafting to start from the state of the old `graph-network-subgraph` at the Horizon block.

```yaml
features:
  - grafting
graft:
  base: QmOldSubgraphId
  block: 12345678  # Horizon block
```

**Pros:**
- Clean Horizon-only handlers
- Faster sync after bootstrap
- Deterministic

**Cons:**
- Schema compatibility required with old subgraph
- External dependency on old subgraph deployment
- One-time bootstrap process

### Option C: Contract Calls (Lazy Initialization)

Use contract calls in `createOrLoad` helpers to fetch state when entities are first encountered via Horizon events.

```typescript
function getOrCreateServiceProvider(address: Address): ServiceProvider {
  let sp = ServiceProvider.load(address.toHexString())
  if (sp == null) {
    sp = new ServiceProvider(address.toHexString())
    sp.tokensStaked = contract.getStake(address)
    sp.tokensIdle = contract.getIdleStake(address)
    // Update GraphNetwork totals...
  }
  return sp
}
```

**Pros:**
- Ground truth from contracts
- No external dependencies
- No hardcoding required
- Deterministic

**Cons:**
- Contract calls on every entity creation (slower indexing)
- Providers who never interact with Horizon won't be indexed
- `GraphNetwork` totals only converge as participants interact

### Option D: Contract Calls (Proactive Seeding)

Seed all known providers at start block using a block handler, fetching state via contract calls.

```typescript
const PROVIDERS = ["0xabc...", "0xdef...", ...]

function handleBlock(block: ethereum.Block): void {
  for (let i = 0; i < PROVIDERS.length; i++) {
    let addr = Address.fromString(PROVIDERS[i])
    let sp = new ServiceProvider(PROVIDERS[i])
    sp.tokensStaked = contract.getStake(addr)
    sp.save()
  }
}
```

**Pros:**
- Ground truth from contracts at indexing time
- All known providers indexed immediately
- Correct `GraphNetwork` totals from the start
- Deterministic

**Cons:**
- Requires hardcoded list of provider addresses
- Need to obtain address list from external source (old subgraph, event logs, etc.)
- Block handler with many contract calls could be slow

### Option E: Hardcoded Block Handler

Seed all data directly in a block handler with hardcoded values (no contract calls).

```typescript
function handleBlock(block: ethereum.Block): void {
  seedProvider("0xabc...", "1000000000000000000000000")
  seedProvider("0xdef...", "500000000000000000000000")
  // ...
}
```

**Pros:**
- No external dependencies at indexing time
- Fast (no contract calls)
- Deterministic
- Self-contained

**Cons:**
- Requires hardcoded addresses AND state values
- State is a snapshot that could be stale if indexing starts late
- Large datasets = large WASM binary

### Option F: Hybrid Approach

Combine approaches based on entity type:
- New entities (Provision, EscrowAccount, etc.): Pure event-driven
- Pre-existing entities: Contract calls (lazy or proactive)

**Pros:**
- Optimized per entity type
- Balances correctness and performance

**Cons:**
- More complex implementation
- Need clear rules per entity

## Key Decision: Lazy vs Proactive Initialization

The fundamental trade-off is:

| Approach | Requires Address List? | Captures Inactive Providers? |
|----------|------------------------|------------------------------|
| Lazy (Option C) | No | No - only indexed when they interact |
| Proactive (Options D, E) | Yes | Yes - all known providers seeded |

If capturing providers who never interact with Horizon is important, a hardcoded address list is required. This list can be obtained by:
- Querying the old `graph-network-subgraph`
- Parsing historical `HorizonStakeDeposited` events
- Exporting from protocol team records

## Open Questions

1. ~~What is the exact Subgraph Service address?~~ **Answered:** `0xb2Bb92d0DE618878E438b55D5846cfecD9301105`
2. What is the Horizon deployment block number?
3. ~~Is capturing inactive providers (who never interact with Horizon) a requirement?~~ **Decided:** Yes, proactive seeding for all ~180 service providers.
4. ~~If proactive seeding is needed, what's the best source for the address list?~~ **Decided:** Query old subgraph via validation scripts.
5. ~~How to handle ~310k delegators?~~ **Decided:** Hybrid approach - seed >= 100 GRT delegations (~23k), lazy-load the rest.

## Decided Approaches

| State | Approach | Entities | Contract Calls |
|-------|----------|----------|----------------|
| **Stake** | Proactive seeding | ~181 ServiceProviders | ~181 `getStake()` |
| **Delegation (>= 100 GRT)** | Proactive seeding | ~181 DelegationPools, ~23k Delegations | ~47 multicall batches |
| **Delegation (< 100 GRT)** | Lazy initialization | ~300k (on demand) | On first interaction |
| **Operators** | TBD | TBD | TBD |

## Next Steps

- [x] Analyze delegation distribution (Coinbase Earn impact)
- [x] Decide on hybrid delegation approach
- [x] Create delegation export script
- [ ] Clarify Horizon deployment block number
- [ ] Implement delegation seeding in subgraph
- [ ] Investigate operator migration requirements
- [ ] Test migration with known pre-existing participants
