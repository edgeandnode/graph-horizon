#!/bin/bash
# Create allocations for legacy allocations that were closed without a horizon replacement

set -e

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"
BEFORE="${BEFORE:-allos-snapshot-before.json}"
AFTER="${AFTER:-allos-snapshot-current.json}"
AMOUNT="${AMOUNT:-1}"
DRY_RUN="${DRY_RUN:-true}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Create Lost Allocations ===${NC}"
echo "Network: $NETWORK"
echo "Before: $BEFORE"
echo "After: $AFTER"
echo "Amount: $AMOUNT"
echo "Dry run: $DRY_RUN"
echo ""

# Check if files exist
if [[ ! -f "$BEFORE" ]]; then
    echo -e "${RED}Error: $BEFORE not found${NC}"
    exit 1
fi
if [[ ! -f "$AFTER" ]]; then
    echo -e "${RED}Error: $AFTER not found${NC}"
    exit 1
fi

# Get lost deployments (legacy closed without horizon replacement)
# Using INDEX for O(1) lookups instead of O(n) with index()
LOST=$(jq -r -n --slurpfile before "$BEFORE" --slurpfile after "$AFTER" '
  ($after[0] | [.[] | .subgraphDeployment] | INDEX(.) ) as $after_deps |
  [$before[0][] | select(.isLegacy == "Yes" and ($after_deps[.subgraphDeployment] == null))]
  | .[].subgraphDeployment
' | sort -u)

LOST_COUNT=$(echo "$LOST" | grep -c . || true)

echo -e "Found ${RED}$LOST_COUNT${NC} lost deployments to recreate"
echo ""

if [[ "$LOST_COUNT" -eq 0 ]]; then
    echo -e "${GREEN}No lost allocations to create${NC}"
    exit 0
fi

SOURCE="${SOURCE:-horizon-create-lost}"
REASON="create-lost-allocation"

if [[ "$DRY_RUN" == "true" ]]; then
    echo -e "${YELLOW}DRY RUN - Commands that would be executed:${NC}"
    echo ""
    echo "$LOST" | while read -r deployment; do
        echo "graph indexer actions queue allocate $deployment $AMOUNT --network $NETWORK --source $SOURCE --reason $REASON"
    done
    echo ""
    echo -e "${YELLOW}To execute, run with DRY_RUN=false${NC}"
else
    echo "Queueing allocations..."
    echo ""

    CURRENT=0

    echo "$LOST" | while read -r deployment; do
        ((CURRENT++)) || true
        PERCENT=$((CURRENT * 100 / LOST_COUNT))
        echo -n "[$CURRENT/$LOST_COUNT] ($PERCENT%) Queueing $deployment... "
        if graph indexer actions queue allocate "$deployment" "$AMOUNT" --network "$NETWORK" --source "$SOURCE" --reason "$REASON" > /dev/null 2>&1; then
            echo -e "${GREEN}OK${NC}"
        else
            echo -e "${RED}FAILED${NC}"
        fi
    done

    echo ""
    echo -e "${GREEN}Done! Run approve.sh and execute.sh to process the queued actions.${NC}"
fi
