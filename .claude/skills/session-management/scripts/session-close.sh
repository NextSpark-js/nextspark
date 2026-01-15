#!/bin/bash
#
# session-close.sh - Close an active session (mark as completed)
#
# Usage: session-close.sh <session-path> [summary]
#   session-path: path to session (e.g., stories/2026-01-11-new-entity)
#   summary:      optional summary message
#
# Examples:
#   ./session-close.sh stories/2026-01-11-new-products-entity
#   ./session-close.sh stories/2026-01-11-new-products-entity "Feature completed successfully"
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
SUMMARY="${2:-Session closed}"

# Validate session path
if [[ -z "$SESSION_PATH" ]]; then
    echo -e "${RED}Error: Session path is required${NC}"
    echo "Usage: $0 <session-path> [summary]"
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

# Determine session type
if [[ "$SESSION_PATH" == *"stories"* ]]; then
    TYPE="story"
elif [[ "$SESSION_PATH" == *"tasks"* ]]; then
    TYPE="task"
else
    echo -e "${RED}Error: Cannot determine session type from path${NC}"
    exit 1
fi

SESSION_NAME=$(basename "$FULL_PATH")
CLOSED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo -e "${BLUE}Closing session: $SESSION_NAME${NC}"
echo ""

if [[ "$TYPE" == "story" ]]; then
    # Close current iteration first
    CURRENT_DIR="$FULL_PATH/current"
    if [[ -d "$CURRENT_DIR" ]]; then
        # Find current iteration
        CURRENT_PROGRESS=$(readlink "$CURRENT_DIR/progress.md" 2>/dev/null || echo "")
        if [[ -n "$CURRENT_PROGRESS" ]]; then
            ITERATION_DIR=$(dirname "$CURRENT_PROGRESS")
            ITERATION_DIR=$(cd "$CURRENT_DIR" && cd "$ITERATION_DIR" && pwd)
            ITERATION_NAME=$(basename "$ITERATION_DIR")

            # Create closed.json for current iteration
            cat > "$ITERATION_DIR/closed.json" << EOF
{
  "iteration": "$ITERATION_NAME",
  "status": "completed",
  "closedAt": "$CLOSED_AT",
  "closedBy": "claude",
  "summary": "$SUMMARY"
}
EOF
            echo -e "${GREEN}Closed iteration: $ITERATION_NAME${NC}"
        fi
    fi

    # Calculate stats
    ITERATIONS=$(find "$FULL_PATH/iterations" -maxdepth 1 -type d | wc -l)
    ITERATIONS=$((ITERATIONS - 1)) # Subtract the iterations dir itself

    # Calculate duration
    CREATED_DATE=$(echo "$SESSION_NAME" | grep -oE '^[0-9]{4}-[0-9]{2}-[0-9]{2}')
    if [[ -n "$CREATED_DATE" ]]; then
        CREATED_EPOCH=$(date -j -f "%Y-%m-%d" "$CREATED_DATE" "+%s" 2>/dev/null || echo "0")
        NOW_EPOCH=$(date "+%s")
        if [[ "$CREATED_EPOCH" != "0" ]]; then
            DURATION_DAYS=$(( (NOW_EPOCH - CREATED_EPOCH) / 86400 ))
        else
            DURATION_DAYS="?"
        fi
    else
        DURATION_DAYS="?"
    fi

    echo -e "${GREEN}Status: completed${NC}"
    echo -e "${GREEN}Duration: ${DURATION_DAYS} days${NC}"
    echo -e "${GREEN}Iterations: ${ITERATIONS}${NC}"
else
    # Task: just update progress.md
    PROGRESS_FILE="$FULL_PATH/progress.md"
    if [[ -f "$PROGRESS_FILE" ]]; then
        # Append closed status
        echo "" >> "$PROGRESS_FILE"
        echo "---" >> "$PROGRESS_FILE"
        echo "" >> "$PROGRESS_FILE"
        echo "## Session Closed" >> "$PROGRESS_FILE"
        echo "" >> "$PROGRESS_FILE"
        echo "- **Status:** Completed" >> "$PROGRESS_FILE"
        echo "- **Closed at:** $CLOSED_AT" >> "$PROGRESS_FILE"
        echo "- **Summary:** $SUMMARY" >> "$PROGRESS_FILE"
    fi

    echo -e "${GREEN}Status: completed${NC}"
fi

echo ""
echo -e "${BLUE}Session closed: $SESSION_PATH${NC}"
echo -e "${YELLOW}Tip: Use session-archive.sh to move to archive/${NC}"
