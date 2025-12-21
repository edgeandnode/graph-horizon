# Horizon CLI Specification

A CLI tool for service provider operators to manage stake and provisions on Graph Horizon.

## Overview

The CLI is designed for **operators** acting on behalf of service providers. The operator role exists as a security mechanism - operators use a hot private key to execute day-to-day operations while the service provider's cold key stays secure.

All read operations pull data from the Horizon subgraph. Write operations are either:
- **Signed by the operator** - executed directly via RPC
- **Service provider only** - CLI generates ABI Ninja link + instructions (no signing)

## Configuration

| Field | Required | Default |
|-------|----------|---------|
| `operator_mnemonic` | Yes | - |
| `service_provider_address` | Yes | - |
| `rpc_endpoint` | Yes | - |
| `subgraph_endpoint` | Yes | - |
| `horizon_staking_address` | No | Arbitrum One deployed address |

## Commands

### stake

Aggregate stake view and service-provider-only actions.

#### `stake status [--service-provider <addr>]`

Displays:
- Total stake: sum of idle and provisioned
- Idle stake: stake not assigned to provisions
- Provisioned stake: stake assigned to provisions

#### `stake deposit --tokens <amount>`

**Service provider only** - outputs ABI Ninja instructions:
```
To deposit <amount> GRT:

1. Open: https://abi.ninja/<HorizonStaking>/<chainId>?methods=stake

2. Connect wallet with service provider address:
   <service_provider_address>

3. Fill in parameters:
   - tokens: <amount>

4. Submit transaction
```

#### `stake unstake --tokens <amount>`

**Service provider only** - outputs ABI Ninja instructions for `unstake`.

---

### operator

Operator authorization management.

#### `operator list [--service-provider <addr>]`

Lists all authorized operators per data service. Highlights the configured operator as `(active)`.

```
Data Service         Operator
────────────────────────────────────────
0x1234...5678        0xABCD...EF01 (active)
0x1234...5678        0x9876...5432
0x5678...9ABC        0xABCD...EF01 (active)
```

#### `operator authorize <data-service> <operator>`

**Service provider only** - outputs ABI Ninja instructions for `setOperator` with `allowed: true`.

#### `operator revoke <data-service> <operator>`

**Service provider only** - outputs ABI Ninja instructions for `setOperator` with `allowed: false`.

---

### provision

Provision listing, inspection, and management.

#### `provision list [--service-provider <addr>]`

Table of all provisions:
- Data service address
- Tokens provisioned
- Tokens thawing
- Provision parameters (max verifier cut, thawing period)

#### `provision status <data-service> [--service-provider <addr>]`

Detailed provision view:
- Data service address
- Operators
- Tokens provisioned
- Tokens thawing
- Tokens available (non-thawing)
- Max verifier cut (current and pending if staged)
- Thawing period (current and pending if staged)
- Thaw requests summary (count, total shares thawing, ready to remove)
- Delegation pool (tokens, shares)
- Fee cuts by payment type

#### `provision create <data-service> --tokens <amount> --max-cut <ppm> --thawing-period <seconds>`

**Operator signed** - creates a new provision for the data service.

Maps to: `HorizonStaking.provision(serviceProvider, verifier, tokens, maxVerifierCut, thawingPeriod)`

#### `provision add <data-service> --tokens <amount>`

**Operator signed** - adds tokens from idle stake to an existing provision.

Maps to: `HorizonStaking.addToProvision(serviceProvider, verifier, tokens)`

#### `provision thaw <data-service> --tokens <amount>`

**Operator signed** - starts thawing tokens from a provision.

Maps to: `HorizonStaking.thaw(serviceProvider, verifier, tokens)`

#### `provision list-thaw <data-service> [--service-provider <addr>]`

Lists thaw requests for a provision:

```
ID                   Shares           Thawing Until           Status
─────────────────────────────────────────────────────────────────────
0xabc123...          1,000.00 GRT     2024-03-15 14:30:00     pending
0xdef456...          500.00 GRT       2024-03-10 09:00:00     ready

Current block timestamp: 2024-03-12 10:00:00
```

Status is `ready` when `thawingUntil < currentBlockTimestamp`, otherwise `pending`.

#### `provision remove <data-service> [--n-requests <count>]`

**Operator signed** - removes thawed tokens back to idle stake.

Maps to: `HorizonStaking.deprovision(serviceProvider, verifier, nThawRequests)`

If `--n-requests` is not specified, processes all ready thaw requests.

#### `provision stage-parameters <data-service> --max-cut <ppm> --thawing-period <seconds>`

**Service provider only** - outputs ABI Ninja instructions for staging new provision parameters.

Maps to: `HorizonStaking.setProvisionParameters(serviceProvider, verifier, maxVerifierCut, thawingPeriod)`

Note: Parameter changes require acceptance by the data service (verifier) before taking effect. The pending parameters will be visible in `provision status`.

#### `provision set-cut <data-service> --payment-type <type> --cut <ppm>`

**Operator signed** - sets the delegation fee cut for a payment type.

Maps to: `HorizonStaking.setDelegationFeeCut(serviceProvider, verifier, paymentType, feeCut)`

Payment types:
- `QueryFee`
- `IndexingFee`
- `IndexingRewards`

---

## Data Sources

### Subgraph Queries

All read operations fetch data from the Horizon subgraph:
- Service provider stake (total, idle, provisioned)
- Provisions list and details
- Thaw requests
- Delegation pools
- Operator authorizations

### RPC

Used only for sending signed transactions (operator write operations).
