#!/bin/bash

# Fetches all indexer addresses from the Graph Network subgraph at a specific block
# and outputs them in AssemblyScript array format
#
# Usage: GRAPH_API_KEY=your_key ./scripts/fetch-indexers.sh > src/config/arbitrum-one/seed.ts
#
# Set BLOCK_NUMBER env var to query at a specific block (defaults to Horizon Arbitrum One genesis: 408825706)

if [ -z "$GRAPH_API_KEY" ]; then
  echo "Error: GRAPH_API_KEY environment variable is required" >&2
  exit 1
fi

BLOCK_NUMBER=${BLOCK_NUMBER:-408825706}

echo "Fetching indexers at block $BLOCK_NUMBER..." >&2

curl -sX POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $GRAPH_API_KEY" \
  -d "{\"query\": \"{ indexers(block: { number: $BLOCK_NUMBER }, where: { stakedTokens_gt: \\\"0\\\" }) { id } }\", \"variables\": {}}" \
  https://gateway.thegraph.com/api/subgraphs/id/DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp \
  | jq -r '.data.indexers[].id' \
  | awk -v block="$BLOCK_NUMBER" 'BEGIN{
      print "// AUTO-GENERATED FILE - DO NOT EDIT MANUALLY"
      print "// Regenerate with: GRAPH_API_KEY=your_key ./scripts/fetch-indexers.sh > src/config/arbitrum-one/seed.ts"
      print "// Generated at block: " block
      print ""
      print "export const SERVICE_PROVIDER_ADDRESSES: string[] = ["
    } {print "  \""$0"\","} END{print "]"}'
