#!/bin/bash
#
# publish.sh - Publish .tgz files to npm registry
#
# This script publishes NextSpark packages to the npm registry in the
# correct dependency order. It verifies npm authentication, handles
# OTP for 2FA, and supports dry-run mode for testing.
#
# USAGE:
#   ./publish.sh <packages-dir> [options]
#
# ARGUMENTS:
#   packages-dir    Directory containing .tgz files to publish
#
# OPTIONS:
#   --tag <tag>       npm dist-tag (default: latest)
#                     Common tags: latest, beta, alpha, next, rc
#   --dry-run         Perform a dry run without publishing
#   --otp <code>      One-time password for npm 2FA
#   --no-cleanup      Keep .tgz files after successful publish
#   --registry <url>  Custom npm registry URL
#   --help            Show this help message
#
# EXAMPLES:
#   ./publish.sh ./dist                            # Publish all packages in dist
#   ./publish.sh ./dist --tag beta                 # Publish with beta tag
#   ./publish.sh ./dist --dry-run                  # Test without publishing
#   ./publish.sh ./dist --otp 123456               # Publish with 2FA code
#   ./publish.sh ./dist --registry http://localhost:4873  # Publish to verdaccio
#   ./publish.sh ./dist --no-cleanup               # Keep .tgz files after publish
#
# PUBLISH ORDER:
#   Packages are published in dependency order:
#   1. @nextsparkjs/core
#   2. @nextsparkjs/cli
#   3. create-nextspark-app
#   4. Themes (@nextsparkjs/theme-*)
#   5. Plugins (@nextsparkjs/plugin-*)
#
# REQUIREMENTS:
#   - npm must be installed and authenticated (npm login)
#   - For scoped packages, you may need: npm login --scope=@nextsparkjs
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
PACKAGES_DIR=""
TAG="latest"
DRY_RUN=false
OTP=""
CLEANUP=true
REGISTRY=""

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --tag)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --tag requires a tag name${NC}"
                exit 1
            fi
            TAG="$2"
            shift 2
            ;;
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --otp)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --otp requires a code${NC}"
                exit 1
            fi
            OTP="$2"
            shift 2
            ;;
        --no-cleanup)
            CLEANUP=false
            shift
            ;;
        --registry)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --registry requires a URL${NC}"
                exit 1
            fi
            REGISTRY="$2"
            shift 2
            ;;
        -h|--help)
            echo "Usage: $0 <packages-dir> [options]"
            echo ""
            echo "Arguments:"
            echo "  packages-dir    Directory containing .tgz files"
            echo ""
            echo "Options:"
            echo "  --tag <tag>       npm dist-tag (default: latest)"
            echo "  --dry-run         Test without publishing"
            echo "  --otp <code>      2FA one-time password"
            echo "  --no-cleanup      Keep .tgz files after publish"
            echo "  --registry <url>  Custom npm registry"
            echo ""
            echo "Examples:"
            echo "  $0 ./dist"
            echo "  $0 ./dist --tag beta --dry-run"
            echo "  $0 ./dist --otp 123456"
            exit 0
            ;;
        -*)
            echo -e "${RED}Error: Unknown option '$1'${NC}"
            echo "Use --help for usage information"
            exit 1
            ;;
        *)
            if [ -z "$PACKAGES_DIR" ]; then
                PACKAGES_DIR="$1"
                # Convert to absolute path if relative
                if [[ "$PACKAGES_DIR" != /* ]]; then
                    PACKAGES_DIR="$(pwd)/$PACKAGES_DIR"
                fi
            else
                echo -e "${RED}Error: Unexpected argument '$1'${NC}"
                exit 1
            fi
            shift
            ;;
    esac
done

# Validate packages directory
if [ -z "$PACKAGES_DIR" ]; then
    echo -e "${RED}Error: Packages directory is required${NC}"
    echo ""
    echo "Usage: $0 <packages-dir> [options]"
    echo "Use --help for more information"
    exit 1
fi

if [ ! -d "$PACKAGES_DIR" ]; then
    echo -e "${RED}Error: Directory not found: $PACKAGES_DIR${NC}"
    exit 1
fi

# Check for .tgz files
TGZ_COUNT=$(ls -1 "$PACKAGES_DIR"/*.tgz 2>/dev/null | wc -l | tr -d ' ')
if [ "$TGZ_COUNT" -eq 0 ]; then
    echo -e "${RED}Error: No .tgz files found in $PACKAGES_DIR${NC}"
    exit 1
fi

echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  NextSpark - Publish to npm${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

# Verify npm authentication
echo -e "${CYAN}Verifying npm authentication...${NC}"
REGISTRY_ARGS=""
if [ -n "$REGISTRY" ]; then
    REGISTRY_ARGS="--registry $REGISTRY"
fi

NPM_USER=$(npm whoami $REGISTRY_ARGS 2>/dev/null) || {
    echo -e "${RED}Error: Not logged in to npm${NC}"
    echo ""
    echo "Please run: npm login"
    if [ -n "$REGISTRY" ]; then
        echo "Or for custom registry: npm login --registry $REGISTRY"
    fi
    exit 1
}
echo -e "  Logged in as: ${GREEN}$NPM_USER${NC}"
echo ""

# Display configuration
echo -e "${CYAN}Configuration:${NC}"
echo "  Packages directory: $PACKAGES_DIR"
echo "  Distribution tag:   $TAG"
echo "  Dry run:           $DRY_RUN"
echo "  Cleanup after:     $CLEANUP"
if [ -n "$REGISTRY" ]; then
    echo "  Registry:          $REGISTRY"
fi
if [ -n "$OTP" ]; then
    echo "  OTP:               ******"
fi
echo ""

# Define publish order for correct dependency resolution
PUBLISH_ORDER=(
    "nextsparkjs-core-"
    "nextsparkjs-testing-"
    "nextsparkjs-cli-"
    "create-nextspark-app-"
)

# Function to find and sort .tgz files by publish order
get_ordered_packages() {
    local dir="$1"
    declare -a ordered=()
    declare -a themes=()
    declare -a plugins=()
    declare -a others=()

    # First, add packages in defined order
    for prefix in "${PUBLISH_ORDER[@]}"; do
        for tgz in "$dir"/*.tgz; do
            if [[ "$(basename "$tgz")" == "$prefix"* ]]; then
                ordered+=("$tgz")
            fi
        done
    done

    # Then collect themes, plugins, and others
    for tgz in "$dir"/*.tgz; do
        local basename=$(basename "$tgz")
        local already_added=false

        # Check if already in ordered list
        for added in "${ordered[@]}"; do
            if [ "$tgz" = "$added" ]; then
                already_added=true
                break
            fi
        done

        if [ "$already_added" = false ]; then
            if [[ "$basename" == *"-theme-"* ]] || [[ "$basename" == "nextsparkjs-theme-"* ]]; then
                themes+=("$tgz")
            elif [[ "$basename" == *"-plugin-"* ]] || [[ "$basename" == "nextsparkjs-plugin-"* ]]; then
                plugins+=("$tgz")
            else
                others+=("$tgz")
            fi
        fi
    done

    # Combine: ordered -> themes -> plugins -> others
    for tgz in "${ordered[@]}"; do echo "$tgz"; done
    for tgz in "${themes[@]}"; do echo "$tgz"; done
    for tgz in "${plugins[@]}"; do echo "$tgz"; done
    for tgz in "${others[@]}"; do echo "$tgz"; done
}

# Publish a single package
publish_package() {
    local tgz_file="$1"
    local pkg_basename=$(basename "$tgz_file")

    echo -e "  Publishing ${CYAN}$pkg_basename${NC}..."

    # Build npm publish command
    local cmd="npm publish \"$tgz_file\" --tag $TAG --access public"

    if [ -n "$REGISTRY" ]; then
        cmd="$cmd --registry $REGISTRY"
    fi

    if [ -n "$OTP" ]; then
        cmd="$cmd --otp $OTP"
    fi

    if [ "$DRY_RUN" = true ]; then
        cmd="$cmd --dry-run"
    fi

    # Execute publish
    if eval "$cmd" > /dev/null 2>&1; then
        if [ "$DRY_RUN" = true ]; then
            echo -e "    ${YELLOW}[DRY-RUN]${NC} Would publish $pkg_basename"
        else
            echo -e "    ${GREEN}[OK]${NC} Published $pkg_basename"
        fi
        return 0
    else
        echo -e "    ${RED}[FAIL]${NC} Failed to publish $pkg_basename"
        # Try again with verbose output for debugging
        echo -e "    ${YELLOW}Retrying with verbose output...${NC}"
        eval "$cmd" 2>&1 | head -20
        return 1
    fi
}

# Get ordered list of packages
echo -e "${CYAN}Packages to publish (in order):${NC}"
# Use while loop instead of mapfile for bash 3.2 compatibility (macOS)
ORDERED_PACKAGES=()
while IFS= read -r line; do
    [[ -n "$line" ]] && ORDERED_PACKAGES+=("$line")
done < <(get_ordered_packages "$PACKAGES_DIR")

for tgz in "${ORDERED_PACKAGES[@]}"; do
    echo "  - $(basename "$tgz")"
done
echo ""

# Publish packages
echo -e "${CYAN}Publishing packages...${NC}"
published_count=0
failed_count=0

for tgz in "${ORDERED_PACKAGES[@]}"; do
    if publish_package "$tgz"; then
        ((published_count++))
    else
        ((failed_count++))
        # Continue with other packages or abort?
        echo -e "${YELLOW}Warning: Continuing with remaining packages...${NC}"
    fi
done
echo ""

# Cleanup
if [ "$CLEANUP" = true ] && [ "$DRY_RUN" = false ] && [ $failed_count -eq 0 ]; then
    echo -e "${CYAN}Cleaning up...${NC}"
    rm -rf "$PACKAGES_DIR"
    echo -e "  ${GREEN}[OK]${NC} Removed $PACKAGES_DIR"
    echo ""
fi

# Summary
echo -e "${GREEN}========================================${NC}"
if [ $failed_count -eq 0 ]; then
    echo -e "${GREEN}  Publish Complete!${NC}"
else
    echo -e "${YELLOW}  Publish Completed with Errors${NC}"
fi
echo -e "${GREEN}========================================${NC}"
echo ""

if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}DRY RUN - No packages were actually published${NC}"
    echo ""
fi

echo -e "Published: ${GREEN}$published_count${NC}"
if [ $failed_count -gt 0 ]; then
    echo -e "Failed:    ${RED}$failed_count${NC}"
fi
echo ""

if [ $failed_count -eq 0 ]; then
    echo -e "${CYAN}Packages are now available on npm:${NC}"
    echo "  npm install @nextsparkjs/core@$TAG"
    echo "  npx create-nextspark-app@$TAG"
    echo ""
fi

# Exit with error if any packages failed
if [ $failed_count -gt 0 ]; then
    exit 1
fi
