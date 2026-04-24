#!/bin/bash
# Fetches active allocations and saves to $ALLOCATIONS_FILE

set -e

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"
ALLOCATIONS_FILE="${ALLOCATIONS_FILE:-allocations.json}"

# Check if $ALLOCATIONS_FILE already exists and show previous counts
if [ -f "$ALLOCATIONS_FILE" ]; then
  echo "Previous $ALLOCATIONS_FILE found:"
  prev_legacy=$(jq '[.[] | select(.isLegacy == "Yes")] | length' "$ALLOCATIONS_FILE")
  prev_horizon=$(jq '[.[] | select(.isLegacy == "No")] | length' "$ALLOCATIONS_FILE")
  echo "- Legacy allocations: $prev_legacy"
  echo "- Horizon allocations: $prev_horizon"
  echo ""
fi

# Fetch active allocations and save to JSON file
graph-indexer indexer allocations --network "$NETWORK" get --status active --output json > "$ALLOCATIONS_FILE"

echo "Saved allocations to $ALLOCATIONS_FILE"

# Count allocations by type
legacy_count=$(jq '[.[] | select(.isLegacy == "Yes")] | length' "$ALLOCATIONS_FILE")
horizon_count=$(jq '[.[] | select(.isLegacy == "No")] | length' "$ALLOCATIONS_FILE")

echo "- Legacy allocations: $legacy_count"
echo "- Horizon allocations: $horizon_count"