#!/bin/bash
#
# increment-version.sh - Increment version across ALL packages in the NextSpark monorepo
#
# This script updates the version in all package.json files across the monorepo,
# including core packages, themes, and plugins. It uses semver for proper version
# calculation and supports standard semver increments as well as prerelease tags.
#
# USAGE:
#   ./increment-version.sh <type> [--yes]
#
# ARGUMENTS:
#   type     Version increment type: major, minor, patch, alpha, beta, rc
#
# OPTIONS:
#   --yes    Skip confirmation prompt and execute immediately
#
# EXAMPLES:
#   ./increment-version.sh patch          # 0.1.0-beta.4 -> 0.1.1
#   ./increment-version.sh minor          # 0.1.0-beta.4 -> 0.2.0
#   ./increment-version.sh major          # 0.1.0-beta.4 -> 1.0.0
#   ./increment-version.sh alpha          # 0.1.0 -> 0.1.1-alpha.0 or 0.1.0-alpha.0 -> 0.1.0-alpha.1
#   ./increment-version.sh beta           # 0.1.0 -> 0.1.1-beta.0 or 0.1.0-beta.4 -> 0.1.0-beta.5
#   ./increment-version.sh rc             # 0.1.0 -> 0.1.1-rc.0 or 0.1.0-rc.0 -> 0.1.0-rc.1
#   ./increment-version.sh patch --yes    # Skip confirmation
#
# PACKAGES UPDATED:
#   - packages/core
#   - packages/cli
#   - packages/create-nextspark-app
#   - themes/* (all themes)
#   - plugins/* (all plugins)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Parse arguments
VERSION_TYPE=""
SKIP_CONFIRM=false

while [[ $# -gt 0 ]]; do
    case $1 in
        --yes|-y)
            SKIP_CONFIRM=true
            shift
            ;;
        major|minor|patch|alpha|beta|rc)
            VERSION_TYPE="$1"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 <type> [--yes]"
            echo ""
            echo "Arguments:"
            echo "  type     Version increment type: major, minor, patch, alpha, beta, rc"
            echo ""
            echo "Options:"
            echo "  --yes    Skip confirmation prompt"
            echo ""
            echo "Examples:"
            echo "  $0 patch"
            echo "  $0 minor --yes"
            echo "  $0 beta"
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown argument '$1'${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate version type
if [ -z "$VERSION_TYPE" ]; then
    echo -e "${RED}Error: Version type is required${NC}"
    echo ""
    echo "Usage: $0 <type> [--yes]"
    echo "Valid types: major, minor, patch, alpha, beta, rc"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  NextSpark - Version Increment${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Get current version from core package
CORE_PACKAGE="$REPO_ROOT/packages/core/package.json"
if [ ! -f "$CORE_PACKAGE" ]; then
    echo -e "${RED}Error: Could not find $CORE_PACKAGE${NC}"
    exit 1
fi

CURRENT_VERSION=$(node -e "console.log(require('$CORE_PACKAGE').version)")
echo -e "Current version: ${YELLOW}$CURRENT_VERSION${NC}"
echo -e "Increment type:  ${YELLOW}$VERSION_TYPE${NC}"
echo ""

# Calculate new version using Node.js (inline semver logic to avoid dependency)
NEW_VERSION=$(node -e "
const currentVersion = '$CURRENT_VERSION';
const type = '$VERSION_TYPE';

// Parse version: e.g., '0.1.0-beta.4' -> { major: 0, minor: 1, patch: 0, prerelease: 'beta', prereleaseNum: 4 }
const match = currentVersion.match(/^(\d+)\.(\d+)\.(\d+)(?:-(alpha|beta|rc)\.(\d+))?$/);

if (!match) {
    console.error('Invalid version format: ' + currentVersion);
    process.exit(1);
}

let major = parseInt(match[1], 10);
let minor = parseInt(match[2], 10);
let patch = parseInt(match[3], 10);
let prerelease = match[4] || null;
let prereleaseNum = match[5] !== undefined ? parseInt(match[5], 10) : null;

let newVersion;

switch (type) {
    case 'major':
        newVersion = (major + 1) + '.0.0';
        break;
    case 'minor':
        newVersion = major + '.' + (minor + 1) + '.0';
        break;
    case 'patch':
        if (prerelease) {
            // If currently on prerelease, patch just removes the prerelease tag
            newVersion = major + '.' + minor + '.' + patch;
        } else {
            newVersion = major + '.' + minor + '.' + (patch + 1);
        }
        break;
    case 'alpha':
    case 'beta':
    case 'rc':
        if (prerelease === type) {
            // Same prerelease type, increment the number
            newVersion = major + '.' + minor + '.' + patch + '-' + type + '.' + (prereleaseNum + 1);
        } else if (prerelease) {
            // Different prerelease type, start from 0
            newVersion = major + '.' + minor + '.' + patch + '-' + type + '.0';
        } else {
            // Not on prerelease, bump patch and add prerelease
            newVersion = major + '.' + minor + '.' + (patch + 1) + '-' + type + '.0';
        }
        break;
    default:
        console.error('Unknown version type: ' + type);
        process.exit(1);
}

console.log(newVersion);
")

if [ $? -ne 0 ] || [ -z "$NEW_VERSION" ]; then
    echo -e "${RED}Error: Failed to calculate new version${NC}"
    exit 1
fi

echo -e "New version:     ${GREEN}$NEW_VERSION${NC}"
echo ""

# Collect all package paths
PACKAGES=()

# Core packages
for pkg in core cli create-nextspark-app; do
    pkg_path="$REPO_ROOT/packages/$pkg"
    if [ -d "$pkg_path" ] && [ -f "$pkg_path/package.json" ]; then
        PACKAGES+=("$pkg_path")
    fi
done

# Themes
for theme in "$REPO_ROOT/themes"/*; do
    if [ -d "$theme" ] && [ -f "$theme/package.json" ]; then
        PACKAGES+=("$theme")
    fi
done

# Plugins
for plugin in "$REPO_ROOT/plugins"/*; do
    if [ -d "$plugin" ] && [ -f "$plugin/package.json" ]; then
        PACKAGES+=("$plugin")
    fi
done

echo -e "${CYAN}Packages to update:${NC}"
for pkg in "${PACKAGES[@]}"; do
    pkg_name=$(node -e "console.log(require('$pkg/package.json').name)")
    pkg_version=$(node -e "console.log(require('$pkg/package.json').version)")
    echo -e "  - $pkg_name: ${YELLOW}$pkg_version${NC} -> ${GREEN}$NEW_VERSION${NC}"
done
echo ""

# Confirmation
if [ "$SKIP_CONFIRM" = false ]; then
    echo -e "${YELLOW}This will update ${#PACKAGES[@]} packages.${NC}"
    read -p "Continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${RED}Aborted.${NC}"
        exit 1
    fi
    echo ""
fi

# Update versions
echo -e "${CYAN}Updating versions...${NC}"
updated_count=0
for pkg in "${PACKAGES[@]}"; do
    pkg_json="$pkg/package.json"
    pkg_name=$(node -e "console.log(require('$pkg_json').name)")

    # Use node to update the version in package.json
    node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$pkg_json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('$pkg_json', JSON.stringify(pkg, null, 2) + '\n');
"

    if [ $? -eq 0 ]; then
        echo -e "  ${GREEN}[OK]${NC} $pkg_name"
        ((updated_count++))
    else
        echo -e "  ${RED}[FAIL]${NC} $pkg_name"
    fi
done

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Version Update Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Updated ${GREEN}$updated_count${NC} packages to version ${GREEN}$NEW_VERSION${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Review changes:  git diff"
echo "  2. Commit changes:  git add -A && git commit -m \"chore: bump version to $NEW_VERSION\""
echo "  3. Create tag:      git tag v$NEW_VERSION"
echo "  4. Build packages:  pnpm build"
echo "  5. Publish:         ./scripts/utils/repackage.sh --all && ./scripts/utils/publish.sh ./dist"
echo ""
