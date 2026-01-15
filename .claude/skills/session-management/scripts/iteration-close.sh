#!/bin/bash
#
# iteration-close.sh - Close the current iteration without creating a new one
#
# Usage: iteration-close.sh <session-path> <status> [summary]
#   session-path: path to story (e.g., stories/2026-01-11-new-entity)
#   status:       completed | blocked | paused
#   summary:      optional summary message
#
# Examples:
#   ./iteration-close.sh stories/2026-01-11-new-products-entity completed
#   ./iteration-close.sh stories/2026-01-11-new-products-entity blocked "Waiting for API"
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSIONS_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
SESSION_PATH="$1"
STATUS="$2"
SUMMARY="${3:-Iteration closed}"

# Validate session path
if [[ -z "$SESSION_PATH" ]]; then
    echo -e "${RED}Error: Session path is required${NC}"
    echo "Usage: $0 <session-path> <status> [summary]"
    exit 1
fi

# Validate status
if [[ ! "$STATUS" =~ ^(completed|blocked|paused)$ ]]; then
    echo -e "${RED}Error: Invalid status '$STATUS'${NC}"
    echo "Valid statuses: completed, blocked, paused"
    exit 1
fi

# Resolve full path
if [[ "$SESSION_PATH" != /* ]]; then
    FULL_PATH="$SESSIONS_DIR/$SESSION_PATH"
else
    FULL_PATH="$SESSION_PATH"
fi

# Check if session exists
if [[ ! -d "$FULL_PATH" ]]; then
    echo -e "${RED}Error: Session not found: $FULL_PATH${NC}"
    exit 1
fi

# Verify it's a story (has iterations folder)
if [[ ! -d "$FULL_PATH/iterations" ]]; then
    echo -e "${RED}Error: Not a story session (no iterations folder)${NC}"
    exit 1
fi

CURRENT_DIR="$FULL_PATH/current"
CLOSED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

# Find current iteration
CURRENT_PROGRESS=$(readlink "$CURRENT_DIR/progress.md" 2>/dev/null || echo "")
if [[ -z "$CURRENT_PROGRESS" ]]; then
    echo -e "${RED}Error: No active iteration found${NC}"
    exit 1
fi

ITERATION_DIR=$(dirname "$CURRENT_PROGRESS")
ITERATION_DIR=$(cd "$CURRENT_DIR" && cd "$ITERATION_DIR" && pwd)
ITERATION_NAME=$(basename "$ITERATION_DIR")

echo -e "${BLUE}Closing iteration: $ITERATION_NAME${NC}"
echo ""

# Create closed.json
cat > "$ITERATION_DIR/closed.json" << EOF
{
  "iteration": "$ITERATION_NAME",
  "status": "$STATUS",
  "closedAt": "$CLOSED_AT",
  "closedBy": "claude",
  "summary": "$SUMMARY"
}
EOF

echo -e "${GREEN}Iteration closed: $ITERATION_NAME${NC}"
echo -e "${GREEN}Status: $STATUS${NC}"
echo -e "${GREEN}Created: closed.json${NC}"
echo ""

if [[ "$STATUS" == "blocked" ]]; then
    echo -e "${YELLOW}Note: Iteration is blocked. Use iteration-init.sh when ready to continue.${NC}"
elif [[ "$STATUS" == "paused" ]]; then
    echo -e "${YELLOW}Note: Iteration is paused. Use iteration-init.sh with 'continuation' reason to resume.${NC}"
else
    echo -e "${BLUE}Session can now be archived with session-archive.sh${NC}"
fi
