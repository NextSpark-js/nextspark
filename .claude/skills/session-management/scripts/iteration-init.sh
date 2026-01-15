#!/bin/bash
#
# iteration-init.sh - Create a new iteration within a story
#
# Usage: iteration-init.sh <session-path> <reason> [name]
#   session-path: path to story (e.g., stories/2026-01-11-new-entity)
#   reason:       scope-change | blocked | review-feedback | continuation
#   name:         optional custom name for the iteration
#
# Examples:
#   ./iteration-init.sh stories/2026-01-11-new-products-entity scope-change
#   ./iteration-init.sh stories/2026-01-11-new-products-entity blocked "api-dependency"
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
TEMPLATES_DIR="$SESSIONS_DIR/templates"

# Parse arguments
SESSION_PATH="$1"
REASON="$2"
CUSTOM_NAME="${3:-}"

# Validate session path
if [[ -z "$SESSION_PATH" ]]; then
    echo -e "${RED}Error: Session path is required${NC}"
    echo "Usage: $0 <session-path> <reason> [name]"
    exit 1
fi

# Validate reason
if [[ ! "$REASON" =~ ^(scope-change|blocked|review-feedback|continuation)$ ]]; then
    echo -e "${RED}Error: Invalid reason '$REASON'${NC}"
    echo "Valid reasons: scope-change, blocked, review-feedback, continuation"
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

# Find current iteration number
CURRENT_NUM=$(ls -1 "$FULL_PATH/iterations" 2>/dev/null | grep -E '^[0-9]' | wc -l)
NEXT_NUM=$(printf "%02d" $((CURRENT_NUM + 1)))

# Build iteration name
if [[ -n "$CUSTOM_NAME" ]]; then
    ITERATION_NAME="${NEXT_NUM}-${REASON}-${CUSTOM_NAME}"
else
    ITERATION_NAME="${NEXT_NUM}-${REASON}"
fi

# Clean name
ITERATION_NAME=$(echo "$ITERATION_NAME" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')

ITERATION_DIR="$FULL_PATH/iterations/$ITERATION_NAME"
CLOSED_AT=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo -e "${BLUE}Creating iteration: $ITERATION_NAME${NC}"
echo ""

# Close current iteration first
CURRENT_DIR="$FULL_PATH/current"
if [[ -d "$CURRENT_DIR" ]]; then
    CURRENT_PROGRESS=$(readlink "$CURRENT_DIR/progress.md" 2>/dev/null || echo "")
    if [[ -n "$CURRENT_PROGRESS" ]]; then
        OLD_ITERATION_DIR=$(dirname "$CURRENT_PROGRESS")
        OLD_ITERATION_DIR=$(cd "$CURRENT_DIR" && cd "$OLD_ITERATION_DIR" && pwd)
        OLD_ITERATION_NAME=$(basename "$OLD_ITERATION_DIR")

        # Create closed.json for previous iteration
        cat > "$OLD_ITERATION_DIR/closed.json" << EOF
{
  "iteration": "$OLD_ITERATION_NAME",
  "status": "completed",
  "closedAt": "$CLOSED_AT",
  "closedBy": "claude",
  "summary": "Closed to start iteration: $ITERATION_NAME",
  "reason": "$REASON",
  "nextIteration": "$ITERATION_NAME"
}
EOF
        echo -e "${GREEN}Closed iteration: $OLD_ITERATION_NAME${NC}"
    fi
fi

# Create new iteration directory
mkdir -p "$ITERATION_DIR"

# Create iteration files
cat > "$ITERATION_DIR/progress.md" << EOF
# Progress: $ITERATION_NAME

**Started:** $(date '+%Y-%m-%d %H:%M')
**Reason:** $REASON

## Current Phase


## Completed


## In Progress


## Pending

EOF

cat > "$ITERATION_DIR/changes.md" << EOF
# Changes: $ITERATION_NAME

**Started:** $(date '+%Y-%m-%d %H:%M')

## Files Modified


## Files Created


## Files Deleted

EOF

# Create scope-change.md if reason is scope-change
if [[ "$REASON" == "scope-change" ]]; then
    cat > "$ITERATION_DIR/scope-change.md" << EOF
# Scope Change: $ITERATION_NAME

**Date:** $(date '+%Y-%m-%d %H:%M')

## What Changed


## Why


## Impact on Plan


## Updated Acceptance Criteria

EOF
    echo -e "${GREEN}Created: scope-change.md${NC}"
fi

# Update current symlinks
rm -f "$CURRENT_DIR/progress.md" "$CURRENT_DIR/changes.md" 2>/dev/null || true
ln -sf "../iterations/$ITERATION_NAME/progress.md" "$CURRENT_DIR/progress.md"
ln -sf "../iterations/$ITERATION_NAME/changes.md" "$CURRENT_DIR/changes.md"

echo -e "${GREEN}Created iteration: $ITERATION_NAME${NC}"
echo -e "${GREEN}Updated current/ symlinks${NC}"
echo ""
echo -e "${BLUE}Iteration path: $ITERATION_DIR${NC}"
