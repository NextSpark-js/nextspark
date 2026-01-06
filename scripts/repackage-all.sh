#!/bin/bash

# Repackage All Script
# Cleans test-distribution, builds and packs all packages (core, cli, create-app, themes, plugins)

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIST="$(dirname "$REPO_ROOT")/test-distribution"

echo "========================================"
echo "  NextSpark - Repackage All"
echo "========================================"
echo ""

# Step 1: Clean test-distribution
echo "1. Cleaning test-distribution folder..."
rm -rf "$TEST_DIST"
mkdir -p "$TEST_DIST"
echo "   ✓ test-distribution cleaned and recreated"
echo ""

# Step 2: Build core
echo "2. Building @nextsparkjs/core..."
cd "$REPO_ROOT"
pnpm build:core
echo "   ✓ Core built"
echo ""

# Step 3: Build CLI
echo "3. Building @nextsparkjs/cli..."
pnpm build:cli
echo "   ✓ CLI built"
echo ""

# Step 4: Build create-nextspark-app
echo "4. Building create-nextspark-app..."
cd "$REPO_ROOT/packages/create-nextspark-app"
pnpm build 2>/dev/null || echo "   (no build script, skipping)"
echo "   ✓ create-nextspark-app ready"
echo ""

# Step 5: Pack core
echo "5. Packing @nextsparkjs/core..."
cd "$REPO_ROOT/packages/core"
CORE_TGZ=$(pnpm pack 2>&1 | tail -1)
mv "$CORE_TGZ" "$TEST_DIST/"
echo "   ✓ $CORE_TGZ"
echo ""

# Step 6: Pack CLI
echo "6. Packing @nextsparkjs/cli..."
cd "$REPO_ROOT/packages/cli"
CLI_TGZ=$(pnpm pack 2>&1 | tail -1)
mv "$CLI_TGZ" "$TEST_DIST/"
echo "   ✓ $CLI_TGZ"
echo ""

# Step 7: Pack create-nextspark-app
echo "7. Packing create-nextspark-app..."
cd "$REPO_ROOT/packages/create-nextspark-app"
CREATE_TGZ=$(pnpm pack 2>&1 | tail -1)
mv "$CREATE_TGZ" "$TEST_DIST/"
echo "   ✓ $CREATE_TGZ"
echo ""

# Step 8: Pack themes
echo "8. Packing themes..."
for theme in "$REPO_ROOT/themes"/*; do
  if [ -d "$theme" ] && [ -f "$theme/package.json" ]; then
    theme_name=$(basename "$theme")
    cd "$theme"
    THEME_TGZ=$(pnpm pack 2>&1 | tail -1)
    mv "$THEME_TGZ" "$TEST_DIST/"
    echo "   ✓ $theme_name: $THEME_TGZ"
  fi
done
echo ""

# Step 9: Pack plugins
echo "9. Packing plugins..."
for plugin in "$REPO_ROOT/plugins"/*; do
  if [ -d "$plugin" ] && [ -f "$plugin/package.json" ]; then
    plugin_name=$(basename "$plugin")
    cd "$plugin"
    PLUGIN_TGZ=$(pnpm pack 2>&1 | tail -1)
    mv "$PLUGIN_TGZ" "$TEST_DIST/"
    echo "   ✓ $plugin_name: $PLUGIN_TGZ"
  fi
done
echo ""

# Summary
echo "========================================"
echo "  Repackage Complete!"
echo "========================================"
echo ""
echo "All packages in: $TEST_DIST"
echo ""
ls -la "$TEST_DIST"/*.tgz 2>/dev/null || echo "No .tgz files found"
echo ""
echo "Next steps:"
echo "  1. cd $TEST_DIST"
echo "  2. Run the wizard: npx ./nextsparkjs-cli-*.tgz init"
echo "  3. After wizard: run force-local-packages.sh"
