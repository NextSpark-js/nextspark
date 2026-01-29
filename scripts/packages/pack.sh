#!/bin/bash
#
# repackage.sh - Package monorepo packages into .tgz files
#
# This script builds and packages NextSpark packages into .tgz files
# suitable for npm distribution. It supports packaging all packages
# or individual packages with various options.
#
# USAGE:
#   ./repackage.sh [options]
#
# OPTIONS:
#   --all              Package all packages (core, cli, create-app, themes, plugins)
#   --package <name>   Package a specific package (can be used multiple times)
#                      Valid names: core, cli, create-app, theme-*, plugin-*
#   --output <path>    Output directory for .tgz files (default: ./.packages)
#   --skip-build       Skip building packages before packing
#   --clean            Clean output directory before packing
#   --help             Show this help message
#
# EXAMPLES:
#   ./repackage.sh --all                           # Package everything
#   ./repackage.sh --all --clean                   # Clean dist and package everything
#   ./repackage.sh --package core                  # Package only core
#   ./repackage.sh --package core --package cli    # Package core and cli
#   ./repackage.sh --all --skip-build              # Package without rebuilding
#   ./repackage.sh --all --output ./my-dist        # Custom output directory
#   ./repackage.sh --package theme-default         # Package a specific theme
#   ./repackage.sh --package plugin-ai             # Package a specific plugin
#
# PACKAGE NAMES:
#   Core packages: core, testing, cli, create-app
#   Themes:        theme-default, theme-blog, theme-crm, theme-productivity, etc.
#   Plugins:       plugin-ai, plugin-amplitude, plugin-langchain, plugin-social-media-publisher, etc.
#
# BUILD ORDER:
#   When building, packages are built in dependency order:
#   1. core (other packages depend on this)
#   2. testing (themes depend on this for selectors)
#   3. cli
#   4. create-app
#   5. themes
#   6. plugins
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

# Default options
OUTPUT_DIR="$REPO_ROOT/.packages"
SKIP_BUILD=false
CLEAN=false
PACK_ALL=false
declare -a PACKAGES_TO_PACK=()

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --all)
            PACK_ALL=true
            shift
            ;;
        --package)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --package requires a package name${NC}"
                exit 1
            fi
            PACKAGES_TO_PACK+=("$2")
            shift 2
            ;;
        --output)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --output requires a path${NC}"
                exit 1
            fi
            OUTPUT_DIR="$2"
            # Convert to absolute path if relative
            if [[ "$OUTPUT_DIR" != /* ]]; then
                OUTPUT_DIR="$REPO_ROOT/$OUTPUT_DIR"
            fi
            shift 2
            ;;
        --skip-build)
            SKIP_BUILD=true
            shift
            ;;
        --clean)
            CLEAN=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --all              Package all packages"
            echo "  --package <name>   Package a specific package (can be repeated)"
            echo "  --output <path>    Output directory (default: ./.packages)"
            echo "  --skip-build       Skip building before packing"
            echo "  --clean            Clean output directory first"
            echo ""
            echo "Package names: core, testing, cli, create-app, theme-*, plugin-*"
            echo ""
            echo "Examples:"
            echo "  $0 --all"
            echo "  $0 --package core --package cli"
            echo "  $0 --all --skip-build --clean"
            exit 0
            ;;
        *)
            echo -e "${RED}Error: Unknown argument '$1'${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

# Validate arguments
if [ "$PACK_ALL" = false ] && [ ${#PACKAGES_TO_PACK[@]} -eq 0 ]; then
    echo -e "${RED}Error: Specify --all or use --package to select packages${NC}"
    echo "Use --help for usage information"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  NextSpark - Repackage${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Resolve package name to path
resolve_package_path() {
    local name="$1"
    case "$name" in
        core)
            echo "$REPO_ROOT/packages/core"
            ;;
        testing)
            echo "$REPO_ROOT/packages/testing"
            ;;
        cli)
            echo "$REPO_ROOT/packages/cli"
            ;;
        create-app)
            echo "$REPO_ROOT/packages/create-nextspark-app"
            ;;
        theme-*)
            local theme_name="${name#theme-}"
            echo "$REPO_ROOT/themes/$theme_name"
            ;;
        plugin-*)
            local plugin_name="${name#plugin-}"
            echo "$REPO_ROOT/plugins/$plugin_name"
            ;;
        *)
            echo ""
            ;;
    esac
}

# Build a package
build_package() {
    local pkg_path="$1"
    local pkg_name=$(node -e "console.log(require('$pkg_path/package.json').name)")

    echo -e "  Building ${CYAN}$pkg_name${NC}..."

    cd "$pkg_path"

    # Check if build script exists
    if node -e "const pkg = require('./package.json'); process.exit(pkg.scripts && pkg.scripts.build ? 0 : 1)" 2>/dev/null; then
        if pnpm build > /dev/null 2>&1; then
            echo -e "    ${GREEN}[OK]${NC} Built $pkg_name"
            return 0
        else
            echo -e "    ${RED}[FAIL]${NC} Build failed for $pkg_name"
            return 1
        fi
    else
        echo -e "    ${YELLOW}[SKIP]${NC} No build script for $pkg_name"
        return 0
    fi
}

# Pack a package
pack_package() {
    local pkg_path="$1"
    local pkg_name=$(node -e "console.log(require('$pkg_path/package.json').name)")

    echo -e "  Packing ${CYAN}$pkg_name${NC}..."

    cd "$pkg_path"

    # Pack and capture the output filename
    local tgz_file=$(pnpm pack 2>&1 | tail -1)

    if [ -f "$tgz_file" ]; then
        mv "$tgz_file" "$OUTPUT_DIR/"
        echo -e "    ${GREEN}[OK]${NC} $tgz_file"
        return 0
    else
        echo -e "    ${RED}[FAIL]${NC} Pack failed for $pkg_name"
        return 1
    fi
}

# Clean output directory if requested
if [ "$CLEAN" = true ]; then
    echo -e "${YELLOW}Cleaning output directory...${NC}"
    rm -rf "$OUTPUT_DIR"
    echo -e "  ${GREEN}[OK]${NC} Cleaned $OUTPUT_DIR"
    echo ""
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"
echo -e "Output directory: ${CYAN}$OUTPUT_DIR${NC}"
echo ""

# Collect all package paths to process
declare -a FINAL_PACKAGES=()

if [ "$PACK_ALL" = true ]; then
    # Add core packages in order (ui and mobile must come before core)
    FINAL_PACKAGES+=("$REPO_ROOT/packages/ui")
    FINAL_PACKAGES+=("$REPO_ROOT/packages/mobile")
    FINAL_PACKAGES+=("$REPO_ROOT/packages/core")
    FINAL_PACKAGES+=("$REPO_ROOT/packages/testing")
    FINAL_PACKAGES+=("$REPO_ROOT/packages/cli")
    FINAL_PACKAGES+=("$REPO_ROOT/packages/create-nextspark-app")

    # Add all themes
    for theme in "$REPO_ROOT/themes"/*; do
        if [ -d "$theme" ] && [ -f "$theme/package.json" ]; then
            FINAL_PACKAGES+=("$theme")
        fi
    done

    # Add all plugins
    for plugin in "$REPO_ROOT/plugins"/*; do
        if [ -d "$plugin" ] && [ -f "$plugin/package.json" ]; then
            FINAL_PACKAGES+=("$plugin")
        fi
    done
else
    # Resolve specified package names to paths
    for pkg_name in "${PACKAGES_TO_PACK[@]}"; do
        pkg_path=$(resolve_package_path "$pkg_name")
        if [ -z "$pkg_path" ]; then
            echo -e "${RED}Error: Unknown package name '$pkg_name'${NC}"
            echo "Valid names: core, cli, create-app, theme-*, plugin-*"
            exit 1
        fi
        if [ ! -d "$pkg_path" ] || [ ! -f "$pkg_path/package.json" ]; then
            echo -e "${RED}Error: Package not found at $pkg_path${NC}"
            exit 1
        fi
        FINAL_PACKAGES+=("$pkg_path")
    done
fi

echo -e "${CYAN}Packages to process:${NC}"
for pkg in "${FINAL_PACKAGES[@]}"; do
    pkg_name=$(node -e "console.log(require('$pkg/package.json').name)")
    echo "  - $pkg_name"
done
echo ""

# Build packages if not skipped
if [ "$SKIP_BUILD" = false ]; then
    echo -e "${CYAN}Building packages...${NC}"

    # Sync templates from apps/dev before building core
    # This ensures templates are up-to-date with the development source
    if [[ " ${FINAL_PACKAGES[*]} " =~ " $REPO_ROOT/packages/core " ]]; then
        echo -e "  ${CYAN}Syncing templates from apps/dev...${NC}"
        cd "$REPO_ROOT"
        if pnpm sync:templates --sync > /dev/null 2>&1; then
            echo -e "    ${GREEN}[OK]${NC} Templates synced"
        else
            echo -e "    ${RED}[FAIL]${NC} Template sync failed"
            exit 1
        fi
    fi

    # Build ui first (other packages depend on this)
    if [[ " ${FINAL_PACKAGES[*]} " =~ " $REPO_ROOT/packages/ui " ]]; then
        build_package "$REPO_ROOT/packages/ui"
    fi

    # Build mobile second
    if [[ " ${FINAL_PACKAGES[*]} " =~ " $REPO_ROOT/packages/mobile " ]]; then
        build_package "$REPO_ROOT/packages/mobile"
    fi

    # Build core third (required by other packages)
    if [[ " ${FINAL_PACKAGES[*]} " =~ " $REPO_ROOT/packages/core " ]]; then
        build_package "$REPO_ROOT/packages/core"
    fi

    # Build cli
    if [[ " ${FINAL_PACKAGES[*]} " =~ " $REPO_ROOT/packages/cli " ]]; then
        build_package "$REPO_ROOT/packages/cli"
    fi

    # Build create-app
    if [[ " ${FINAL_PACKAGES[*]} " =~ " $REPO_ROOT/packages/create-nextspark-app " ]]; then
        build_package "$REPO_ROOT/packages/create-nextspark-app"
    fi

    # Build remaining packages (themes and plugins)
    for pkg in "${FINAL_PACKAGES[@]}"; do
        case "$pkg" in
            */packages/ui|*/packages/mobile|*/packages/core|*/packages/cli|*/packages/create-nextspark-app)
                # Already built above
                ;;
            *)
                build_package "$pkg"
                ;;
        esac
    done
    echo ""
else
    echo -e "${YELLOW}Skipping build step (--skip-build)${NC}"
    echo ""
fi

# Pack packages
echo -e "${CYAN}Packing packages...${NC}"
packed_count=0
for pkg in "${FINAL_PACKAGES[@]}"; do
    if pack_package "$pkg"; then
        ((packed_count++))
    fi
done
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Repackage Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "Packed ${GREEN}$packed_count${NC} packages to ${CYAN}$OUTPUT_DIR${NC}"
echo ""
echo -e "${CYAN}Package files:${NC}"
ls -la "$OUTPUT_DIR"/*.tgz 2>/dev/null || echo "  No .tgz files found"
echo ""
echo -e "${CYAN}Next steps:${NC}"
echo "  1. Test locally:  pnpm setup:local"
echo "  2. Publish:       pnpm pkg:publish"
echo ""
