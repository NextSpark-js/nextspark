#!/bin/bash
#
# NextSpark Local Testing Script
#
# This script automates the complete testing flow from scratch:
# 1. Rebuilds the core package
# 2. Creates a fresh test project
# 3. Installs NextSpark from local tarball
# 4. Runs tests
#
# Usage:
#   ./test-local.sh              # Full test (rebuild + create + test)
#   ./test-local.sh --skip-build # Skip rebuild, only recreate test-app
#   ./test-local.sh --test-only  # Only run tests on existing test-app
#

set -e  # Exit on error

# =============================================================================
# Configuration
# =============================================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORE_DIR="$(dirname "$SCRIPT_DIR")"
REPO_DIR="$(dirname "$(dirname "$CORE_DIR")")"
PROJECT_DIR="$(dirname "$REPO_DIR")/project"
TEST_APP_DIR="$PROJECT_DIR/test-app"
# Extract version from package.json dynamically
PACKAGE_VERSION=$(node -p "require('$CORE_DIR/package.json').version")
TARBALL_NAME="nextsparkjs-core-${PACKAGE_VERSION}.tgz"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# =============================================================================
# Helper Functions
# =============================================================================

log_step() {
    echo ""
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
}

log_success() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

log_error() {
    echo -e "${RED}  ✗ $1${NC}"
}

log_info() {
    echo -e "  $1"
}

# =============================================================================
# Parse Arguments
# =============================================================================

SKIP_BUILD=false
TEST_ONLY=false
SKIP_TESTS=false

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --skip-build) SKIP_BUILD=true ;;
        --test-only) TEST_ONLY=true ;;
        --skip-tests) SKIP_TESTS=true ;;
        -h|--help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --skip-build    Skip rebuilding the core package"
            echo "  --test-only     Only run tests on existing test-app"
            echo "  --skip-tests    Create project but don't run tests"
            echo "  -h, --help      Show this help message"
            exit 0
            ;;
        *) echo "Unknown parameter: $1"; exit 1 ;;
    esac
    shift
done

# =============================================================================
# Main Script
# =============================================================================

echo ""
echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║           NextSpark Local Testing Script                      ║${NC}"
echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  Core Dir:     ${BLUE}$CORE_DIR${NC}"
echo -e "  Test App Dir: ${BLUE}$TEST_APP_DIR${NC}"
echo -e "  Skip Build:   $SKIP_BUILD"
echo -e "  Test Only:    $TEST_ONLY"

# -----------------------------------------------------------------------------
# Step 0: Test Only Mode
# -----------------------------------------------------------------------------

if [ "$TEST_ONLY" = true ]; then
    log_step "Running Tests Only"

    if [ ! -d "$TEST_APP_DIR" ]; then
        log_error "test-app does not exist. Run without --test-only first."
        exit 1
    fi

    cd "$TEST_APP_DIR"

    log_info "Running Jest tests..."
    pnpm test:theme || log_warning "Some Jest tests failed"

    log_success "Test run completed!"
    exit 0
fi

# -----------------------------------------------------------------------------
# Step 1: Build Core Package
# -----------------------------------------------------------------------------

if [ "$SKIP_BUILD" = false ]; then
    log_step "Step 1/7: Building Core Package"

    cd "$CORE_DIR"

    log_info "Running pnpm build..."
    pnpm build 2>&1 | tail -5
    log_success "Core package built"

    log_info "Building CLI..."
    cd bin
    npx tsup --config tsup.config.ts 2>&1 | tail -3
    cd ..
    log_success "CLI built"

    log_info "Creating tarball..."
    rm -f "$TARBALL_NAME"
    pnpm pack
    log_success "Tarball created: $TARBALL_NAME"
else
    log_step "Step 1/7: Skipping Build (--skip-build)"
    log_warning "Using existing tarball"
fi

# -----------------------------------------------------------------------------
# Step 2: Clean Previous Test App
# -----------------------------------------------------------------------------

log_step "Step 2/7: Cleaning Previous Test App"

if [ -d "$TEST_APP_DIR" ]; then
    log_info "Removing existing test-app..."
    rm -rf "$TEST_APP_DIR"
    log_success "Previous test-app removed"
else
    log_info "No existing test-app found"
fi

# Ensure project directory exists
mkdir -p "$PROJECT_DIR"

# -----------------------------------------------------------------------------
# Step 3: Create New Next.js Project
# -----------------------------------------------------------------------------

log_step "Step 3/7: Creating New Next.js Project"

cd "$PROJECT_DIR"

log_info "Running create-next-app..."
# Use echo to automatically answer "No" to the React Compiler prompt
echo "n" | pnpm create next-app@latest test-app \
    --typescript \
    --tailwind \
    --eslint \
    --app \
    --no-src-dir \
    --import-alias "@/*" \
    --use-pnpm \
    2>&1 | grep -E "(Success|Created|Installing)" || true

if [ ! -d "$TEST_APP_DIR" ]; then
    log_error "Failed to create Next.js project. Directory does not exist."
    exit 1
fi

log_success "Next.js project created"

# -----------------------------------------------------------------------------
# Step 4: Install NextSpark from Tarball
# -----------------------------------------------------------------------------

log_step "Step 4/7: Installing NextSpark from Tarball"

cd "$TEST_APP_DIR"

TARBALL_PATH="$CORE_DIR/$TARBALL_NAME"

if [ ! -f "$TARBALL_PATH" ]; then
    log_error "Tarball not found: $TARBALL_PATH"
    exit 1
fi

log_info "Installing $TARBALL_NAME..."
pnpm add "$TARBALL_PATH" 2>&1 | tail -5
log_success "NextSpark installed"

# -----------------------------------------------------------------------------
# Step 5: Run nextspark init
# -----------------------------------------------------------------------------

log_step "Step 5/7: Running nextspark init"

log_info "Initializing NextSpark..."
npx nextspark init 2>&1 | grep -E "(✅|Created|Added|Copied|Updated)" || true
log_success "NextSpark initialized"

# Reinstall to apply hoisting
log_info "Reinstalling dependencies with hoisting..."
rm -rf node_modules
pnpm install 2>&1 | tail -3
log_success "Dependencies reinstalled"

# -----------------------------------------------------------------------------
# Step 6: Setup Environment
# -----------------------------------------------------------------------------

log_step "Step 6/7: Setting Up Environment"

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://postgres:postgres@localhost:54322/postgres

# Auth
BETTER_AUTH_SECRET=test-secret-key-for-local-development-only
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Theme
NEXT_PUBLIC_ACTIVE_THEME=default

# Email (optional)
RESEND_API_KEY=
RESEND_FROM_EMAIL=

# Stripe (optional)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EOF

log_success ".env file created"

# Generate registries
log_info "Generating registries..."
pnpm build:registries 2>&1 | tail -3
log_success "Registries generated"

# -----------------------------------------------------------------------------
# Step 7: Run Tests
# -----------------------------------------------------------------------------

# Note: Test dependencies (Jest, Cypress) are now automatically added by nextspark init
# and installed during the pnpm install step in Step 5

if [ "$SKIP_TESTS" = false ]; then
    log_step "Step 7/7: Running Tests"

    log_info "Running Jest tests..."
    pnpm test:theme 2>&1 | tail -20 || log_warning "Some tests failed (this may be expected)"
else
    log_step "Step 7/7: Skipping Tests"
    log_warning "Skipping tests (--skip-tests)"
fi

# -----------------------------------------------------------------------------
# Done!
# -----------------------------------------------------------------------------

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                    Setup Complete!                            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "  ${CYAN}Test app location:${NC} $TEST_APP_DIR"
echo ""
echo -e "  ${CYAN}Available commands:${NC}"
echo -e "    cd $TEST_APP_DIR"
echo -e "    pnpm dev              # Start dev server"
echo -e "    pnpm test:theme       # Run Jest tests"
echo -e "    pnpm cy:open          # Open Cypress"
echo ""
echo -e "  ${CYAN}To run migrations (requires database):${NC}"
echo -e "    pnpm db:migrate"
echo ""
