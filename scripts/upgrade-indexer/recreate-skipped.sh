#!/bin/bash
# Recreates skipped-inactive.log by checking all legacy allocations

set -e

# Configuration
ALLOCATIONS_FILE="${ALLOCATIONS_FILE:-allocations.json}"
SKIPPED_INACTIVE_LOG="${SKIPPED_INACTIVE_LOG:-skipped-inactive.log}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if deployment is active via graphman
is_deployment_active() {
    local deployment="$1"
    local output
    output=$(graphman info "$deployment" 2>/dev/null)
    echo "$output" | grep -q "Active.*true"
}

echo -e "${YELLOW}=== Recreate Skipped Inactive Log ===${NC}"
echo "Allocations file: $ALLOCATIONS_FILE"
echo "Output: $SKIPPED_INACTIVE_LOG"
echo ""

# Check if allocations file exists
if [[ ! -f "$ALLOCATIONS_FILE" ]]; then
    echo -e "${RED}Error: Allocations file not found: $ALLOCATIONS_FILE${NC}"
    exit 1
fi

# Get all legacy allocations
LEGACY_ALLOCS=$(jq -c '[.[] | select(.isLegacy == "Yes")]' "$ALLOCATIONS_FILE")
TOTAL_COUNT=$(echo "$LEGACY_ALLOCS" | jq length)

echo "Found $TOTAL_COUNT legacy allocations to check"
echo ""

# Clear the log file
> "$SKIPPED_INACTIVE_LOG"

# Get unique deployments first to avoid checking the same deployment multiple times
UNIQUE_DEPLOYMENTS=$(echo "$LEGACY_ALLOCS" | jq -r '.[].subgraphDeployment' | sort -u)
UNIQUE_COUNT=$(echo "$UNIQUE_DEPLOYMENTS" | wc -l | tr -d ' ')

echo "Checking $UNIQUE_COUNT unique deployments..."
echo ""

# Build list of inactive deployments
INACTIVE_FILE=$(mktemp)
CHECKED=0
INACTIVE=0

while IFS= read -r deployment; do
    CHECKED=$((CHECKED + 1))
    echo -ne "\r  Checking deployment $CHECKED / $UNIQUE_COUNT..."

    if ! is_deployment_active "$deployment"; then
        echo "$deployment" >> "$INACTIVE_FILE"
        INACTIVE=$((INACTIVE + 1))
    fi
done <<< "$UNIQUE_DEPLOYMENTS"

echo ""
echo ""
echo "Found $INACTIVE inactive deployments out of $UNIQUE_COUNT"
echo ""

# Now write all allocations for inactive deployments to the log
echo "Writing skipped allocations..."
while IFS= read -r deployment; do
    # Get all allocation IDs for this deployment
    echo "$LEGACY_ALLOCS" | jq -r --arg dep "$deployment" '.[] | select(.subgraphDeployment == $dep) | "\($dep)\t\(.id)"' >> "$SKIPPED_INACTIVE_LOG"
done < "$INACTIVE_FILE"

rm -f "$INACTIVE_FILE"

FINAL_COUNT=$(wc -l < "$SKIPPED_INACTIVE_LOG" | tr -d ' ')

echo ""
echo -e "${GREEN}=== Done! ===${NC}"
echo "Wrote $FINAL_COUNT entries to $SKIPPED_INACTIVE_LOG"
