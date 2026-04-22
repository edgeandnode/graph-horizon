# Graph Horizon CLI

CLI tool for debugging and inspecting Graph Horizon protocol data with automatic RPC/Subgraph validation.

## Setup

Create a `.env` file based on `.env.example`:

```bash
cp .env.example .env
```

Configure your endpoints:
- `RPC_URL`: Ethereum RPC endpoint (e.g., Alchemy, Infura, or localhost)
- `SUBGRAPH_URL`: The Graph subgraph endpoint
- `STUDIO_API_KEY`: The Graph Studio API key

## Building

```bash
pnpm build
```

## Commands

### Show Configuration
```bash
node dist/bin.js config
```

### Protocol Data
Fetch and validate protocol-wide settings:
```bash
node dist/bin.js protocol
```

### Indexer Data
Fetch and validate data for a specific indexer:
```bash
node dist/bin.js indexer <address>
```

## How It Works

The CLI queries both RPC (on-chain) and Subgraph (indexed) data sources in parallel, then compares the results to detect any inconsistencies. This helps identify potential indexing issues or data drift between sources.
