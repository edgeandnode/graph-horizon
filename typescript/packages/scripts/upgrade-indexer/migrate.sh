#!/bin/bash
# Full migration workflow: queue -> approve -> execute -> status

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration (inherited by subscripts)
export NETWORK="${NETWORK:-arbitrum-one}"
export BATCH_SIZE="${BATCH_SIZE:-1}"
export SOURCE="${SOURCE:-horizon-bulk-reallocate}"
export ALLOCATIONS_FILE="${ALLOCATIONS_FILE:-allocations.json}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Migration Workflow ===${NC}"
echo "Network: $NETWORK"
echo "Batch size: $BATCH_SIZE"
echo "Source: $SOURCE"
echo "Allocations file: $ALLOCATIONS_FILE"
echo ""

TOTAL_START=$SECONDS

# Step 1: Fetch
echo -e "${YELLOW}[Step 1/5] Fetching allocations...${NC}"
STEP_START=$SECONDS
"$SCRIPT_DIR/fetch.sh"
echo -e "Step 1 completed in $((SECONDS - STEP_START))s"
echo ""

# Step 2: Queue
echo -e "${YELLOW}[Step 2/5] Queueing allocations...${NC}"
STEP_START=$SECONDS
"$SCRIPT_DIR/queue.sh"
echo -e "Step 2 completed in $((SECONDS - STEP_START))s"
echo ""

# Step 3: Approve
echo -e "${YELLOW}[Step 3/5] Approving queued actions...${NC}"
STEP_START=$SECONDS
"$SCRIPT_DIR/approve.sh"
echo -e "Step 3 completed in $((SECONDS - STEP_START))s"
echo ""

# Step 4: Execute
echo -e "${YELLOW}[Step 4/5] Executing approved actions...${NC}"
STEP_START=$SECONDS
"$SCRIPT_DIR/execute.sh"
echo -e "Step 4 completed in $((SECONDS - STEP_START))s"
echo ""

# Step 5: Status
echo -e "${YELLOW}[Step 5/5] Final status...${NC}"
STEP_START=$SECONDS
"$SCRIPT_DIR/status.sh"
echo -e "Step 5 completed in $((SECONDS - STEP_START))s"
echo ""

echo -e "${GREEN}=== Total time: $((SECONDS - TOTAL_START))s ===${NC}"
