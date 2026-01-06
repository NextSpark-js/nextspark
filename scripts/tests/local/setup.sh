#!/bin/bash

# =============================================================================
# Local Package Test Setup Script
# =============================================================================
# Creates a test project using LOCAL .tgz packages for testing before npm publish.
#
# IMPORTANT: This script uses LOCAL packages exclusively, NOT npm packages.
# The CLI, core, themes, and plugins are all installed from local .tgz files.
#
# Usage:
#   ./setup.sh [OPTIONS]
#
# Options:
#   --skip-repackage    Skip running repackage.sh (use existing .tgz files)
#   --preset <name>     Preset to use (default: saas)
#   --theme <name>      Theme to use (default: default)
#   --clean             Remove existing test project before creating
#   --help              Show this help message
#
# Examples:
#   ./setup.sh                          # Full setup with defaults
#   ./setup.sh --skip-repackage         # Use existing packages
#   ./setup.sh --preset blog --clean    # Clean install with blog preset
# =============================================================================

set -e

# -----------------------------------------------------------------------------
# Color definitions
# -----------------------------------------------------------------------------
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# -----------------------------------------------------------------------------
# Path definitions
# -----------------------------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"
PROJECTS_DIR="$(dirname "$REPO_ROOT")/projects"
PROJECT_NAME="test-local-packages"
PROJECT_PATH="$PROJECTS_DIR/$PROJECT_NAME"

# -----------------------------------------------------------------------------
# Default values
# -----------------------------------------------------------------------------
SKIP_REPACKAGE=false
PRESET="saas"
THEME="default"
CLEAN=false

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------
print_header() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  NextSpark - Local Package Test Setup${NC}"
  echo -e "${CYAN}========================================${NC}"
  echo ""
}

print_step() {
  echo -e "${BLUE}[$1]${NC} $2"
}

print_success() {
  echo -e "${GREEN}    [OK]${NC} $1"
}

print_warning() {
  echo -e "${YELLOW}    [WARN]${NC} $1"
}

print_error() {
  echo -e "${RED}    [ERROR]${NC} $1"
}

show_help() {
  head -n 25 "$0" | tail -n 23 | sed 's/^# //' | sed 's/^#//'
  exit 0
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-repackage)
      SKIP_REPACKAGE=true
      shift
      ;;
    --preset)
      PRESET="$2"
      shift 2
      ;;
    --theme)
      THEME="$2"
      shift 2
      ;;
    --clean)
      CLEAN=true
      shift
      ;;
    --help|-h)
      show_help
      ;;
    *)
      print_error "Unknown option: $1"
      echo "Use --help to see available options"
      exit 1
      ;;
  esac
done

# -----------------------------------------------------------------------------
# Main script
# -----------------------------------------------------------------------------
print_header

# Determine packages path (repackage.sh puts files in test-distribution by default)
PACKAGES_PATH="$(dirname "$REPO_ROOT")/test-distribution"

echo "Configuration:"
echo "  Repo root:      $REPO_ROOT"
echo "  Projects dir:   $PROJECTS_DIR"
echo "  Project path:   $PROJECT_PATH"
echo "  Packages path:  $PACKAGES_PATH"
echo "  Preset:         $PRESET"
echo "  Theme:          $THEME"
echo "  Skip repackage: $SKIP_REPACKAGE"
echo "  Clean install:  $CLEAN"
echo ""

# Step 1: Clean existing project if requested
if [ "$CLEAN" = true ] && [ -d "$PROJECT_PATH" ]; then
  print_step "1" "Cleaning existing test project..."
  rm -rf "$PROJECT_PATH"
  print_success "Removed $PROJECT_PATH"
else
  print_step "1" "Clean step skipped (no --clean flag or project doesn't exist)"
fi

# Step 2: Run repackage.sh unless skipped
if [ "$SKIP_REPACKAGE" = false ]; then
  print_step "2" "Running repackage.sh --all..."

  if [ ! -f "$REPO_ROOT/scripts/utils/repackage.sh" ]; then
    print_error "repackage.sh not found at $REPO_ROOT/scripts/utils/repackage.sh"
    exit 1
  fi

  # Run repackage with output to test-distribution
  bash "$REPO_ROOT/scripts/utils/repackage.sh" --all --clean --output "$PACKAGES_PATH"
  print_success "Packages created in $PACKAGES_PATH"
else
  print_step "2" "Repackage step skipped (--skip-repackage flag)"
fi

# Step 3: Verify packages exist
print_step "3" "Verifying package files..."

if [ ! -d "$PACKAGES_PATH" ]; then
  print_error "Packages directory not found: $PACKAGES_PATH"
  print_error "Run without --skip-repackage or run: ./scripts/utils/repackage.sh --all --output $PACKAGES_PATH"
  exit 1
fi

CORE_TGZ=$(ls -1 "$PACKAGES_PATH"/nextsparkjs-core-*.tgz 2>/dev/null | head -1)
if [ -z "$CORE_TGZ" ]; then
  print_error "Core package .tgz not found in $PACKAGES_PATH"
  exit 1
fi
print_success "Found: $(basename "$CORE_TGZ")"

CLI_TGZ=$(ls -1 "$PACKAGES_PATH"/nextsparkjs-cli-*.tgz 2>/dev/null | head -1)
if [ -z "$CLI_TGZ" ]; then
  print_error "CLI package .tgz not found in $PACKAGES_PATH"
  exit 1
fi
print_success "Found: $(basename "$CLI_TGZ")"

# Count themes and plugins
THEME_COUNT=$(ls -1 "$PACKAGES_PATH"/nextsparkjs-theme-*.tgz 2>/dev/null | wc -l | tr -d ' ')
PLUGIN_COUNT=$(ls -1 "$PACKAGES_PATH"/nextsparkjs-plugin-*.tgz 2>/dev/null | wc -l | tr -d ' ')
print_success "Found: $THEME_COUNT themes, $PLUGIN_COUNT plugins"

# Step 4: Create project directory
print_step "4" "Creating project directory..."
if [ -d "$PROJECT_PATH" ]; then
  print_warning "Project already exists at $PROJECT_PATH"
  print_warning "Use --clean to remove it first, or manually delete it"
  exit 1
fi

mkdir -p "$PROJECT_PATH"
print_success "Created $PROJECT_PATH"

# Step 5: Copy .tgz packages to project FIRST (before any npm install)
print_step "5" "Copying local packages to project..."
mkdir -p "$PROJECT_PATH/.packages"
cp "$PACKAGES_PATH"/*.tgz "$PROJECT_PATH/.packages/"
print_success "Copied all .tgz files to $PROJECT_PATH/.packages/"

# Step 6: Create initial package.json with LOCAL package references
print_step "6" "Creating package.json with local package references..."
cd "$PROJECT_PATH"

# Determine theme package name
THEME_PKG_NAME="@nextsparkjs/theme-$THEME"
THEME_TGZ=$(ls -1 .packages/nextsparkjs-theme-${THEME}-*.tgz 2>/dev/null | head -1)

if [ -z "$THEME_TGZ" ]; then
  print_warning "Theme '$THEME' not found in local packages, using 'default'"
  THEME="default"
  THEME_PKG_NAME="@nextsparkjs/theme-default"
  THEME_TGZ=$(ls -1 .packages/nextsparkjs-theme-default-*.tgz 2>/dev/null | head -1)
fi

# Create package.json using node to handle all local packages
node -e "
const fs = require('fs');
const path = require('path');

// Get all .tgz files
const packagesDir = './.packages';
const tgzFiles = fs.readdirSync(packagesDir).filter(f => f.endsWith('.tgz'));

// Map package names to local file references
const packageMap = {};
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
    packageMap[pkgName] = 'file:' + packagesDir + '/' + tgz;
  }
});

// Create package.json
const pkg = {
  name: '$PROJECT_NAME',
  version: '0.1.0',
  private: true,
  scripts: {
    dev: 'next dev',
    build: 'nextspark build',
    start: 'next start',
    lint: 'next lint',
    test: 'echo \"No tests configured\"'
  },
  dependencies: {
    '@nextsparkjs/core': packageMap['@nextsparkjs/core'],
    '@nextsparkjs/cli': packageMap['@nextsparkjs/cli'],
    '$THEME_PKG_NAME': packageMap['$THEME_PKG_NAME'] || packageMap['@nextsparkjs/theme-default'],
    'next': '^15.1.0',
    'react': '^19.0.0',
    'react-dom': '^19.0.0'
  },
  devDependencies: {
    'typescript': '^5.6.3',
    '@types/node': '^22.9.0',
    '@types/react': '^19.0.0'
  }
};

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\\n');
console.log('Created package.json with local packages:');
console.log('  - @nextsparkjs/core: file:./.packages/...');
console.log('  - @nextsparkjs/cli: file:./.packages/...');
console.log('  - $THEME_PKG_NAME: file:./.packages/...');
"
print_success "package.json created with local package references"

# Step 7: Install dependencies (now uses LOCAL packages)
print_step "7" "Installing dependencies with pnpm (using LOCAL packages)..."
pnpm install
print_success "Dependencies installed from local .tgz files"

# Step 8: Run the wizard using LOCAL CLI
print_step "8" "Running NextSpark wizard (using LOCAL CLI)..."
echo ""

# The CLI is now installed from local .tgz, so it has all our new flags
npx nextspark init \
  --preset "$PRESET" \
  --name "Test Local Packages" \
  --slug "test-local" \
  --description "Testing with local .tgz packages before npm publish" \
  --theme "$THEME" \
  --yes

print_success "Wizard completed successfully"

# Step 9: Create .env file with required variables
print_step "9" "Creating .env file..."
# Use the project slug from wizard (test-local) as the theme name
cat > .env << EOF
# Environment variables for local package testing
# ==============================================

# Database (SQLite for local testing)
DATABASE_URL="file:./data.db"

# Authentication
BETTER_AUTH_SECRET="test-secret-for-local-development-only-32chars"

# Theme configuration
NEXT_PUBLIC_ACTIVE_THEME=test-local

# App URLs
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Email provider (using console provider for local testing)
EMAIL_PROVIDER=console

# Disable email verification for testing
SKIP_EMAIL_VERIFICATION=true

# Node environment for build
NODE_ENV=development
EOF
print_success ".env file created with NEXT_PUBLIC_ACTIVE_THEME=test-local"

# Step 10: Re-install to pick up any new dependencies from wizard
print_step "10" "Re-installing dependencies after wizard..."
pnpm install --force
print_success "Dependencies updated"

# Step 11: Build the project
print_step "11" "Building the project..."
pnpm build
print_success "Project built successfully"

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Test project created at: $PROJECT_PATH"
echo ""
echo -e "${CYAN}All packages are LOCAL .tgz files:${NC}"
echo "  - @nextsparkjs/core (local)"
echo "  - @nextsparkjs/cli (local)"
echo "  - $THEME_PKG_NAME (local)"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_PATH"
echo "  pnpm dev              # Start development server"
echo "  pnpm test             # Run tests"
echo ""
echo "Or run the test script:"
echo "  ./scripts/tests/local/run.sh --all"
echo ""
