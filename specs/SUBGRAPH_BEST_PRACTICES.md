# Subgraph Best Practices

This document outlines best practices for developing subgraphs, compiled from research on high-quality implementations (notably Messari's 176-subgraph repository) and official Graph Protocol documentation.

## 1. Project Structure & Organization

### Internal Structure with Future Extraction in Mind

While we're not adopting a full monorepo structure yet, we organize code internally with clear boundaries to facilitate future extraction (e.g., an analytics subgraph).

```
src/
├── common/                    # ← Future extraction candidate
│   ├── constants.ts           # BIGINT_ZERO, SECONDS_PER_DAY, etc.
│   ├── numbers.ts             # bigIntToBigDecimal, safeDiv, etc.
│   ├── addresses.ts           # Address utilities
│   └── ids.ts                 # ID generation helpers (prefixID, etc.)
│
├── config/                    # ← Multi-network support
│   ├── index.ts               # Re-exports active config
│   ├── mainnet.ts             # Addresses, start blocks
│   └── arbitrum.ts
│
├── entities/                  # ← Entity-specific logic
│   ├── serviceProvider.ts     # getOrCreateServiceProvider(), update helpers
│   ├── delegator.ts
│   ├── provision.ts
│   ├── delegation.ts
│   └── graphNetwork.ts
│
├── handlers/                  # ← Thin event handlers
│   ├── staking.ts             # handleStakeDeposited, handleStakeWithdrawn
│   ├── delegation.ts
│   └── escrow.ts
│
└── mapping.ts                 # Re-exports all handlers
```

### Directory Responsibilities

| Directory | Responsibility | Extraction Potential |
|-----------|---------------|---------------------|
| `common/` | Pure utilities, no entity imports | High - copy/paste to shared package |
| `config/` | Network-specific addresses/values | High - becomes config package |
| `entities/` | Entity CRUD + business logic | Medium - may diverge between subgraphs |
| `handlers/` | Event → entity function calls | Low - specific to each subgraph |

### Import Rules

1. **`common/` imports nothing from other src dirs** - Pure functions only
2. **`entities/` can import `common/` and `config/`** - Not handlers
3. **`handlers/` are thin** - Parse event, call entity functions, done
4. **Config is typed** - Export an interface, each network implements it

### Multi-Network Configuration

```typescript
// config/types.ts
export interface NetworkConfig {
  network: string
  subgraphServiceAddress: Address
  horizonStakingAddress: Address
  startBlock: i32
}

// config/mainnet.ts
export const config: NetworkConfig = {
  network: "mainnet",
  subgraphServiceAddress: Address.fromString("0x..."),
  horizonStakingAddress: Address.fromString("0x..."),
  startBlock: 12345678,
}

// config/index.ts - switched at build time via templating
export { config } from "./mainnet"
```

---

## 2. Schema Design

### Type Conventions

| Type | Used For | Examples |
|------|----------|----------|
| `Bytes!` | Entity IDs, addresses, composite keys | `id`, `serviceProvider`, `dataService` |
| `BigInt!` | Token amounts, timestamps, block numbers, PPM values | `tokensStaked`, `createdAt`, `maxVerifierCut` |
| `Int!` | Counts | `countProvisions`, `countDelegators` |
| `Boolean!` | Status flags | `allowed`, `valid`, `fulfilled` |
| `BigDecimal` | USD amounts, percentage rates (if needed) | `priceUSD`, `apr` |

### Field Naming Patterns

| Pattern | Meaning | Examples |
|---------|---------|----------|
| `tokens*` | Token amounts | `tokensStaked`, `tokensDelegated`, `tokensThawing`, `tokensSlashed` |
| `count*` | Entity counts | `countProvisions`, `countDelegators`, `countSlashEvents` |
| `*At` | Timestamps | `createdAt`, `updatedAt`, `thawingUntil`, `lastParametersStagedAt` |
| `*AtBlock` | Block numbers | `createdAtBlock`, `updatedAtBlock` |
| No prefix | Current spot value | `tokens`, `shares`, `allowed` |
| `cumulative*` | Running total from genesis (for analytics) | `cumulativeVolumeUSD` |
| `daily*` / `hourly*` | Snapshot interval aggregate (for analytics) | `dailyActiveUsers` |

### Entity ID Patterns

| Entity Type | ID Format | Example |
|-------------|-----------|---------|
| Single address | `address` | `ServiceProvider`, `Delegator`, `Operator` |
| Two-part composite | `addressA.concat(addressB)` | `Provision`, `DelegationPool` |
| Three-part composite | `addressA.concat(addressB).concat(addressC)` | `Delegation`, `EscrowAccount`, `OperatorAuthorization` |
| Event-based | `thawRequestId` (bytes32 from event) | `ProvisionThawRequest`, `DelegationThawRequest` |
| Composite with enum | `provisionId.concat(paymentType)` | `ProvisionFeeCut` |

### Standard Metadata Fields

All mutable entities should include consistent metadata:

```graphql
"Block number when entity was created"
createdAtBlock: BigInt!
"Timestamp when entity was created"
createdAt: BigInt!
"Block number when entity was last updated"
updatedAtBlock: BigInt!
"Timestamp when entity was last updated"
updatedAt: BigInt!
```

### Immutable Entities

Use `@entity(immutable: true)` for entities that log on-chain events and never change after creation:

```graphql
type Transfer @entity(immutable: true) {
  id: Bytes!
  from: Bytes!
  to: Bytes!
  amount: BigInt!
  blockNumber: BigInt!
  timestamp: BigInt!
}
```

**Never** use `immutable: true` for entities with fields that need modification over time.

### Derived Fields with @derivedFrom

Use `@derivedFrom` for one-to-many relationships instead of storing arrays directly:

```graphql
type ServiceProvider @entity {
  id: Bytes!
  provisions: [Provision!]! @derivedFrom(field: "serviceProvider")
}

type Provision @entity {
  id: Bytes!
  serviceProvider: ServiceProvider!
}
```

Benefits:
- Significantly improves indexing speed (no array mutations)
- Improves query performance
- Data is computed at query time from the foreign key

---

## 3. Performance Optimization

### Avoid eth_calls

Each `eth_call` takes 100ms to several seconds. This is the #1 cause of slow indexing.

```typescript
// Bad: contract call every event
function handleEvent(event: SomeEvent): void {
  let balance = contract.balanceOf(user)  // Slow!
}

// Good: use event data
function handleEvent(event: SomeEvent): void {
  let balance = event.params.balance  // Data already in event
}

// Acceptable: one-time call for lazy initialization (migration)
function getOrCreateServiceProvider(address: Address): ServiceProvider {
  let sp = ServiceProvider.load(address)
  if (!sp) {
    sp = new ServiceProvider(address)
    sp.tokensStaked = contract.getStake(address)  // One-time call
  }
  return sp
}
```

If contract calls are unavoidable:
- Declare calls in manifest for parallel execution
- Cache results in entities to avoid re-fetching

### Set Correct Start Blocks

Always use the contract deployment block, not genesis:

```yaml
dataSources:
  - source:
      address: "0x..."
      startBlock: 12345678  # Horizon deployment block
```

### Use Event Handlers Over Call Handlers

| Handler Type | Speed | Chain Support |
|--------------|-------|---------------|
| Event handlers | Fast | All EVM chains |
| Call handlers | Slow | Limited support |

Use transaction receipts to access sibling events if needed instead of call handlers.

### Pruning

Enable pruning for aggregate state subgraphs:

```yaml
indexerHints:
  prune: auto
```

Options:
- `auto` - Retains minimum necessary history (recommended for state subgraphs)
- `<number>` - Custom block retention limit
- `never` - Full history for time-travel queries

### Batch Entity Updates

```typescript
// Bad: multiple saves
entity.field1 = value1
entity.save()
entity.field2 = value2
entity.save()

// Good: single save
entity.field1 = value1
entity.field2 = value2
entity.save()
```

---

## 4. Handler Patterns

### Thin Handlers

Handlers should be thin - parse event, delegate to entity helpers:

```typescript
// handlers/staking.ts
export function handleStakeDeposited(event: StakeDeposited): void {
  let sp = getOrCreateServiceProvider(event.params.serviceProvider)
  let graphNetwork = getOrCreateGraphNetwork()

  // Delegate to entity-specific update functions
  updateServiceProviderOnStakeDeposit(sp, event)
  updateGraphNetworkOnStakeDeposit(graphNetwork, event)
}

// entities/serviceProvider.ts
export function updateServiceProviderOnStakeDeposit(
  sp: ServiceProvider,
  event: StakeDeposited
): void {
  sp.tokensStaked = sp.tokensStaked.plus(event.params.tokens)
  sp.updatedAt = event.block.timestamp
  sp.updatedAtBlock = event.block.number
  sp.save()
}
```

Benefits:
- Handlers are easy to read (what happens on this event?)
- Entity logic is reusable and testable
- Aligns with project structure (`handlers/` vs `entities/`)

### getOrCreate Pattern

Defensive, lazy initialization for all entities:

```typescript
export function getOrCreateServiceProvider(id: Bytes): ServiceProvider {
  let entity = ServiceProvider.load(id)
  if (entity == null) {
    entity = new ServiceProvider(id)
    entity.tokensStaked = BIGINT_ZERO
    entity.countProvisions = 0
    // ... initialize all fields with defaults
  }
  return entity
}
```

**Important:** Don't save inside `getOrCreate` - let the caller save after setting event-specific fields. This avoids double saves and keeps initialization separate from updates.

### Transaction Receipt Pattern

For extracting sibling event data when needed (apiVersion 0.0.7+):

```typescript
export function handleSomeEvent(event: SomeEvent): void {
  if (!event.receipt) return

  const logs = event.receipt.logs
  for (let i = 0; i < logs.length; i++) {
    const log = logs.at(i)
    if (log.topics.at(0).equals(TARGET_SIGNATURE)) {
      // Decode indexed params from topics
      // Decode non-indexed params from log.data
    }
  }
}
```

Use when you need data from related events in the same transaction without making contract calls.

---

## 5. Common Utilities

Utilities in `common/` should be pure functions with no entity imports.

### constants.ts

```typescript
import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"

export const BIGINT_ZERO = BigInt.fromI32(0)
export const BIGINT_ONE = BigInt.fromI32(1)
export const BIGDECIMAL_ZERO = BigDecimal.fromString("0")

export const SECONDS_PER_DAY = 86400
export const PPM_DENOMINATOR = BigInt.fromI32(1000000)
```

### numbers.ts

```typescript
import { BigInt, BigDecimal } from "@graphprotocol/graph-ts"
import { BIGDECIMAL_ZERO } from "./constants"

export function bigIntToBigDecimal(value: BigInt, decimals: i32 = 18): BigDecimal {
  return value.toBigDecimal().div(
    BigInt.fromI32(10).pow(decimals as u8).toBigDecimal()
  )
}

export function safeDiv(a: BigDecimal, b: BigDecimal): BigDecimal {
  if (b.equals(BIGDECIMAL_ZERO)) {
    return BIGDECIMAL_ZERO
  }
  return a.div(b)
}
```

### ids.ts

```typescript
import { Bytes } from "@graphprotocol/graph-ts"

export function twoPartId(a: Bytes, b: Bytes): Bytes {
  return a.concat(b)
}

export function threePartId(a: Bytes, b: Bytes, c: Bytes): Bytes {
  return a.concat(b).concat(c)
}
```

---

## 6. Common Pitfalls

| Don't | Do |
|-------|-----|
| Make uncached repeated contract calls | Cache results in entities |
| Use call handlers | Use event handlers |
| Save inside `getOrCreate` | Let caller save |
| Store arrays directly | Use `@derivedFrom` |
| Use `String` for IDs | Use `Bytes` |
| Hard-code addresses in mappings | Use config files |
| Start from block 0 | Use contract deployment block |

### Entity Merging Gotcha

When creating an entity with an existing ID, new values overwrite - including nulls:

```typescript
// Entity exists with field = "old value"
let entity = new Entity(existingId)
entity.field = null  // OVERWRITES with null!
entity.save()

// Always load first
let entity = Entity.load(id)
if (!entity) {
  entity = new Entity(id)
}
entity.field = newValue
entity.save()
```

This is why the `getOrCreate` pattern is essential.

---

## References

- [The Graph Academy - Best Practice Cookbook](https://thegraph.academy/developers/best-practice/)
- [The Graph Docs - AssemblyScript Mappings](https://thegraph.com/docs/en/subgraphs/developing/creating/assemblyscript-mappings/)
- [Messari Subgraphs Repository](https://github.com/messari/subgraphs)
- [Matchstick Unit Testing Framework](https://thegraph.com/docs/en/subgraphs/developing/creating/unit-testing-framework/)
