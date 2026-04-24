#!/bin/bash
# Close duplicate legacy allocations, keeping the one with highest allocatedTokens

set -e

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"
ALLOCATIONS_FILE="${ALLOCATIONS_FILE:-allocations.json}"
DRY_RUN="${DRY_RUN:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Close Duplicate Legacy Allocations ===${NC}"
echo "Network: $NETWORK"
echo "Allocations file: $ALLOCATIONS_FILE"
echo "Dry run: $DRY_RUN"
echo ""

# Check if allocations file exists
if [[ ! -f "$ALLOCATIONS_FILE" ]]; then
    echo -e "${RED}Error: $ALLOCATIONS_FILE not found${NC}"
    exit 1
fi

# Get allocations to close (all except the one with highest allocatedTokens per deployment)
TO_CLOSE=$(jq -r '
  group_by(.subgraphDeployment)
  | map(select((map(select(.isLegacy == "Yes")) | length) > 1))
  | map(
      (map(select(.isLegacy == "Yes")) | sort_by(-(.allocatedTokens | gsub(","; "") | tonumber))) as $sorted
      | $sorted[1:]
      | .[]
    )
  | .[]
  | .id
' "$ALLOCATIONS_FILE")

TO_CLOSE_COUNT=$(echo "$TO_CLOSE" | grep -c . || true)

echo -e "Found ${RED}$TO_CLOSE_COUNT${NC} duplicate allocations to close"
echo ""

if [[ "$TO_CLOSE_COUNT" -eq 0 ]]; then
    echo -e "${GREEN}No duplicates to close${NC}"
    exit 0
fi

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - Commands that would be executed:${NC}"
    echo ""
    echo "$TO_CLOSE" | while read -r alloc_id; do
        echo "graph indexer allocations close --network $NETWORK $alloc_id 0x0 --force"
    done
    echo ""
    echo -e "${YELLOW}To execute, run with DRY_RUN=false${NC}"
else
    echo "Closing allocations..."
    echo ""

    SUCCESS=0
    FAILED=0
    CURRENT=0

    echo "$TO_CLOSE" | while read -r alloc_id; do
        ((CURRENT++)) || true
        PERCENT=$((CURRENT * 100 / TO_CLOSE_COUNT))
        echo -e "[$CURRENT/$TO_CLOSE_COUNT] ($PERCENT%) Closing $alloc_id..."
        if graph indexer allocations close --network "$NETWORK" "$alloc_id" 0x0 --force 2>&1; then
            echo -e "  ${GREEN}OK${NC}"
            ((SUCCESS++)) || true
        else
            echo -e "  ${RED}FAILED${NC}"
            ((FAILED++)) || true
        fi
        echo ""
    done

    echo ""
    echo -e "${GREEN}Done!${NC}"
fi
