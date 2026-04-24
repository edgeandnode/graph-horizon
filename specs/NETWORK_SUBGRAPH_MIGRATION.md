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
| `DelegationPool` | Per-provision pools are new |
| `DelegationThawRequest` | New thaw request system |
| `Payer` | PaymentsEscrow is new |
| `Collector` | New concept |
| `EscrowAccount` | New escrow system |

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

The `GraphNetwork` aggregate fields don't have direct contract calls. Instead, they are tallied incrementally:

- **`GraphNetwork.tokensStaked`**: When a service provider is first encountered via any Horizon event, call `getStake()` and add the result to the running total.
- **`GraphNetwork.countServiceProviders`**: Increment when a new service provider entity is created.

This approach means `GraphNetwork` totals will converge to correct values as service providers interact with Horizon. Providers who never interact with Horizon won't be counted, but this is acceptable since they're not active participants.

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

1. What is the exact Subgraph Service address?
2. What is the Horizon deployment block number?
3. Is capturing inactive providers (who never interact with Horizon) a requirement?
4. If proactive seeding is needed, what's the best source for the address list?

## Next Steps

- [ ] Clarify open questions with protocol team
- [ ] Decide on migration approach based on requirements
- [ ] If proactive seeding: obtain and validate address list
- [ ] Document specific implementation for chosen approach
- [ ] Test migration with known pre-existing participants
