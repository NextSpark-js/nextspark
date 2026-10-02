#!/bin/bash
#
# publish.sh - Publish .tgz files to npm registry
#
# This script publishes NextSpark packages to the npm registry in the
# correct dependency order. It verifies npm authentication, handles
# OTP for 2FA, and supports dry-run mode for testing.
# Run it on a terminal and do not pipe its output (| tee): npm's browser
# 2FA (security key) only works when npm's stdin and stdout are a TTY.
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
#   --also-tag <tag>  After every package is published, also point <tag> at each
#                     published version: npm dist-tag add <pkg>@<version> <tag>
#                     (e.g. --tag latest --also-tag beta). The dist-tags run in
#                     one block at the end, so browser 2FA is not asked per
#                     package. In --dry-run the commands are printed, not run.
#   --dry-run         Perform a dry run without publishing
#   --skip-auth-check Skip the npm whoami check (only valid with --dry-run)
#   --otp <code>      One-time password for npm 2FA
#   --no-cleanup      Keep .tgz files after successful publish
#   --registry <url>  Custom npm registry URL
#   --help            Show this help message
#
# EXAMPLES:
#   ./publish.sh ./dist                            # Publish all packages in dist
#   ./publish.sh ./dist --tag beta                 # Publish with beta tag
#   ./publish.sh ./dist --dry-run                  # Test without publishing
#   ./publish.sh ./dist --tag latest --also-tag beta   # latest, and move beta to it
#   ./publish.sh ./dist --dry-run --skip-auth-check    # Dry run without npm login
#   ./publish.sh ./dist --otp 123456               # Publish with 2FA code
#   ./publish.sh ./dist --registry http://localhost:4873  # Publish to verdaccio
#   ./publish.sh ./dist --no-cleanup               # Keep .tgz files after publish
#
# PUBLISH ORDER:
#   Packages are published in dependency order, computed from the tarballs'
#   package.json (dependencies / peerDependencies / optionalDependencies on
#   other packages in the set; see publish-order.mjs). A package is never
#   live before an internal dependency it pins (ui before core, core before
#   the plugins, ...). A dependency cycle aborts the run before publishing.
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
ALSO_TAG=""
SKIP_AUTH_CHECK=false

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
        --also-tag)
            if [ -z "$2" ] || [[ "$2" == --* ]]; then
                echo -e "${RED}Error: --also-tag requires a tag name${NC}"
                exit 1
            fi
            ALSO_TAG="$2"
            shift 2
            ;;
        --skip-auth-check)
            SKIP_AUTH_CHECK=true
            shift
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
            echo "  --also-tag <tag>  After all packages are published, run 'npm dist-tag add <pkg>@<version> <tag>'"
            echo "                    for each one (e.g. --tag latest --also-tag beta)"
            echo "  --dry-run         Test without publishing (prints the dist-tag commands)"
            echo "  --skip-auth-check Skip npm whoami (only with --dry-run)"
            echo "  --otp <code>      2FA one-time password"
            echo "  --no-cleanup      Keep .tgz files after publish"
            echo "  --registry <url>  Custom npm registry"
            echo ""
            echo "Examples:"
            echo "  $0 ./dist"
            echo "  $0 ./dist --tag beta --dry-run"
            echo "  $0 ./dist --tag latest --also-tag beta"
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

if [ "$SKIP_AUTH_CHECK" = true ] && [ "$DRY_RUN" = false ]; then
    echo -e "${RED}Error: --skip-auth-check is only valid with --dry-run${NC}"
    exit 1
fi

if [ -n "$ALSO_TAG" ] && [ "$ALSO_TAG" = "$TAG" ]; then
    echo -e "${RED}Error: --also-tag must differ from --tag ($TAG)${NC}"
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

# Run version validation before publishing
echo -e "${CYAN}Running version validation...${NC}"
if ! pnpm pkg:validate; then
    echo -e "${RED}Version validation failed. Fix errors before publishing.${NC}"
    exit 1
fi
echo ""

# Verify what is about to be published: tarball contents, the release set and
# the files allowlists behind them
echo -e "${CYAN}Verifying tarballs...${NC}"
if ! node "$REPO_ROOT/scripts/packages/verify-tarballs.mjs" --expect-all "$PACKAGES_DIR"; then
    echo -e "${RED}Tarball verification failed. Fix errors before publishing.${NC}"
    exit 1
fi
echo ""

# Verify npm authentication
echo -e "${CYAN}Verifying npm authentication...${NC}"
REGISTRY_ARGS=""
if [ -n "$REGISTRY" ]; then
    REGISTRY_ARGS="--registry $REGISTRY"
fi

if [ "$SKIP_AUTH_CHECK" = true ]; then
    echo -e "  ${YELLOW}[SKIPPED]${NC} --skip-auth-check (dry run)"
else
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
fi
echo ""

# Display configuration
echo -e "${CYAN}Configuration:${NC}"
echo "  Packages directory: $PACKAGES_DIR"
echo "  Distribution tag:   $TAG"
if [ -n "$ALSO_TAG" ]; then
    echo "  Also tag:          $ALSO_TAG"
fi
echo "  Dry run:           $DRY_RUN"
echo "  Cleanup after:     $CLEANUP"
if [ -n "$REGISTRY" ]; then
    echo "  Registry:          $REGISTRY"
fi
if [ -n "$OTP" ]; then
    echo "  OTP:               ******"
fi
echo ""

FAILED_TAG_CMDS=()

# True when name@version is already on the registry (a re-run after a partial publish)
already_published() {
    npm view "$1@$2" version $REGISTRY_ARGS > /dev/null 2>&1
}

# Point --also-tag at the version just published
add_dist_tag() {
    local pkg_name="$1"
    local pkg_version="$2"
    [ -n "$ALSO_TAG" ] || return 0

    local cmd="npm dist-tag add $pkg_name@$pkg_version $ALSO_TAG"
    [ -n "$REGISTRY" ] && cmd="$cmd --registry $REGISTRY"
    [ -n "$OTP" ] && cmd="$cmd --otp $OTP"

    if [ "$DRY_RUN" = true ]; then
        echo -e "    ${YELLOW}[DRY-RUN]${NC} Would run: $cmd"
        return 0
    fi
    # On the terminal, not captured: npm only opens the browser 2FA (security key) when stdin and stdout are a TTY
    if eval "$cmd"; then
        echo -e "    ${GREEN}[OK]${NC} $ALSO_TAG -> $pkg_name@$pkg_version"
        return 0
    fi
    echo -e "    ${RED}[FAIL]${NC} dist-tag $ALSO_TAG for $pkg_name@$pkg_version"
    FAILED_TAG_CMDS+=("$cmd")
    return 1
}

# Publish a single package (tab-separated: tgz, name, version)
publish_package() {
    local tgz_file="$1"
    local pkg_name="$2"
    local pkg_version="$3"
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
        local output
        if output=$(eval "$cmd" 2>&1); then
            echo -e "    ${YELLOW}[DRY-RUN]${NC} Would publish $pkg_basename"
            return 0
        fi
        echo -e "    ${RED}[FAIL]${NC} Failed to publish $pkg_basename"
        echo "$output" | tail -20
        return 1
    fi

    # Execute publish once, on the terminal: npm only opens the browser 2FA (security key) when stdin and
    # stdout are a TTY, and its error stays visible above
    if eval "$cmd"; then
        echo -e "    ${GREEN}[OK]${NC} Published $pkg_basename"
        return 0
    fi
    echo -e "    ${RED}[FAIL]${NC} Failed to publish $pkg_basename (npm's output is above)"
    return 1
}

# Get ordered list of packages
echo -e "${CYAN}Packages to publish (in order):${NC}"
# Use while loop instead of mapfile for bash 3.2 compatibility (macOS)
# Order comes from the tarballs' own dependency graph; a cycle aborts before anything is published
ORDER_ERR=$(mktemp)
ORDER_OUTPUT=$(node "$SCRIPT_DIR/publish-order.mjs" "$PACKAGES_DIR" 2>"$ORDER_ERR") || {
    echo -e "${RED}$(cat "$ORDER_ERR")${NC}"
    rm -f "$ORDER_ERR"
    echo -e "${RED}Could not compute the publish order. Nothing was published.${NC}"
    exit 1
}
rm -f "$ORDER_ERR"
ORDERED_PACKAGES=()
while IFS= read -r line; do
    [[ -n "$line" ]] && ORDERED_PACKAGES+=("$line")
done <<< "$ORDER_OUTPUT"
if [ ${#ORDERED_PACKAGES[@]} -ne "$TGZ_COUNT" ]; then
    echo -e "${RED}The publish order lists ${#ORDERED_PACKAGES[@]} package(s) for $TGZ_COUNT tarball(s). Nothing was published.${NC}"
    exit 1
fi

for entry in "${ORDERED_PACKAGES[@]}"; do
    IFS=$'\t' read -r tgz name version <<< "$entry"
    echo "  - $(basename "$tgz")"
done
echo ""

# Publish packages
echo -e "${CYAN}Publishing packages...${NC}"
published_count=0
failed_count=0
skipped_count=0
TO_TAG=()

for entry in "${ORDERED_PACKAGES[@]}"; do
    IFS=$'\t' read -r tgz name version <<< "$entry"
    if already_published "$name" "$version"; then
        echo -e "  ${CYAN}$(basename "$tgz")${NC}"
        echo -e "    ${YELLOW}[SKIP]${NC} already published: $name@$version"
        skipped_count=$((skipped_count + 1))
        TO_TAG+=("$entry")
    elif publish_package "$tgz" "$name" "$version"; then
        published_count=$((published_count + 1))
        TO_TAG+=("$entry")
    else
        failed_count=$((failed_count + 1))
        # Dependents of a package that failed must not go live without it
        echo -e "${RED}Stopping: the remaining packages are not published so none goes live before a dependency.${NC}"
        break
    fi
done
echo ""

# Dist-tags after every publish, in one block on the terminal: consecutive npm writes reuse the browser 2FA
# auth, interleaving publish and dist-tag asked for it twice per package. Already-published packages are tagged too.
if [ -n "$ALSO_TAG" ] && [ ${#TO_TAG[@]} -gt 0 ]; then
    echo -e "${CYAN}Adding dist-tag $ALSO_TAG...${NC}"
    for entry in "${TO_TAG[@]}"; do
        IFS=$'\t' read -r tgz name version <<< "$entry"
        add_dist_tag "$name" "$version" || failed_count=$((failed_count + 1))
    done
    echo ""
fi

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
if [ $skipped_count -gt 0 ]; then
    echo -e "Skipped (already published): ${YELLOW}$skipped_count${NC}"
fi
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

if [ ${#FAILED_TAG_CMDS[@]} -gt 0 ]; then
    echo -e "${YELLOW}Failed dist-tag commands (re-run with a fresh OTP if needed):${NC}"
    for c in "${FAILED_TAG_CMDS[@]}"; do echo "  $c"; done
    echo ""
fi

# Exit with error if any packages failed
if [ $failed_count -gt 0 ]; then
    exit 1
fi
