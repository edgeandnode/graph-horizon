#!/bin/bash
# Executes approved reallocate actions

set -e

# Configuration
NETWORK="${NETWORK:-arbitrum-one}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Execute Approved Actions ===${NC}"
echo ""

# Check if there are any approved actions first
set +e
RESULT=$(graph indexer actions get --status approved --network "$NETWORK" -o json 2>/dev/null)
EXIT_CODE=$?
set -e

if [[ $EXIT_CODE -ne 0 ]] || [[ "$RESULT" == "No actions found" ]] || [[ -z "$RESULT" ]] || [[ "$RESULT" == "[]" ]]; then
    echo -e "${YELLOW}No approved actions to execute${NC}"
    exit 0
fi

# Check if result is valid JSON
if ! echo "$RESULT" | jq -e . >/dev/null 2>&1; then
    echo -e "${YELLOW}No approved actions to execute${NC}"
    exit 0
fi

APPROVED_COUNT=$(echo "$RESULT" | jq length)

if [[ "$APPROVED_COUNT" -eq 0 ]]; then
    echo -e "${YELLOW}No approved actions to execute${NC}"
    exit 0
fi

echo "Found $APPROVED_COUNT approved actions to execute"
echo ""

set +e
EXEC_OUTPUT=$(graph indexer actions execute approved -o json 2>&1)
EXEC_EXIT_CODE=$?
set -e

if [[ $EXEC_EXIT_CODE -eq 0 ]]; then
    echo -e "${GREEN}Execution complete${NC}"
elif [[ "$EXEC_OUTPUT" == *"No approved actions"* ]] || [[ "$EXEC_OUTPUT" == *"No actions"* ]]; then
    echo -e "${YELLOW}No approved actions to execute${NC}"
else
    echo -e "${RED}Execution failed${NC}"
    exit 1
fi
