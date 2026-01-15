#!/bin/bash
#
# split-plan.sh - Split plan.md into individual phase files
#
# Part of the token optimization system for STORY workflows.
# Extracts phase sections marked with <!-- PHASE:XX:START/END -->
# into separate files for agent consumption.
#
# Usage:
#   ./split-plan.sh <session_path>
#
# Example:
#   ./split-plan.sh stories/2024-01-12-products/
#
# Output:
#   Creates phases/ directory with phase-XX-name.md files
#
# See: _docs/workflows-optimizations.md for full documentation
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Show usage
usage() {
    echo "Usage: $0 <session_path>"
    echo ""
    echo "Split plan.md into individual phase files for agent consumption."
    echo ""
    echo "Arguments:"
    echo "  session_path    Path to session directory (e.g., stories/2024-01-12-products/)"
    echo ""
    echo "Example:"
    echo "  $0 stories/2024-01-12-products/"
    echo ""
    echo "The script will:"
    echo "  1. Read plan.md from the session directory"
    echo "  2. Extract sections between <!-- PHASE:XX:START --> and <!-- PHASE:XX:END --> markers"
    echo "  3. Create phases/ directory with individual phase files"
    exit 1
}

# Check arguments
if [ -z "$1" ] || [ "$1" == "--help" ] || [ "$1" == "-h" ]; then
    usage
fi

SESSION_PATH="$1"
PLAN_FILE="$SESSION_PATH/plan.md"
PHASES_DIR="$SESSION_PATH/phases"

# Validate session path
if [ ! -d "$SESSION_PATH" ]; then
    echo -e "${RED}Error: Session directory not found: $SESSION_PATH${NC}"
    exit 1
fi

# Validate plan.md exists
if [ ! -f "$PLAN_FILE" ]; then
    echo -e "${RED}Error: plan.md not found in $SESSION_PATH${NC}"
    echo "Make sure architecture-supervisor has created the plan with phase markers."
    exit 1
fi

# Check for phase markers
MARKER_COUNT=$(grep -c "PHASE:.*:START" "$PLAN_FILE" 2>/dev/null || echo "0")
if [ "$MARKER_COUNT" -eq 0 ]; then
    echo -e "${YELLOW}Warning: No phase markers found in plan.md${NC}"
    echo "Expected format: <!-- PHASE:XX:START --> and <!-- PHASE:XX:END -->"
    echo ""
    echo "Make sure architecture-supervisor created plan.md with proper markers."
    exit 1
fi

echo -e "${GREEN}Found $MARKER_COUNT phase markers in plan.md${NC}"

# Create phases directory
mkdir -p "$PHASES_DIR"

# Counter for created files
CREATED=0

# Extract phases (03-14 covers all developer phases in STORY workflow)
for phase in 03 04 05 06 07 08 09 10 11 12 13 14; do
    # Extract content between markers (excluding the markers themselves)
    content=$(sed -n "/<!-- PHASE:$phase:START -->/,/<!-- PHASE:$phase:END -->/p" "$PLAN_FILE" 2>/dev/null | grep -v "<!-- PHASE:" || true)

    if [ -n "$content" ]; then
        # Extract phase name from header (e.g., "## Phase 3: DB Entity Developer" -> "db-entity-developer")
        phase_name=$(echo "$content" | grep -m1 "^## Phase" | sed 's/## Phase [0-9]*: //' | tr '[:upper:]' '[:lower:]' | tr ' ' '-' | tr -cd '[:alnum:]-')

        # Fallback name if extraction fails
        if [ -z "$phase_name" ]; then
            phase_name="phase-$phase"
        fi

        # Create phase file
        output_file="$PHASES_DIR/phase-$phase-$phase_name.md"
        echo "$content" > "$output_file"

        echo "  Created: phase-$phase-$phase_name.md"
        ((CREATED++))
    fi
done

echo ""
if [ "$CREATED" -gt 0 ]; then
    echo -e "${GREEN}✓ Split complete: $CREATED phase files created in $PHASES_DIR${NC}"
else
    echo -e "${YELLOW}Warning: No phase files were created. Check plan.md markers.${NC}"
fi
