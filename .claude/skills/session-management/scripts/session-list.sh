#!/bin/bash
#
# session-list.sh - List sessions with their status
#
# Usage: session-list.sh [type] [--all]
#   type: stories | tasks | logs (optional, list all if not specified)
#   --all: include archived sessions
#
# Examples:
#   ./session-list.sh              # Only active sessions
#   ./session-list.sh stories      # Only active stories
#   ./session-list.sh --all        # Include archived
#

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'
BOLD='\033[1m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SESSIONS_DIR="$(dirname "$SCRIPT_DIR")"

# Parse arguments
FILTER_TYPE=""
INCLUDE_ARCHIVED=false

for arg in "$@"; do
    case "$arg" in
        --all)
            INCLUDE_ARCHIVED=true
            ;;
        stories|tasks|logs)
            FILTER_TYPE="$arg"
            ;;
    esac
done

# Function to get session info
get_session_info() {
    local session_path="$1"
    local session_name=$(basename "$session_path")
    local info=""

    # Get tshirt size from scope.json or context.md
    if [[ -f "$session_path/scope.json" ]]; then
        tshirt=$(grep -o '"tshirt"[[:space:]]*:[[:space:]]*"[^"]*"' "$session_path/scope.json" 2>/dev/null | cut -d'"' -f4)
    elif [[ -f "$session_path/context.md" ]]; then
        tshirt=$(grep -i "T-Shirt" "$session_path/context.md" 2>/dev/null | grep -oE '\b(XS|S|M|L|XL)\b' | head -1)
    fi
    tshirt="${tshirt:-?}"

    # Get current iteration (for stories)
    if [[ -d "$session_path/iterations" ]]; then
        current_iteration=$(ls -1 "$session_path/iterations" 2>/dev/null | tail -1)
        current_iteration="${current_iteration:-01-initial}"
    fi

    # Get progress from progress.md
    progress=""
    progress_file=""
    if [[ -f "$session_path/current/progress.md" ]]; then
        progress_file="$session_path/current/progress.md"
    elif [[ -f "$session_path/progress.md" ]]; then
        progress_file="$session_path/progress.md"
    fi

    if [[ -n "$progress_file" && -f "$progress_file" ]]; then
        # Try to find a percentage or phase
        progress=$(grep -oE '[0-9]+%' "$progress_file" 2>/dev/null | tail -1)
        if [[ -z "$progress" ]]; then
            # Check for phase info
            phase=$(grep -i "phase\|fase\|current" "$progress_file" 2>/dev/null | head -1)
            if [[ -n "$phase" ]]; then
                progress="in progress"
            fi
        fi
    fi
    progress="${progress:-}"

    # Build info string
    if [[ -n "$current_iteration" ]]; then
        info="[$tshirt] $current_iteration"
    else
        info="[$tshirt]"
    fi

    if [[ -n "$progress" ]]; then
        info="$info ($progress)"
    fi

    echo "$info"
}

# Function to list sessions of a type
list_sessions() {
    local type="$1"
    local dir="$SESSIONS_DIR/$type"
    local archived_dir="$SESSIONS_DIR/archive/$type"
    local count=0

    type_upper=$(echo "$type" | tr '[:lower:]' '[:upper:]')
    echo -e "${BOLD}${CYAN}${type_upper}${NC}"

    # Active sessions
    if [[ -d "$dir" ]]; then
        if [[ "$type" == "logs" ]]; then
            # Logs are files, not directories
            for session in $(ls -1 "$dir"/*.md 2>/dev/null | sort -r | head -10); do
                session_name=$(basename "$session" .md)
                echo -e "  ${GREEN}${session_name}${NC}"
                ((count++))
            done
        else
            for session in $(ls -1d "$dir"/*/ 2>/dev/null | sort -r); do
                session_name=$(basename "$session")
                session_info=$(get_session_info "$session")
                echo -e "  ${GREEN}${session_name}${NC} ${session_info}"
                ((count++))
            done
        fi
    fi

    if [[ $count -eq 0 ]]; then
        echo -e "  ${YELLOW}(no active sessions)${NC}"
    else
        echo -e "  ${BLUE}Total: $count active${NC}"
    fi

    # Archived sessions
    if [[ "$INCLUDE_ARCHIVED" == true && -d "$archived_dir" ]]; then
        archived_count=0
        if [[ "$type" == "logs" ]]; then
            archived_count=$(ls -1 "$archived_dir"/*.md 2>/dev/null | wc -l)
        else
            archived_count=$(ls -1d "$archived_dir"/*/ 2>/dev/null | wc -l)
        fi

        if [[ $archived_count -gt 0 ]]; then
            echo -e "  ${YELLOW}($archived_count archived)${NC}"
        fi
    fi

    echo ""
}

echo ""
echo -e "${BOLD}${BLUE}=== SESSION LIST ===${NC}"
echo ""

if [[ -n "$FILTER_TYPE" ]]; then
    list_sessions "$FILTER_TYPE"
else
    list_sessions "stories"
    list_sessions "tasks"
    list_sessions "logs"
fi
