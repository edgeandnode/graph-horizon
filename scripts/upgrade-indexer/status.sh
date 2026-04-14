#!/bin/bash
# Display current status of reallocate actions

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"
SOURCE="${SOURCE:-horizon-bulk-reallocate}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Reallocate Actions Status ===${NC}"
echo "Network: $NETWORK"
echo "Source: $SOURCE"
echo ""

# Helper function to get action count (handles "No actions found" case)
get_count() {
    local result
    result=$(graph indexer actions get --status "$1" --source "$SOURCE" --network "$NETWORK" -o json 2>/dev/null)
    if [[ "$result" == "No actions found" ]] || [[ -z "$result" ]]; then
        echo "0"
    else
        echo "$result" | jq length
    fi
}

echo "Current status:"
echo "  Queued:   $(get_count queued)"
echo "  Approved: $(get_count approved)"
echo "  Pending:  $(get_count pending)"
echo "  Success:  $(get_count success)"
echo "  Failed:   $(get_count failed)"
