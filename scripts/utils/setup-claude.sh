#!/bin/bash
# setup-claude.sh
# Creates symlinks from root .claude/ to repo/.claude/ for Claude Code configuration
#
# Run this script after cloning the repository to set up Claude Code configuration.
# Usage: ./repo/scripts/setup-claude.sh

set -e

# Get the project root (two levels up from this script)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

CLAUDE_ROOT="$PROJECT_ROOT/.claude"
CLAUDE_REPO="$PROJECT_ROOT/repo/.claude"

echo "Setting up Claude Code configuration..."
echo "Project root: $PROJECT_ROOT"

# Create .claude directory if it doesn't exist
mkdir -p "$CLAUDE_ROOT"

# Remove existing symlinks or files (to allow re-running)
cd "$CLAUDE_ROOT"

# Items to symlink
ITEMS=(
    "README.md"
    "agents"
    "commands"
    "config"
    "sessions"
    "settings.local.json"
    "skills"
    "tools"
)

for item in "${ITEMS[@]}"; do
    # Remove existing symlink or file
    if [ -L "$item" ] || [ -e "$item" ]; then
        rm -rf "$item"
    fi

    # Create symlink if source exists
    if [ -e "$CLAUDE_REPO/$item" ]; then
        ln -sf "../repo/.claude/$item" "$item"
        echo "  Linked: $item"
    else
        echo "  Skipped (not found): $item"
    fi
done

echo ""
echo "Claude Code configuration setup complete!"
echo "Symlinks created in: $CLAUDE_ROOT"
