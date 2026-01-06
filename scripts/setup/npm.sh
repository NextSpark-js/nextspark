#!/bin/bash

# =============================================================================
# NPM Package Test Setup Script
# =============================================================================
# Creates a test project using packages from npm registry.
#
# Usage:
#   ./setup.sh [OPTIONS]
#
# Options:
#   --version <ver>     Package version to use (default: latest)
#   --preset <name>     Preset to use (default: saas)
#   --theme <name>      Theme to use (default: default)
#   --clean             Remove existing test project before creating
#   --help              Show this help message
#
# Examples:
#   ./setup.sh                          # Setup with latest version
#   ./setup.sh --version 1.0.0          # Use specific version
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
REPO_ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
PROJECTS_DIR="$(dirname "$REPO_ROOT")/projects"
PROJECT_NAME="test-npm-packages"
PROJECT_PATH="$PROJECTS_DIR/$PROJECT_NAME"

# -----------------------------------------------------------------------------
# Default values
# -----------------------------------------------------------------------------
VERSION="latest"
PRESET="saas"
THEME="default"
CLEAN=false

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------
print_header() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  NextSpark - NPM Package Test Setup${NC}"
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
  head -n 21 "$0" | tail -n 19 | sed 's/^# //' | sed 's/^#//'
  exit 0
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --version)
      VERSION="$2"
      shift 2
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

echo "Configuration:"
echo "  Repo root:     $REPO_ROOT"
echo "  Projects dir:  $PROJECTS_DIR"
echo "  Project path:  $PROJECT_PATH"
echo "  Version:       $VERSION"
echo "  Preset:        $PRESET"
echo "  Theme:         $THEME"
echo "  Clean install: $CLEAN"
echo ""

# Step 1: Clean existing project if requested
if [ "$CLEAN" = true ] && [ -d "$PROJECT_PATH" ]; then
  print_step "1" "Cleaning existing test project..."
  rm -rf "$PROJECT_PATH"
  print_success "Removed $PROJECT_PATH"
else
  print_step "1" "Clean step skipped (no --clean flag or project doesn't exist)"
fi

# Step 2: Create projects directory if needed
print_step "2" "Ensuring projects directory exists..."
if [ ! -d "$PROJECTS_DIR" ]; then
  mkdir -p "$PROJECTS_DIR"
  print_success "Created $PROJECTS_DIR"
else
  print_success "Projects directory exists"
fi

# Step 3: Check if project already exists
if [ -d "$PROJECT_PATH" ]; then
  print_warning "Project already exists at $PROJECT_PATH"
  print_warning "Use --clean to remove it first, or manually delete it"
  exit 1
fi

# Step 4: Check npm package availability
print_step "3" "Checking npm package availability..."
if ! npm view "create-nextspark-app@$VERSION" version >/dev/null 2>&1; then
  print_error "Package create-nextspark-app@$VERSION not found on npm"
  echo ""
  echo "Available versions:"
  npm view create-nextspark-app versions 2>/dev/null || echo "  Package not published yet"
  exit 1
fi

ACTUAL_VERSION=$(npm view "create-nextspark-app@$VERSION" version 2>/dev/null)
print_success "Found create-nextspark-app@$ACTUAL_VERSION on npm"

# Step 5: Create project with create-nextspark-app from npm
print_step "4" "Creating project with create-nextspark-app@$VERSION..."
cd "$PROJECTS_DIR"

npx "create-nextspark-app@$VERSION" "$PROJECT_NAME" \
  --preset "$PRESET" \
  --name "Test NPM Packages" \
  --slug "test-npm" \
  --description "Testing with npm packages" \
  --theme "$THEME" \
  --yes

if [ ! -d "$PROJECT_PATH" ]; then
  print_error "Project was not created at $PROJECT_PATH"
  exit 1
fi
print_success "Project created at $PROJECT_PATH"

# Step 6: Install dependencies
print_step "5" "Installing dependencies with pnpm..."
cd "$PROJECT_PATH"
pnpm install
print_success "Dependencies installed"

# Step 7: Build the project
print_step "6" "Building the project..."
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
echo "Using create-nextspark-app@$ACTUAL_VERSION from npm"
echo ""
echo "Next steps:"
echo "  cd $PROJECT_PATH"
echo "  pnpm dev              # Start development server"
echo "  pnpm build            # Build for production"
echo ""
