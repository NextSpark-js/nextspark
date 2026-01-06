#!/bin/bash

# =============================================================================
# Local Package Test Runner Script
# =============================================================================
# Runs tests in the local test project created by setup.sh.
#
# Usage:
#   ./run.sh [OPTIONS]
#
# Options:
#   --unit      Run unit tests only
#   --e2e       Run E2E tests only
#   --all       Run all tests (unit + e2e)
#   --build     Run build before tests
#   --help      Show this help message
#
# Examples:
#   ./run.sh --all              # Run all tests
#   ./run.sh --unit             # Run unit tests only
#   ./run.sh --build --e2e      # Build first, then run E2E tests
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
PROJECT_NAME="test-local-packages"
PROJECT_PATH="$PROJECTS_DIR/$PROJECT_NAME"

# -----------------------------------------------------------------------------
# Default values
# -----------------------------------------------------------------------------
RUN_UNIT=false
RUN_E2E=false
RUN_BUILD=false

# -----------------------------------------------------------------------------
# Functions
# -----------------------------------------------------------------------------
print_header() {
  echo ""
  echo -e "${CYAN}========================================${NC}"
  echo -e "${CYAN}  NextSpark - Local Package Test Runner${NC}"
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
  head -n 20 "$0" | tail -n 18 | sed 's/^# //' | sed 's/^#//'
  exit 0
}

# -----------------------------------------------------------------------------
# Parse arguments
# -----------------------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case $1 in
    --unit)
      RUN_UNIT=true
      shift
      ;;
    --e2e)
      RUN_E2E=true
      shift
      ;;
    --all)
      RUN_UNIT=true
      RUN_E2E=true
      shift
      ;;
    --build)
      RUN_BUILD=true
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

# If no test type specified, show help
if [ "$RUN_UNIT" = false ] && [ "$RUN_E2E" = false ] && [ "$RUN_BUILD" = false ]; then
  print_error "No test type specified"
  echo "Use --unit, --e2e, --all, or --build"
  echo "Use --help for more information"
  exit 1
fi

# -----------------------------------------------------------------------------
# Main script
# -----------------------------------------------------------------------------
print_header

echo "Configuration:"
echo "  Project path: $PROJECT_PATH"
echo "  Run build:    $RUN_BUILD"
echo "  Run unit:     $RUN_UNIT"
echo "  Run E2E:      $RUN_E2E"
echo ""

# Verify project exists
print_step "1" "Verifying test project exists..."
if [ ! -d "$PROJECT_PATH" ]; then
  print_error "Test project not found at $PROJECT_PATH"
  echo ""
  echo "Please run the setup script first:"
  echo "  ./scripts/tests/local/setup.sh"
  exit 1
fi

if [ ! -f "$PROJECT_PATH/package.json" ]; then
  print_error "package.json not found in $PROJECT_PATH"
  exit 1
fi

print_success "Project found at $PROJECT_PATH"

# Change to project directory
cd "$PROJECT_PATH"

# Track test results
TESTS_PASSED=0
TESTS_FAILED=0

# Run build if requested
if [ "$RUN_BUILD" = true ]; then
  print_step "2" "Building project..."
  if pnpm build; then
    print_success "Build completed"
    ((TESTS_PASSED++))
  else
    print_error "Build failed"
    ((TESTS_FAILED++))
  fi
fi

# Run unit tests if requested
if [ "$RUN_UNIT" = true ]; then
  print_step "3" "Running unit tests..."

  # Check if test script exists
  if grep -q '"test"' package.json || grep -q '"test:unit"' package.json; then
    if pnpm test:unit 2>/dev/null || pnpm test 2>/dev/null; then
      print_success "Unit tests passed"
      ((TESTS_PASSED++))
    else
      print_error "Unit tests failed"
      ((TESTS_FAILED++))
    fi
  else
    print_warning "No unit test script found in package.json"
  fi
fi

# Run E2E tests if requested
if [ "$RUN_E2E" = true ]; then
  print_step "4" "Running E2E tests..."

  # Check if e2e script exists
  if grep -q '"test:e2e"' package.json || grep -q '"e2e"' package.json; then
    if pnpm test:e2e 2>/dev/null || pnpm e2e 2>/dev/null; then
      print_success "E2E tests passed"
      ((TESTS_PASSED++))
    else
      print_error "E2E tests failed"
      ((TESTS_FAILED++))
    fi
  else
    print_warning "No E2E test script found in package.json"
  fi
fi

# -----------------------------------------------------------------------------
# Summary
# -----------------------------------------------------------------------------
echo ""
echo -e "${CYAN}========================================${NC}"
echo -e "${CYAN}  Test Results${NC}"
echo -e "${CYAN}========================================${NC}"
echo ""

if [ "$TESTS_FAILED" -eq 0 ] && [ "$TESTS_PASSED" -gt 0 ]; then
  echo -e "${GREEN}All tests passed!${NC}"
  echo "  Passed: $TESTS_PASSED"
  echo "  Failed: $TESTS_FAILED"
  exit 0
elif [ "$TESTS_FAILED" -gt 0 ]; then
  echo -e "${RED}Some tests failed!${NC}"
  echo "  Passed: $TESTS_PASSED"
  echo "  Failed: $TESTS_FAILED"
  exit 1
else
  echo -e "${YELLOW}No tests were run${NC}"
  exit 0
fi
