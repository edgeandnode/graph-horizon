#!/bin/bash
# Fetches ALL active allocations from the Graph Network subgraph with pagination
# and provides a breakdown by isLegacy status

set -e

if [ -z "$API_KEY" ]; then
  echo "Error: API_KEY environment variable is required"
  echo "Usage: API_KEY=your_key ./allocation-stats.sh"
  exit 1
fi
SUBGRAPH_ID="DZz4kDTdmzWLWsV373w2bSmoar3umKKH9y82SUKr5qmp"
ENDPOINT="https://gateway.thegraph.com/api/subgraphs/id/${SUBGRAPH_ID}"
PAGE_SIZE=1000
OUTPUT_FILE="${OUTPUT_FILE:-allocation-stats.json}"

echo "Fetching active allocations from Graph Network subgraph..."
echo "Endpoint: $ENDPOINT"
echo ""

all_allocations="[]"
last_id=""
page=1

while true; do
  echo "Fetching page $page (after id: ${last_id:-start})..."

  # Use GraphQL variables for proper escaping
  query='query GetAllocations($lastId: String) { allocations( first: 1000, orderBy: id, orderDirection: asc, where: { status: Active, id_gt: $lastId } ) { id isLegacy allocatedTokens } }'

  # Build payload with jq for proper JSON escaping
  if [ -z "$last_id" ]; then
    payload=$(jq -n --arg q "$query" '{ query: $q, variables: { lastId: "" } }')
  else
    payload=$(jq -n --arg q "$query" --arg id "$last_id" '{ query: $q, variables: { lastId: $id } }')
  fi

  response=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $API_KEY" \
    -d "$payload" \
    "$ENDPOINT")

  # Check if response is valid JSON first
  if ! echo "$response" | jq -e . > /dev/null 2>&1; then
    echo "Error: Invalid JSON response from API"
    echo "Raw response:"
    echo "$response"
    exit 1
  fi

  # Check for GraphQL errors
  if echo "$response" | jq -e '.errors' > /dev/null 2>&1; then
    echo "Error from API:"
    echo "$response" | jq '.errors'
    exit 1
  fi

  # Extract allocations from response
  allocations=$(echo "$response" | jq '.data.allocations')
  count=$(echo "$allocations" | jq 'length')

  echo "  Got $count allocations"

  # Merge into all_allocations
  all_allocations=$(echo "$all_allocations $allocations" | jq -s 'add')

  # Check if we got fewer than PAGE_SIZE (means we're done)
  if [ "$count" -lt "$PAGE_SIZE" ]; then
    break
  fi

  # Get the last ID for next page
  last_id=$(echo "$allocations" | jq -r '.[-1].id')
  page=$((page + 1))
done

total_count=$(echo "$all_allocations" | jq 'length')
echo ""
echo "========================================="
echo "ALLOCATION STATISTICS"
echo "========================================="
echo ""
echo "Total active allocations: $total_count"
echo ""

# Calculate legacy stats
legacy_count=$(echo "$all_allocations" | jq '[.[] | select(.isLegacy == true)] | length')
legacy_tokens=$(echo "$all_allocations" | jq '[.[] | select(.isLegacy == true) | .allocatedTokens | tonumber] | add // 0')
legacy_tokens_formatted=$(echo "scale=2; $legacy_tokens / 1000000000000000000" | bc)

# Calculate horizon stats
horizon_count=$(echo "$all_allocations" | jq '[.[] | select(.isLegacy == false)] | length')
horizon_tokens=$(echo "$all_allocations" | jq '[.[] | select(.isLegacy == false) | .allocatedTokens | tonumber] | add // 0')
horizon_tokens_formatted=$(echo "scale=2; $horizon_tokens / 1000000000000000000" | bc)

# Total tokens
total_tokens=$(echo "$all_allocations" | jq '[.[] | .allocatedTokens | tonumber] | add // 0')
total_tokens_formatted=$(echo "scale=2; $total_tokens / 1000000000000000000" | bc)

echo "LEGACY ALLOCATIONS (pre-Horizon):"
echo "  Count: $legacy_count"
echo "  Allocated: $legacy_tokens_formatted GRT"
echo ""
echo "HORIZON ALLOCATIONS:"
echo "  Count: $horizon_count"
echo "  Allocated: $horizon_tokens_formatted GRT"
echo ""
echo "TOTAL:"
echo "  Count: $total_count"
echo "  Allocated: $total_tokens_formatted GRT"
echo ""

# Calculate percentages
if [ "$total_count" -gt 0 ]; then
  legacy_pct=$(echo "scale=2; $legacy_count * 100 / $total_count" | bc)
  horizon_pct=$(echo "scale=2; $horizon_count * 100 / $total_count" | bc)
  echo "BREAKDOWN BY COUNT:"
  echo "  Legacy: $legacy_pct%"
  echo "  Horizon: $horizon_pct%"
  echo ""
fi

if [ "$(echo "$total_tokens > 0" | bc)" -eq 1 ]; then
  legacy_tokens_pct=$(echo "scale=2; $legacy_tokens * 100 / $total_tokens" | bc)
  horizon_tokens_pct=$(echo "scale=2; $horizon_tokens * 100 / $total_tokens" | bc)
  echo "BREAKDOWN BY ALLOCATED TOKENS:"
  echo "  Legacy: $legacy_tokens_pct%"
  echo "  Horizon: $horizon_tokens_pct%"
fi

# Save raw data to file
echo "$all_allocations" > "$OUTPUT_FILE"
echo ""
echo "Raw data saved to: $OUTPUT_FILE"
