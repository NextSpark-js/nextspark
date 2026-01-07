#!/bin/bash
#
# update-local.sh - Update existing project with local .tgz packages
#
# This script repackages all monorepo packages and updates an EXISTING
# project to use them. Unlike local.sh which creates a new project,
# this updates a project that was already initialized (e.g., via npm).
#
# USAGE:
#   ./update-local.sh [options]
#
# OPTIONS:
#   --target <path>    Target project directory (default: ../../projects/my-app)
#   --skip-build       Skip building packages before packing
#   --skip-install     Skip pnpm install after updating package.json
#   --help             Show this help message
#
# EXAMPLES:
#   ./update-local.sh                              # Update my-app with all local packages
#   ./update-local.sh --skip-build                 # Skip rebuild, just repack
#   ./update-local.sh --target ../projects/other   # Update a different project
#
# WORKFLOW:
#   1. Runs pack.sh --all to build and package everything
#   2. Copies .tgz files to target/.packages/
#   3. Updates target/package.json with file: references
#   4. Runs pnpm install --force in target
#
# This script is designed for the development workflow:
#   - Make changes in /repo
#   - Test in /repo (port 5173)
#   - Run this script to update my-app
#   - Test in my-app (port 3000)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Get script directory and repo root
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
PROJECTS_DIR="$(cd "$REPO_ROOT/.." && pwd)/projects"

# Default options
TARGET_DIR="$PROJECTS_DIR/my-app"
SKIP_BUILD=false
SKIP_INSTALL=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --target requires a path${NC}"
                exit 1
            fi
            TARGET_DIR="$2"
            # Convert to absolute path if relative
            if [[ "$TARGET_DIR" != /* ]]; then
                TARGET_DIR="$(cd "$REPO_ROOT" && cd "$TARGET_DIR" && pwd)"
            fi
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --skip-install)
            SKIP_INSTALL=true
            shift
            ;;
        -h|--help)
            head -n 38 "$0" | tail -n 36 | sed 's/^# //' | sed 's/^#//'
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown argument '$1'${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate target directory
if [ ! -d "$TARGET_DIR" ]; then
    echo -e "${RED}Error: Target directory does not exist: $TARGET_DIR${NC}"
    exit 1
fi

if [ ! -f "$TARGET_DIR/package.json" ]; then
    echo -e "${RED}Error: No package.json found in target directory${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  NextSpark - Update Local Packages${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""
echo -e "Repo root:    ${BLUE}$REPO_ROOT${NC}"
echo -e "Target:       ${BLUE}$TARGET_DIR${NC}"
echo -e "Skip build:   ${BLUE}$SKIP_BUILD${NC}"
echo -e "Skip install: ${BLUE}$SKIP_INSTALL${NC}"
echo ""

# Step 1: Run pack.sh to build and package everything
echo -e "${YELLOW}[1/4] Repackaging all packages...${NC}"

PACK_ARGS="--all --clean"
if [ "$SKIP_BUILD" = true ]; then
    PACK_ARGS="$PACK_ARGS --skip-build"
fi

bash "$REPO_ROOT/scripts/packages/pack.sh" $PACK_ARGS

echo -e "${GREEN}  ✓ Packages built and packed${NC}"
echo ""

# Step 2: Create .packages directory in target and copy .tgz files
echo -e "${YELLOW}[2/4] Copying packages to target...${NC}"

mkdir -p "$TARGET_DIR/.packages"
rm -f "$TARGET_DIR/.packages"/*.tgz 2>/dev/null || true

cp "$REPO_ROOT/.packages"/*.tgz "$TARGET_DIR/.packages/"

TGZ_COUNT=$(ls -1 "$TARGET_DIR/.packages"/*.tgz 2>/dev/null | wc -l | tr -d ' ')
echo -e "${GREEN}  ✓ Copied $TGZ_COUNT packages to $TARGET_DIR/.packages/${NC}"
echo ""

# Step 3: Update package.json with file: references
echo -e "${YELLOW}[3/4] Updating package.json with local references...${NC}"

cd "$TARGET_DIR"

# Use node to safely update package.json
node -e "
const fs = require('fs');
const path = require('path');

const pkgPath = './package.json';
const packagesDir = './.packages';

// Read current package.json
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

// Get all .tgz files
const tgzFiles = fs.readdirSync(packagesDir).filter(f => f.endsWith('.tgz'));

// Create mapping of package names to file: references
const updates = {};
tgzFiles.forEach(tgz => {
    let pkgName;
    if (tgz.startsWith('create-nextspark-app-')) {
        pkgName = 'create-nextspark-app';
    } else if (tgz.startsWith('nextsparkjs-')) {
        // nextsparkjs-core-1.0.0.tgz -> @nextsparkjs/core
        // nextsparkjs-theme-default-1.0.0.tgz -> @nextsparkjs/theme-default
        const base = tgz.replace(/-\\d+\\.\\d+\\.\\d+.*\\.tgz\$/, '');
        pkgName = '@' + base.replace('nextsparkjs-', 'nextsparkjs/');
    }
    if (pkgName) {
        updates[pkgName] = 'file:' + packagesDir + '/' + tgz;
    }
});

// Update dependencies
let updated = [];
const sections = ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies'];

sections.forEach(section => {
    if (pkg[section]) {
        Object.keys(pkg[section]).forEach(dep => {
            if (updates[dep]) {
                const oldVal = pkg[section][dep];
                pkg[section][dep] = updates[dep];
                if (!oldVal.startsWith('file:')) {
                    updated.push(dep);
                }
            }
        });
    }
});

// Write updated package.json
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\\n');

// Report updates
if (updated.length > 0) {
    console.log('Updated packages:');
    updated.forEach(p => console.log('  - ' + p));
} else {
    console.log('All @nextsparkjs packages already using local references');
}
"

echo -e "${GREEN}  ✓ package.json updated${NC}"
echo ""

# Step 4: Run pnpm install
if [ "$SKIP_INSTALL" = false ]; then
    echo -e "${YELLOW}[4/4] Installing dependencies...${NC}"

    # Clean .next cache to avoid stale modules
    if [ -d ".next" ]; then
        rm -rf .next
        echo -e "  ${BLUE}Cleaned .next cache${NC}"
    fi

    pnpm install --force

    echo -e "${GREEN}  ✓ Dependencies installed${NC}"
else
    echo -e "${YELLOW}[4/4] Skipping install (--skip-install)${NC}"
fi

echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Update Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Target project updated: ${CYAN}$TARGET_DIR${NC}"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  cd $TARGET_DIR"
echo "  pnpm dev              # Start dev server (port 3000)"
echo ""
echo -e "${CYAN}Testing checklist:${NC}"
echo "  [ ] Server starts without errors"
echo "  [ ] API responds (auth error = OK, entity not found = FAIL)"
echo "  [ ] Dashboard loads entities in sidebar"
echo "  [ ] CRUD works after login"
echo ""
