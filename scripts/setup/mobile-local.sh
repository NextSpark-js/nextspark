#!/bin/bash

# =============================================================================
# Mobile Package Local Test Setup Script
# =============================================================================
# Creates a test Expo project using the LOCAL @nextsparkjs/mobile .tgz package
# for testing before npm publish.
#
# IMPORTANT: This script creates an isolated Expo project with the mobile
# package installed from a local .tgz file, NOT from npm.
#
# Prerequisites:
#   - Node.js >= 18
#   - pnpm installed globally
#
# Usage:
#   ./mobile-local.sh [OPTIONS]
#
# Options:
#   --skip-build        Skip building the mobile package (use existing dist/)
#   --skip-create       Skip creating new project (update existing)
#   --target <path>     Custom target directory (default: ../projects/test-mobile-package)
#   --help              Show this help message
#
# Examples:
#   ./mobile-local.sh                          # Full setup from scratch
#   ./mobile-local.sh --skip-build             # Repack without rebuild
#   ./mobile-local.sh --skip-create            # Update existing project
#   ./mobile-local.sh --target ../my-test-app  # Custom location
#
# Testing the result:
#   cd <target-dir>
#   npx expo start                    # Start Metro bundler
#   npx expo export --platform web    # Verify bundling works
#
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
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MOBILE_PKG_DIR="$REPO_ROOT/packages/mobile"
UI_PKG_DIR="$REPO_ROOT/packages/ui"
PROJECTS_DIR="$(dirname "$REPO_ROOT")/projects"
PROJECT_NAME="test-mobile-package"
TARGET_DIR="$PROJECTS_DIR/$PROJECT_NAME"

# -----------------------------------------------------------------------------
# Default options
# -----------------------------------------------------------------------------
SKIP_BUILD=false
SKIP_CREATE=false

# -----------------------------------------------------------------------------
# Helper functions
# -----------------------------------------------------------------------------
print_header() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  NextSpark Mobile - Local Package Test${NC}"
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
  head -n 35 "$0" | tail -n 33 | sed 's/^# //' | sed 's/^#//'
  exit 0
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --skip-build)
      SKIP_BUILD=true
      shift
      ;;
    --skip-create)
      SKIP_CREATE=true
      shift
      ;;
    --target)
      TARGET_DIR="$2"
      shift 2
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

echo "Configuration:"
echo "  Repo root:       $REPO_ROOT"
echo "  Mobile package:  $MOBILE_PKG_DIR"
echo "  UI package:      $UI_PKG_DIR"
echo "  Target dir:      $TARGET_DIR"
echo "  Skip build:      $SKIP_BUILD"
echo "  Skip create:     $SKIP_CREATE"
echo ""

# Step 1: Verify packages exist
print_step "1" "Verifying packages..."
if [ ! -f "$MOBILE_PKG_DIR/package.json" ]; then
  print_error "Mobile package not found at $MOBILE_PKG_DIR"
  exit 1
fi
MOBILE_VERSION=$(node -p "require('$MOBILE_PKG_DIR/package.json').version")
print_success "Found @nextsparkjs/mobile v$MOBILE_VERSION"

if [ ! -f "$UI_PKG_DIR/package.json" ]; then
  print_error "UI package not found at $UI_PKG_DIR"
  exit 1
fi
UI_VERSION=$(node -p "require('$UI_PKG_DIR/package.json').version")
print_success "Found @nextsparkjs/ui v$UI_VERSION"

# Step 2: Build packages (unless skipped)
print_step "2" "Building packages..."
if [ "$SKIP_BUILD" = true ]; then
  print_warning "Skipping build (--skip-build)"
  if [ ! -d "$MOBILE_PKG_DIR/dist" ]; then
    print_error "No mobile dist/ folder found. Run without --skip-build first."
    exit 1
  fi
  if [ ! -d "$UI_PKG_DIR/dist" ]; then
    print_error "No ui dist/ folder found. Run without --skip-build first."
    exit 1
  fi
else
  cd "$MOBILE_PKG_DIR"
  pnpm build
  print_success "Mobile package built"

  cd "$UI_PKG_DIR"
  pnpm build
  print_success "UI package built"
fi

# Step 3: Create .tgz packages
print_step "3" "Creating .tgz packages..."

cd "$MOBILE_PKG_DIR"
rm -f *.tgz
npm pack
MOBILE_TGZ=$(ls -1 *.tgz 2>/dev/null | head -1)
if [ -z "$MOBILE_TGZ" ]; then
  print_error "Failed to create mobile .tgz package"
  exit 1
fi
print_success "Created $MOBILE_TGZ"

cd "$UI_PKG_DIR"
rm -f *.tgz
npm pack
UI_TGZ=$(ls -1 *.tgz 2>/dev/null | head -1)
if [ -z "$UI_TGZ" ]; then
  print_error "Failed to create ui .tgz package"
  exit 1
fi
print_success "Created $UI_TGZ"

# Step 4: Prepare target directory
print_step "4" "Preparing target directory..."
if [ "$SKIP_CREATE" = true ]; then
  if [ ! -d "$TARGET_DIR" ]; then
    print_error "Target directory does not exist: $TARGET_DIR"
    print_error "Run without --skip-create to create it first"
    exit 1
  fi
  print_warning "Using existing project at $TARGET_DIR"
else
  # Remove existing project if it exists
  if [ -d "$TARGET_DIR" ]; then
    rm -rf "$TARGET_DIR"
    print_success "Removed existing project"
  fi

  # Create directory
  mkdir -p "$TARGET_DIR"
  print_success "Created $TARGET_DIR"
fi

# Step 5: Copy templates from mobile package
print_step "5" "Copying templates..."
TEMPLATES_DIR="$MOBILE_PKG_DIR/templates"

# Copy all template files
cp -r "$TEMPLATES_DIR/app" "$TARGET_DIR/"
cp -r "$TEMPLATES_DIR/src" "$TARGET_DIR/"
cp "$TEMPLATES_DIR/app.config.ts" "$TARGET_DIR/"
cp "$TEMPLATES_DIR/babel.config.js" "$TARGET_DIR/"
cp "$TEMPLATES_DIR/metro.config.js" "$TARGET_DIR/"
cp "$TEMPLATES_DIR/tailwind.config.js" "$TARGET_DIR/"
cp "$TEMPLATES_DIR/tsconfig.json" "$TARGET_DIR/"
print_success "Copied all templates"

# Step 6: Copy .tgz files and create package.json
print_step "6" "Setting up package.json with local .tgz files..."
cp "$MOBILE_PKG_DIR/$MOBILE_TGZ" "$TARGET_DIR/"
cp "$UI_PKG_DIR/$UI_TGZ" "$TARGET_DIR/"

# Create package.json from template, replacing @nextsparkjs packages with local .tgz
cd "$TARGET_DIR"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('$TEMPLATES_DIR/package.json.template', 'utf8'));

// Update package name
pkg.name = 'test-mobile-package';

// Replace @nextsparkjs/mobile with local .tgz
pkg.dependencies['@nextsparkjs/mobile'] = 'file:./$MOBILE_TGZ';

// Replace @nextsparkjs/ui with local .tgz
pkg.dependencies['@nextsparkjs/ui'] = 'file:./$UI_TGZ';

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('package.json created with local .tgz references');
"
print_success "package.json configured"

# Step 7: Install dependencies
print_step "7" "Installing dependencies..."
# Remove package-lock.json to force fresh install of local .tgz packages
rm -f package-lock.json
npm install
print_success "Dependencies installed"

# Step 8: Verify installation
print_step "8" "Verifying installation..."
if [ -d "$TARGET_DIR/node_modules/@nextsparkjs/mobile" ]; then
  print_success "@nextsparkjs/mobile found in node_modules"
else
  print_error "@nextsparkjs/mobile not found in node_modules"
  exit 1
fi

if [ -f "$TARGET_DIR/node_modules/@nextsparkjs/mobile/dist/index.js" ]; then
  print_success "@nextsparkjs/mobile entry point exists"
else
  print_error "@nextsparkjs/mobile entry point missing"
  exit 1
fi

if [ -d "$TARGET_DIR/node_modules/@nextsparkjs/ui" ]; then
  print_success "@nextsparkjs/ui found in node_modules"
else
  print_error "@nextsparkjs/ui not found in node_modules"
  exit 1
fi

if [ -f "$TARGET_DIR/node_modules/@nextsparkjs/ui/dist/index.js" ]; then
  print_success "@nextsparkjs/ui entry point exists"
else
  print_error "@nextsparkjs/ui entry point missing"
  exit 1
fi

# Step 9: Verify Metro bundling works
print_step "9" "Verifying Metro bundling..."
cd "$TARGET_DIR"
if npx expo export --platform web > /dev/null 2>&1; then
  print_success "Metro bundling verified"
  rm -rf dist
else
  print_error "Metro bundling failed. Run 'npx expo export --platform web' to see errors."
  exit 1
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Setup Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo "Test project: $TARGET_DIR"
echo "Packages:"
echo "  @nextsparkjs/mobile v$MOBILE_VERSION (LOCAL .tgz)"
echo "  @nextsparkjs/ui v$UI_VERSION (LOCAL .tgz)"
echo ""
echo -e "${CYAN}To test:${NC}"
echo "  cd $TARGET_DIR"
echo "  npx expo start"
echo ""
echo -e "${YELLOW}To update after changes:${NC}"
echo "  pnpm setup:mobile-local -- --skip-create"
echo ""
