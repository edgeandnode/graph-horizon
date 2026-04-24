#!/bin/bash
# Compare two allocation snapshots

set -e

BEFORE="${1:-allos-snapshot-before.json}"
AFTER="${2:-allos-snapshot-current.json}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOST_ALLOWLIST="${LOST_ALLOWLIST:-$SCRIPT_DIR/lost-allowlist.txt}"
QUEUED_DEPLOYMENTS_LOG="${QUEUED_DEPLOYMENTS_LOG:-$SCRIPT_DIR/queued-deployments.log}"
POD="${POD:-shell-0}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Allocation Snapshot Comparison ===${NC}"
echo "Before: $BEFORE"
echo "After:  $AFTER"
echo "Pod:    $POD"
echo ""

# Check files exist
if [[ ! -f "$BEFORE" ]]; then
    echo -e "${RED}Error: $BEFORE not found${NC}"
    exit 1
fi
if [[ ! -f "$AFTER" ]]; then
    echo -e "${RED}Error: $AFTER not found${NC}"
    exit 1
fi

# Count totals
BEFORE_TOTAL=$(jq length "$BEFORE")
AFTER_TOTAL=$(jq length "$AFTER")

BEFORE_LEGACY=$(jq '[.[] | select(.isLegacy == "Yes")] | length' "$BEFORE")
BEFORE_HORIZON=$(jq '[.[] | select(.isLegacy == "No")] | length' "$BEFORE")

AFTER_LEGACY=$(jq '[.[] | select(.isLegacy == "Yes")] | length' "$AFTER")
AFTER_HORIZON=$(jq '[.[] | select(.isLegacy == "No")] | length' "$AFTER")

echo -e "${YELLOW}=== Counts ===${NC}"
echo "                Before    After     Change"
echo "  Total:        $BEFORE_TOTAL        $AFTER_TOTAL        $((AFTER_TOTAL - BEFORE_TOTAL))"
echo "  Legacy:       $BEFORE_LEGACY        $AFTER_LEGACY        $((AFTER_LEGACY - BEFORE_LEGACY))"
echo "  Horizon:      $BEFORE_HORIZON        $AFTER_HORIZON        $((AFTER_HORIZON - BEFORE_HORIZON))"
echo ""

# Migrated: legacy allocations that now have a horizon allocation for the same deployment
MIGRATED_COUNT=$(jq -n --slurpfile before "$BEFORE" --slurpfile after "$AFTER" '
  ($after[0] | [.[] | select(.isLegacy == "No") | .subgraphDeployment] | unique) as $horizon_deps |
  [$before[0][] | select(.isLegacy == "Yes" and (.subgraphDeployment as $dep | $horizon_deps | index($dep)))] | length
')

echo -e "${YELLOW}=== Sanity Checks ===${NC}"
echo -e "  Migrated to Horizon: ${GREEN}$MIGRATED_COUNT${NC}"

# Lost: legacy allocations that were closed and don't have a horizon replacement
LOST=$(jq -r -n --slurpfile before "$BEFORE" --slurpfile after "$AFTER" '
  ($after[0] | [.[] | .subgraphDeployment] | unique) as $after_deps |
  [$before[0][] | select(.isLegacy == "Yes" and (.subgraphDeployment as $dep | $after_deps | index($dep) | not))]
  | .[] | "\(.subgraphDeployment)\t\(.id)"
')

LOST_COUNT=$(echo "$LOST" | grep -c . || true)

# Deployments with both legacy and horizon allocations
BOTH=$(jq -r '[group_by(.subgraphDeployment)[] | select((map(select(.isLegacy == "Yes")) | length > 0) and (map(select(.isLegacy == "No")) | length > 0)) | .[0].subgraphDeployment][]' "$AFTER")
BOTH_COUNT=$(echo "$BOTH" | grep -c . || true)

# Deployments with multiple horizon allocations
MULTI_HORIZON=$(jq -r '[group_by(.subgraphDeployment)[] | select((map(select(.isLegacy == "No")) | length > 1)) | .[0].subgraphDeployment][]' "$AFTER")
MULTI_HORIZON_COUNT=$(echo "$MULTI_HORIZON" | grep -c . || true)

echo -e "  Deployments with both allos: ${YELLOW}$BOTH_COUNT${NC}"
echo -e "  Deployments with multiple Horizon allos: ${RED}$MULTI_HORIZON_COUNT${NC}"
echo -e "  Legacy closed without Horizon replacement: ${RED}$LOST_COUNT${NC}"

if [[ -n "$LOST" && "$LOST_COUNT" -gt 0 ]]; then
    echo ""
    echo -e "${RED}Lost allocations:${NC}"
    echo "$LOST" | while IFS=$'\t' read -r deployment id; do
        echo "  $deployment ($id)"
    done
fi

echo ""

# Sanity check validation
LEGACY_CHANGE=$((BEFORE_LEGACY - AFTER_LEGACY))
FAILED=0

if [[ "$MIGRATED_COUNT" -ne "$LEGACY_CHANGE" ]]; then
    echo -e "${YELLOW}Note: Migrated ($MIGRATED_COUNT) != Legacy change ($LEGACY_CHANGE)${NC}"
fi

if [[ "$BOTH_COUNT" -ne 0 ]]; then
    echo -e "${RED}SANITY CHECK FAILED: Deployments with both allos ($BOTH_COUNT) != 0${NC}"
    echo -e "${RED}Problematic deployments:${NC}"
    jq -r '[group_by(.subgraphDeployment)[] | select((map(select(.isLegacy == "Yes")) | length > 0) and (map(select(.isLegacy == "No")) | length > 0)) | {deployment: .[0].subgraphDeployment, legacy: [.[] | select(.isLegacy == "Yes") | .id], horizon: [.[] | select(.isLegacy == "No") | .id]}] | .[] | "  \(.deployment)\n    Legacy:  \(.legacy | join(", "))\n    Horizon: \(.horizon | join(", "))"' "$AFTER"
    FAILED=1
fi

if [[ "$MULTI_HORIZON_COUNT" -ne 0 ]]; then
    echo -e "${RED}SANITY CHECK FAILED: Deployments with multiple Horizon allos ($MULTI_HORIZON_COUNT) != 0${NC}"
    FAILED=1
fi

# Filter lost allocations against allowlist
if [[ -f "$LOST_ALLOWLIST" && -n "$LOST" && "$LOST_COUNT" -gt 0 ]]; then
    LOST_NOT_ALLOWED=$(echo "$LOST" | while IFS=$'\t' read -r deployment id; do
        if ! grep -q "^$deployment$" "$LOST_ALLOWLIST"; then
            echo -e "$deployment\t$id"
        fi
    done)
    LOST_NOT_ALLOWED_COUNT=$(echo "$LOST_NOT_ALLOWED" | grep -c . || true)
elif [[ -f "$LOST_ALLOWLIST" ]]; then
    LOST_NOT_ALLOWED=""
    LOST_NOT_ALLOWED_COUNT=0
else
    LOST_NOT_ALLOWED="$LOST"
    LOST_NOT_ALLOWED_COUNT="$LOST_COUNT"
fi

if [[ "$LOST_NOT_ALLOWED_COUNT" -ne 0 ]]; then
    echo -e "${RED}SANITY CHECK FAILED: Legacy closed without Horizon replacement ($LOST_NOT_ALLOWED_COUNT not in allowlist) != 0${NC}"
    echo -e "${RED}Deployments not in allowlist:${NC}"
    echo "$LOST_NOT_ALLOWED" | while IFS=$'\t' read -r deployment id; do
        echo "  $deployment ($id)"
    done
    FAILED=1
fi

# Check that queued deployments from this batch are active
echo ""
echo -e "${YELLOW}=== Deployment Health Check ===${NC}"

if [[ -f "$QUEUED_DEPLOYMENTS_LOG" ]]; then
    QUEUED_DEPLOYMENTS=$(cat "$QUEUED_DEPLOYMENTS_LOG")
    QUEUED_COUNT=$(grep -c . "$QUEUED_DEPLOYMENTS_LOG" || true)
else
    QUEUED_DEPLOYMENTS=""
    QUEUED_COUNT=0
fi

if [[ -n "$QUEUED_DEPLOYMENTS" && "$QUEUED_COUNT" -gt 0 ]]; then
    echo "Checking $QUEUED_COUNT deployments from this batch..."

    # Check all deployments in a single kubectl exec
    INACTIVE_DEPLOYMENTS=$(kubectl exec "$POD" -- bash -c '
        for dep in "$@"; do
            graphman info "$dep" 2>/dev/null | grep -q "Active.*true" || echo "$dep"
        done
    ' _ $QUEUED_DEPLOYMENTS)

    INACTIVE_COUNT=$(echo "$INACTIVE_DEPLOYMENTS" | grep -c . || true)
else
    echo "No queued deployments to check"
    INACTIVE_DEPLOYMENTS=""
    INACTIVE_COUNT=0
fi

if [[ "$INACTIVE_COUNT" -gt 0 ]]; then
    echo -e "${RED}SANITY CHECK FAILED: $INACTIVE_COUNT deployments from this batch are not active:${NC}"
    echo "$INACTIVE_DEPLOYMENTS" | while IFS= read -r dep; do
        [[ -n "$dep" ]] && echo "  $dep"
    done
    FAILED=1
elif [[ "$QUEUED_COUNT" -gt 0 ]]; then
    echo -e "${GREEN}All deployments from this batch are active${NC}"
fi

if [[ "$FAILED" -eq 1 ]]; then
    echo -e "${RED}=== Sanity checks FAILED ===${NC}"
    exit 1
else
    echo -e "${GREEN}=== Sanity checks PASSED ===${NC}"
fi
