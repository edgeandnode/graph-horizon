# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Graph Horizon Tools is a monorepo containing multiple tools for debugging and working with The Graph's Horizon protocol.

**Current Tools:**
- **CLI** (`packages/cli`): Validates protocol data by querying both RPC endpoints and subgraphs, then comparing results to detect inconsistencies.

**Structure:**
- This is a pnpm workspace monorepo
- Each tool lives in `packages/` directory
- Shared dependencies in root `package.json`
- Individual packages can be built/tested independently

## Key Commands

### Root-Level Commands (Monorepo)
```bash
pnpm install        # Install all dependencies
pnpm build          # Build all packages
pnpm test           # Run tests in all packages
pnpm lint           # Lint all packages
pnpm lint-fix       # Auto-fix linting issues
pnpm check          # Type check all packages
pnpm clean          # Clean build artifacts in all packages

# Work on specific packages
pnpm --filter @graphprotocol/graph-horizon-cli build
pnpm --filter @graphprotocol/graph-horizon-cli test
```

### CLI Package (`packages/cli`)
```bash
cd packages/cli
pnpm build          # Build the CLI (tsup + copy package.json)
pnpm test           # Run tests with vitest
pnpm check          # Type check without building

# After building, run the CLI
node dist/bin.js config              # Show current configuration
node dist/bin.js protocol            # Fetch protocol network data with validation
node dist/bin.js indexer <address>   # Fetch indexer data with validation
```

## Architecture

### CLI Package Architecture (`packages/cli`)

The CLI is built on the [Effect](https://effect.website) functional programming framework, which provides:
- **Services**: Context-based dependency injection via `Context.Tag`
- **Layers**: Composable service implementations via `Layer`
- **Error Handling**: Typed errors with `Data.TaggedError`
- **Effects**: Pure description of computations with `Effect`

### Service Layer Architecture

The CLI uses a hierarchical service architecture defined in `packages/cli/src/Cli.ts:9-21`:

```
AppLayer
├── ConfigServiceLive (reads .env configuration)
├── NetworkSubgraphLive (GraphQL queries)
│   └── requires ConfigService
├── NetworkRPCLive (RPC contract calls)
│   └── requires ConfigService
└── NetworkServiceLive (data validation)
    ├── requires NetworkRPC
    └── requires NetworkSubgraph
```

**ConfigService** (`packages/cli/src/services/ConfigService.ts`):
- Loads and validates configuration from environment variables (`.env` file)
- Required: `RPC_URL`, `SUBGRAPH_URL`, `STUDIO_API_KEY`
- Uses `@effect/schema` for validation

**NetworkRPC** (`packages/cli/src/services/network/NetworkRPC.ts`):
- Fetches on-chain data using ethers.js JsonRpcProvider
- Connects to Graph Horizon contracts via `@graphprotocol/toolshed`
- Notable: Uses direct storage reads for legacy data (`getLegacyData` function)

**NetworkSubgraph** (`packages/cli/src/services/network/NetworkSubgraph.ts`):
- Fetches indexed data via GraphQL queries from `.graphql` files in `packages/cli/src/services/network/queries/`
- Loads queries at runtime using `NetworkSubgraph.loadQuery()`
- Returns data in the same shape as RPC for easy comparison

**NetworkService** (`packages/cli/src/services/network/NetworkService.ts`):
- High-level service that orchestrates RPC and Subgraph queries
- Runs both data sources in parallel using `Effect.all` with `concurrency: "unbounded"`
- Compares results using deep equality checks (`findMismatches`, `deepEqual`)
- Returns `NetworkResult<T>` containing both data and any detected mismatches
- Validates final data against schemas in `packages/cli/src/services/network/schemas/`

### Command Structure

Commands are defined using `@effect/cli` in `packages/cli/src/commands/`:
- `config.ts`: Display current configuration
- `protocol.ts`: Fetch and validate protocol-wide settings (Graph Horizon, SubgraphService, DisputeManager)
- `indexer.ts`: Fetch and validate data for a specific indexer address

Each command handler:
1. Gets dependencies via Effect's dependency injection
2. Calls NetworkService methods
3. Uses Display utilities (`packages/cli/src/utils/Display.ts`) to format output
4. Reports any data mismatches between RPC and Subgraph

### Data Flow

1. CLI entry point: `packages/cli/src/bin.ts` → `packages/cli/src/Cli.ts`
2. Command handler requests NetworkService
3. NetworkService fetches from both NetworkRPC and NetworkSubgraph in parallel
4. Results are compared for mismatches
5. RPC data is validated against `@effect/schema` schemas
6. Results displayed to user with mismatch warnings if present

### Schema Definitions

Schemas in `packages/cli/src/services/network/schemas/` define the shape and types of:
- `GraphNetwork.ts`: Horizon staking parameters (e.g., maxThawingPeriod)
- `SubgraphService.ts`: Service-specific parameters (provision ranges, verifier cuts, etc.)
- `DisputeManager.ts`: Dispute resolution parameters
- `Indexer.ts`: Indexer-specific data (stake, provisions, allocations)

Each schema file exports both an RPC response type and a Subgraph response type.

### Configuration

The CLI requires a `.env` file in `packages/cli/` (see `packages/cli/.env.example`):
- Local development: Uses localhost endpoints
- Live network: Uses Alchemy/Infura RPC + Graph hosted service

Contract addresses are loaded from `packages/cli/addresses.json` via `@graphprotocol/toolshed`.

## Testing

Tests use vitest with `@effect/vitest` integration. Test files in `packages/cli/test/` directory follow the pattern `*.test.ts`.

## Build System

- **Monorepo**: pnpm workspace with packages in `packages/` directory
- **CLI Build**: tsup bundles TypeScript to ESM format, entry point is `packages/cli/src/bin.ts`
- **Multiple tsconfig files**: Each package has its own TypeScript config, root has references to all packages
- **Package manager**: pnpm with strict version (10.14.0)

## Working with Effect (CLI Package)

When adding new functionality to the CLI:
1. Define services using `Context.Tag` with interface definitions
2. Implement services in `Layer` using `Layer.effect`
3. Compose layers in `packages/cli/src/Cli.ts` AppLayer
4. Use `Effect.gen` for generator-style async code
5. Handle errors with typed error classes extending `Data.TaggedError`
6. Use `Schema.decodeUnknown` for runtime validation

## Adding New Tools

To add a new tool to this monorepo:
1. Create directory: `mkdir packages/your-tool`
2. Add `package.json` with `@graphprotocol/your-tool` name
3. Add appropriate build/test scripts
4. Tool will be automatically picked up by workspace
5. Update root README.md to list the new tool
