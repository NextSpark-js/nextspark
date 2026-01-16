#!/bin/bash
#
# session-init.sh - Create a new session with proper structure
#
# Usage: session-init.sh <type> <name> [tshirt]
#   type:   story | task | log
#   name:   descriptive name (without date, added automatically)
#   tshirt: xs | s | m | l | xl (optional, defaults based on type)
#
# Examples:
#   ./session-init.sh story new-products-entity L
#   ./session-init.sh task improve-search M
#   ./session-init.sh log fix-typo
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSIONS_DIR="$(dirname "$SCRIPT_DIR")"
TEMPLATES_DIR="$SESSIONS_DIR/templates"

# Parse arguments
TYPE="$1"
NAME="$2"
TSHIRT="${3:-}"

# Validate type
if [[ ! "$TYPE" =~ ^(story|task|log)$ ]]; then
    echo -e "${RED}Error: Invalid type '$TYPE'. Must be: story, task, or log${NC}"
    echo "Usage: $0 <type> <name> [tshirt]"
    exit 1
fi

# Validate name
if [[ -z "$NAME" ]]; then
    echo -e "${RED}Error: Name is required${NC}"
    echo "Usage: $0 <type> <name> [tshirt]"
    exit 1
fi

# Clean name (lowercase, replace spaces with dashes)
NAME=$(echo "$NAME" | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | sed 's/[^a-z0-9-]//g')

# Set default tshirt based on type
if [[ -z "$TSHIRT" ]]; then
    case "$TYPE" in
        story) TSHIRT="L" ;;
        task)  TSHIRT="M" ;;
        log)   TSHIRT="XS" ;;
    esac
else
    TSHIRT=$(echo "$TSHIRT" | tr '[:lower:]' '[:upper:]')
fi

# Validate tshirt
if [[ ! "$TSHIRT" =~ ^(XS|S|M|L|XL)$ ]]; then
    echo -e "${RED}Error: Invalid tshirt size '$TSHIRT'. Must be: XS, S, M, L, or XL${NC}"
    exit 1
fi

# Generate date and full name
DATE=$(date +%Y-%m-%d)
FULL_NAME="${DATE}-${NAME}"

# Determine target directory
case "$TYPE" in
    story) TARGET_DIR="$SESSIONS_DIR/stories/$FULL_NAME" ;;
    task)  TARGET_DIR="$SESSIONS_DIR/tasks/$FULL_NAME" ;;
    log)   TARGET_DIR="$SESSIONS_DIR/logs" ;;
esac

# Check if session already exists
if [[ "$TYPE" == "log" ]]; then
    if [[ -f "$TARGET_DIR/${FULL_NAME}.md" ]]; then
        echo -e "${YELLOW}Warning: Log already exists: ${FULL_NAME}.md${NC}"
        echo "Adding timestamp to name..."
        TIMESTAMP=$(date +%H%M%S)
        FULL_NAME="${DATE}-${NAME}-${TIMESTAMP}"
    fi
else
    if [[ -d "$TARGET_DIR" ]]; then
        echo -e "${RED}Error: Session already exists: $TARGET_DIR${NC}"
        exit 1
    fi
fi

# Replace placeholders in template content
replace_placeholders() {
    local content="$1"
    content="${content//\{\{SESSION_NAME\}\}/$NAME}"
    content="${content//\{\{SESSION_FULL\}\}/$FULL_NAME}"
    content="${content//\{\{DATE\}\}/$DATE}"
    content="${content//\{\{TSHIRT\}\}/$TSHIRT}"
    content="${content//\{\{ITERATION\}\}/01}"
    content="${content//\{\{ITERATION_NAME\}\}/initial}"
    echo "$content"
}

echo -e "${BLUE}Creating $TYPE session: $FULL_NAME${NC}"
echo ""

case "$TYPE" in
    story)
        # Create story structure
        mkdir -p "$TARGET_DIR"
        mkdir -p "$TARGET_DIR/iterations/01-initial"
        mkdir -p "$TARGET_DIR/current"

        # Copy and process story templates (scope.json handled separately)
        for template in context requirements plan pendings tests; do
            TEMPLATE_FILE="$TEMPLATES_DIR/story/${template}.md"
            if [[ -f "$TEMPLATE_FILE" ]]; then
                content=$(cat "$TEMPLATE_FILE")
                replace_placeholders "$content" > "$TARGET_DIR/${template}.md"
            else
                # Create minimal file if template doesn't exist
                template_title=$(echo "$template" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')
                echo "# $template_title" > "$TARGET_DIR/${template}.md"
                echo "" >> "$TARGET_DIR/${template}.md"
                echo "Session: $FULL_NAME" >> "$TARGET_DIR/${template}.md"
            fi
        done

        # Handle scope.json separately
        if [[ -f "$TEMPLATES_DIR/story/scope.json" ]]; then
            content=$(cat "$TEMPLATES_DIR/story/scope.json")
            replace_placeholders "$content" > "$TARGET_DIR/scope.json"
        else
            cat > "$TARGET_DIR/scope.json" << EOF
{
  "session": "$FULL_NAME",
  "type": "story",
  "tshirt": "$TSHIRT",
  "paths": [],
  "createdAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
        fi

        # Create initial iteration files
        for template in progress changes; do
            TEMPLATE_FILE="$TEMPLATES_DIR/iteration/${template}.md"
            if [[ -f "$TEMPLATE_FILE" ]]; then
                content=$(cat "$TEMPLATE_FILE")
                replace_placeholders "$content" > "$TARGET_DIR/iterations/01-initial/${template}.md"
            else
                template_title=$(echo "$template" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')
                echo "# $template_title" > "$TARGET_DIR/iterations/01-initial/${template}.md"
                echo "" >> "$TARGET_DIR/iterations/01-initial/${template}.md"
                echo "Iteration: 01-initial" >> "$TARGET_DIR/iterations/01-initial/${template}.md"
            fi
        done

        # Create symlinks for current
        ln -sf ../iterations/01-initial/progress.md "$TARGET_DIR/current/progress.md"
        ln -sf ../iterations/01-initial/changes.md "$TARGET_DIR/current/changes.md"

        echo -e "${GREEN}Created: stories/$FULL_NAME/${NC}"
        echo -e "${GREEN}Files: context.md, requirements.md, plan.md, scope.json, pendings.md, tests.md${NC}"
        echo -e "${GREEN}Iteration: iterations/01-initial/${NC}"
        echo -e "${GREEN}Current: current/ -> iterations/01-initial/${NC}"
        ;;

    task)
        # Create task structure
        mkdir -p "$TARGET_DIR"

        # Copy and process task templates
        for template in requirements progress; do
            TEMPLATE_FILE="$TEMPLATES_DIR/task/${template}.md"
            if [[ -f "$TEMPLATE_FILE" ]]; then
                content=$(cat "$TEMPLATE_FILE")
                replace_placeholders "$content" > "$TARGET_DIR/${template}.md"
            else
                template_title=$(echo "$template" | awk '{print toupper(substr($0,1,1)) substr($0,2)}')
                echo "# $template_title" > "$TARGET_DIR/${template}.md"
                echo "" >> "$TARGET_DIR/${template}.md"
                echo "Task: $FULL_NAME" >> "$TARGET_DIR/${template}.md"
            fi
        done

        echo -e "${GREEN}Created: tasks/$FULL_NAME/${NC}"
        echo -e "${GREEN}Files: requirements.md, progress.md${NC}"
        ;;

    log)
        # Create log file
        TEMPLATE_FILE="$TEMPLATES_DIR/log.md"
        if [[ -f "$TEMPLATE_FILE" ]]; then
            content=$(cat "$TEMPLATE_FILE")
            replace_placeholders "$content" > "$TARGET_DIR/${FULL_NAME}.md"
        else
            cat > "$TARGET_DIR/${FULL_NAME}.md" << EOF
# Quick Fix: $NAME

**Date:** $(date '+%Y-%m-%d %H:%M')
**Type:** quick-fix
**T-Shirt:** $TSHIRT

## What was done


## Files changed


## Verification
- [ ] Visual check
- [ ] Build passes
EOF
        fi

        echo -e "${GREEN}Created: logs/${FULL_NAME}.md${NC}"
        ;;
esac

echo ""
echo -e "${BLUE}Session path: $TARGET_DIR${NC}"
