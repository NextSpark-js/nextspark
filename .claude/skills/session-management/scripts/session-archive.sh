#!/bin/bash
#
# session-archive.sh - Move a closed session to archive
#
# Usage: session-archive.sh <session-path>
#   session-path: path to session (e.g., stories/2026-01-11-new-entity)
#
# Examples:
#   ./session-archive.sh stories/2026-01-11-new-products-entity
#   ./session-archive.sh tasks/2026-01-10-improve-search
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

# Validate session path
if [[ -z "$SESSION_PATH" ]]; then
    echo -e "${RED}Error: Session path is required${NC}"
    echo "Usage: $0 <session-path>"
    exit 1
fi

# Resolve full path
if [[ "$SESSION_PATH" != /* ]]; then
    FULL_PATH="$SESSIONS_DIR/$SESSION_PATH"
else
    FULL_PATH="$SESSION_PATH"
fi

# Check if session exists
if [[ ! -d "$FULL_PATH" && ! -f "$FULL_PATH" ]]; then
    echo -e "${RED}Error: Session not found: $FULL_PATH${NC}"
    exit 1
fi

# Determine session type
if [[ "$SESSION_PATH" == *"stories"* ]]; then
    TYPE="stories"
elif [[ "$SESSION_PATH" == *"tasks"* ]]; then
    TYPE="tasks"
elif [[ "$SESSION_PATH" == *"logs"* ]]; then
    TYPE="logs"
else
    echo -e "${RED}Error: Cannot determine session type from path${NC}"
    exit 1
fi

SESSION_NAME=$(basename "$FULL_PATH" .md)
ARCHIVE_DIR="$SESSIONS_DIR/archive/$TYPE"

# Create archive directory if needed
mkdir -p "$ARCHIVE_DIR"

# Check if already archived
if [[ -e "$ARCHIVE_DIR/$SESSION_NAME" || -e "$ARCHIVE_DIR/${SESSION_NAME}.md" ]]; then
    echo -e "${YELLOW}Warning: Session already exists in archive. Adding timestamp.${NC}"
    TIMESTAMP=$(date +%H%M%S)
    SESSION_NAME="${SESSION_NAME}-${TIMESTAMP}"
fi

echo -e "${BLUE}Archiving session: $SESSION_PATH${NC}"
echo ""

# Move to archive
if [[ -d "$FULL_PATH" ]]; then
    mv "$FULL_PATH" "$ARCHIVE_DIR/$SESSION_NAME"
    echo -e "${GREEN}Archived: archive/$TYPE/$SESSION_NAME/${NC}"
else
    mv "$FULL_PATH" "$ARCHIVE_DIR/${SESSION_NAME}.md"
    echo -e "${GREEN}Archived: archive/$TYPE/${SESSION_NAME}.md${NC}"
fi

echo ""
echo -e "${BLUE}Session archived successfully${NC}"
