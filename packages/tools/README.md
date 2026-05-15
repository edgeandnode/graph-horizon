# Graph Horizon Tools

Utilities for validating and seeding the Graph Horizon subgraph.

## Validation Scripts

Validation is split into two categories:

- **Internal validation** - Checks consistency within the subgraph data (fast, no RPC needed)
- **On-chain validation** - Compares subgraph data against on-chain contract state (slower, requires RPC)

### Internal Validation

```bash
pnpm validate:internal <subgraph-url>
```

Validates that the subgraph data is internally consistent. This catches mapping bugs where aggregates drift out of sync with individual entities.

#### GraphNetwork Count Checks

| Field | Expected Value |
|-------|----------------|
| `countServiceProviders` | Number of ServiceProvider entities with `tokensStaked > 0` |
| `countProvisions` | Number of Provision entities |
| `countDelegationPools` | Number of DelegationPool entities with `tokens > 0` |

#### GraphNetwork Sum Checks

| Field | Expected Value |
|-------|----------------|
| `tokensStaked` | Sum of `ServiceProvider.tokensStaked` |
| `tokensProvisioned` | Sum of `Provision.tokens` (includes thawing tokens per contract semantics) |
| `tokensDelegated` | Sum of `DelegationPool.tokens` |
| `tokensThawingFromProvisions` | Sum of `Provision.tokensThawing` |
| `tokensThawingFromDelegationPools` | Sum of `DelegationPool.tokensThawing` |

#### ServiceProvider Aggregate Checks

For each ServiceProvider, validates that aggregate fields match the sum of their child entities:

| Field | Expected Value |
|-------|----------------|
| `tokensProvisioned` | Sum of `Provision.tokens` for this SP (includes thawing tokens) |
| `tokensThawing` | Sum of `Provision.tokensThawing` for this SP |
| `tokensDelegated` | Sum of `DelegationPool.tokens` for this SP |
| `tokensDelegatedThawing` | Sum of `DelegationPool.tokensThawing` for this SP |
| `tokensIdle` | `tokensStaked - tokensProvisioned` |

### On-Chain Validation

These scripts compare subgraph entity fields against on-chain contract state by calling view functions on the HorizonStaking contract.

#### ServiceProvider Validation

```bash
NETWORK=arbitrum-one pnpm validate:onchain:service-providers <subgraph-url>
```

For each ServiceProvider, compares:

| Subgraph Field | On-Chain Source |
|----------------|-----------------|
| `tokensStaked` | `getServiceProvider(address).tokensStaked` |
| `tokensProvisioned` | `getServiceProvider(address).tokensProvisioned` |
| `tokensThawing` | Sum of `getProvision(sp, verifier).tokensThawing` for all SP's provisions |
| `tokensDelegated` | Sum of `getDelegationPool(sp, verifier).tokens` for all SP's pools |
| `tokensDelegatedThawing` | Sum of `getDelegationPool(sp, verifier).tokensThawing` for all SP's pools |

**Note** that `tokensIdle` is implicitly validated by checking `tokensStaked` and `tokensProvisioned` as it's a computed value derived from those two.

#### Provisions Validation

```bash
NETWORK=arbitrum-one pnpm validate:onchain:provisions <subgraph-url>
```

For each Provision, compares:

| Subgraph Field | Contract Field |
|----------------|----------------|
| `tokens` | `Provision.tokens` |
| `tokensThawing` | `Provision.tokensThawing` |
| `maxVerifierCut` | `Provision.maxVerifierCut` |
| `thawingPeriod` | `Provision.thawingPeriod` |
| `maxVerifierCutPending` | `Provision.maxVerifierCutPending` |
| `thawingPeriodPending` | `Provision.thawingPeriodPending` |

Contract call: `HorizonStaking.getProvision(serviceProvider, verifier)`

#### Delegations Validation

```bash
NETWORK=arbitrum-one pnpm validate:onchain:delegations <subgraph-url>
```

For each DelegationPool, compares:

| Subgraph Field | Contract Field |
|----------------|----------------|
| `tokens` | `DelegationPool.tokens` |
| `shares` | `DelegationPool.shares` |
| `tokensThawing` | `DelegationPool.tokensThawing` |

Contract call: `HorizonStaking.getDelegationPool(serviceProvider, verifier)`

## Environment Variables

For on-chain validation scripts:

| Variable | Description |
|----------|-------------|
| `NETWORK` | Network name (e.g., `arbitrum-one`, `arbitrum-sepolia`) |

Network configuration is loaded from `src/config.ts`.

## Exit Codes

All validation scripts exit with:
- `0` - All checks passed
- `1` - One or more checks failed or an error occurred
