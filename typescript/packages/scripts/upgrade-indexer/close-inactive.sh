#!/bin/bash
# Queue unallocate actions for inactive legacy allocations (from skipped-inactive.log)

set -e

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"
BATCH_SIZE="${BATCH_SIZE:-10}"
SKIPPED_INACTIVE_LOG="${SKIPPED_INACTIVE_LOG:-skipped-inactive.log}"
SOURCE="${SOURCE:-horizon-bulk-unallocate}"
REASON="inactive-deployment"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Queue Unallocate Actions (Inactive) ===${NC}"
echo "Network: $NETWORK"
echo "Batch size: $BATCH_SIZE"
echo "Skipped log: $SKIPPED_INACTIVE_LOG"
echo "Source: $SOURCE"
echo ""

# Check if skipped log exists
if [[ ! -f "$SKIPPED_INACTIVE_LOG" ]]; then
    echo -e "${RED}Error: $SKIPPED_INACTIVE_LOG not found${NC}"
    exit 1
fi

# Fetch already queued unallocate actions
echo "Fetching already queued unallocate actions..."
ALREADY_QUEUED_ALLOCS=""
ACTIONS_TMPFILE=$(mktemp)
for status in queued approved pending; do
    if graph-indexer indexer actions get \
        --network "$NETWORK" \
        --status "$status" \
        --type unallocate \
        -o json > "$ACTIONS_TMPFILE" 2>/dev/null; then
        if jq -e . "$ACTIONS_TMPFILE" >/dev/null 2>&1; then
            BATCH_ALLOC_IDS=$(jq -r '.[].allocationID // empty' "$ACTIONS_TMPFILE" 2>/dev/null || echo "")
            if [[ -n "$BATCH_ALLOC_IDS" ]]; then
                if [[ -n "$ALREADY_QUEUED_ALLOCS" ]]; then
                    ALREADY_QUEUED_ALLOCS="$ALREADY_QUEUED_ALLOCS"$'\n'"$BATCH_ALLOC_IDS"
                else
                    ALREADY_QUEUED_ALLOCS="$BATCH_ALLOC_IDS"
                fi
            fi
        fi
    fi
done
rm -f "$ACTIONS_TMPFILE"
if [[ -z "$ALREADY_QUEUED_ALLOCS" ]]; then
    ALREADY_QUEUED_COUNT=0
else
    ALREADY_QUEUED_COUNT=$(echo "$ALREADY_QUEUED_ALLOCS" | wc -l | tr -d ' ')
fi
echo "Found $ALREADY_QUEUED_COUNT unallocate actions already queued"
echo ""

# Check if allocation is already queued
is_allocation_already_queued() {
    local alloc_id="$1"
    echo "$ALREADY_QUEUED_ALLOCS" | grep -qi "$alloc_id"
}

# Get unique allocations from skipped log (DEPLOYMENT<tab>ALLOC_ID format)
# Sort by allocation ID to dedupe
TOTAL_COUNT=$(cut -f2 "$SKIPPED_INACTIVE_LOG" | sort -u | grep -c . || true)

if [[ "$TOTAL_COUNT" -eq 0 ]]; then
    echo -e "${GREEN}No allocations to queue${NC}"
    exit 0
fi

echo "Found $TOTAL_COUNT total inactive allocations"
echo "Queueing up to $BATCH_SIZE..."
echo ""

# Track counts
QUEUED=0
SKIPPED=0
FAILED=0

# Process each line (DEPLOYMENT<tab>ALLOC_ID)
while IFS=$'\t' read -r DEPLOYMENT ALLOC_ID; do
    [[ -z "$ALLOC_ID" ]] && continue

    # Stop if we've queued enough
    if [[ "$QUEUED" -ge "$BATCH_SIZE" ]]; then
        break
    fi

    echo -n "  $ALLOC_ID ($DEPLOYMENT)... "

    # Check if already queued
    if is_allocation_already_queued "$ALLOC_ID"; then
        echo -e "${YELLOW}SKIPPED (already queued)${NC}"
        ((SKIPPED++)) || true
        continue
    fi

    # Queue unallocate action
    # Syntax: unallocate <deploymentID> <allocationID> <poi> <force> <blockNumber> <publicPOI>
    TMPFILE=$(mktemp)
    set +e
    graph-indexer indexer actions queue unallocate \
        "$DEPLOYMENT" \
        "$ALLOC_ID" \
        0x0 \
        true \
        0 \
        0x0 \
        --network "$NETWORK" \
        --source "$SOURCE" \
        --reason "$REASON" \
        -o json > "$TMPFILE" 2>&1
    EXIT_CODE=$?
    set -e

    if [[ $EXIT_CODE -eq 0 ]]; then
        echo -e "${GREEN}QUEUED${NC}"
        ((QUEUED++)) || true
    else
        echo -e "${RED}FAILED${NC}"
        echo "    Command: graph indexer actions queue unallocate $DEPLOYMENT $ALLOC_ID 0x0 true 0 0x0 --network $NETWORK --source $SOURCE --reason $REASON"
        echo "    Output:"
        cat "$TMPFILE" | sed 's/^/    /'
        ((FAILED++)) || true
    fi
    rm -f "$TMPFILE"
done < <(sort -t$'\t' -k2 -u "$SKIPPED_INACTIVE_LOG")

echo ""
echo -e "${GREEN}=== Done! ===${NC}"
echo "Queued: $QUEUED"
echo "Skipped (already queued): $SKIPPED"
echo "Failed: $FAILED"
echo "Remaining: $((TOTAL_COUNT - QUEUED - SKIPPED))"
echo ""
echo "Next steps:"
echo "  1. Approve: SOURCE=$SOURCE ./approve.sh"
echo "  2. Execute: ./execute.sh"
