#!/bin/bash
# Approves queued reallocate actions

set -e

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"
SOURCE="${SOURCE:-horizon-bulk-reallocate}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Approve Queued Actions ===${NC}"
echo "Network: $NETWORK"
echo "Source: $SOURCE"
echo ""

# Get queued actions
set +e
RESULT=$(graph-indexer indexer actions get --status queued --source "$SOURCE" --network "$NETWORK" -o json 2>/dev/null)
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]] || [[ "$RESULT" == "No actions found" ]] || [[ -z "$RESULT" ]] || [[ "$RESULT" == "[]" ]]; then
    echo -e "${YELLOW}No queued actions to approve${NC}"
    exit 0
fi

# Check if result is valid JSON
if ! echo "$RESULT" | jq -e . >/dev/null 2>&1; then
    echo -e "${YELLOW}No queued actions to approve${NC}"
    exit 0
fi

QUEUED_COUNT=$(echo "$RESULT" | jq length)

if [[ "$QUEUED_COUNT" -eq 0 ]]; then
    echo -e "${YELLOW}No queued actions to approve${NC}"
    exit 0
fi

echo "Found $QUEUED_COUNT queued actions to approve"

# Get IDs and approve them
APPROVE_IDS=$(echo "$RESULT" | jq -r '.[].id' | tr '\n' ' ')

if graph-indexer indexer actions approve $APPROVE_IDS > /dev/null 2>&1; then
    echo -e "${GREEN}Approved $QUEUED_COUNT actions${NC}"
else
    echo -e "${RED}Failed to approve some actions${NC}"
    exit 1
fi
