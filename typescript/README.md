# Graph Horizon Tools

Collection of tools for debugging and working with The Graph's Horizon protocol.

## Tools

### [@graphprotocol/graph-horizon-cli](./packages/cli)

CLI tool for inspecting and validating Graph Horizon protocol data. Queries both on-chain (RPC) and indexed (Subgraph) data sources in parallel to detect inconsistencies.

**Features:**
- View protocol configuration (staking parameters, dispute settings, etc.)
- Inspect indexer data (stake, provisions, allocations)
- Automatic validation between RPC and Subgraph data
- Detailed reporting of data mismatches

## Getting Started

This is a pnpm workspace monorepo. To get started:

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Lint all packages
pnpm lint
```

## Adding New Tools

To add a new tool to this repository:

1. Create a new directory under `packages/`:
   ```bash
   mkdir packages/your-tool
   ```

2. Initialize with a `package.json`:
   ```json
   {
     "name": "@graphprotocol/your-tool",
     "version": "0.0.0",
     "type": "module",
     "license": "MIT"
   }
   ```

3. The workspace will automatically pick it up

## Development

Each package is independent and can be developed separately:

```bash
# Work on CLI
cd packages/cli
pnpm build
pnpm test

# Run from root with filters
pnpm --filter @graphprotocol/graph-horizon-cli build
```

## License

MIT
