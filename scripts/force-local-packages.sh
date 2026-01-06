#!/bin/bash

# Force Local Packages Script
# Modifies package.json in test-distribution to use local .tgz packages

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TEST_DIST="$(dirname "$REPO_ROOT")/test-distribution"

echo "========================================"
echo "  NextSpark - Force Local Packages"
echo "========================================"
echo ""

# Check if test-distribution exists
if [ ! -d "$TEST_DIST" ]; then
  echo "ERROR: test-distribution folder not found at $TEST_DIST"
  exit 1
fi

# Check if package.json exists (wizard was run)
if [ ! -f "$TEST_DIST/package.json" ]; then
  echo "ERROR: package.json not found in test-distribution"
  echo "Did you run the wizard first?"
  exit 1
fi

cd "$TEST_DIST"

# Find the .tgz files
CORE_TGZ=$(ls -1 nextsparkjs-core-*.tgz 2>/dev/null | head -1)
CLI_TGZ=$(ls -1 nextsparkjs-cli-*.tgz 2>/dev/null | head -1)

if [ -z "$CORE_TGZ" ]; then
  echo "ERROR: Core package .tgz not found"
  exit 1
fi

echo "Found packages:"
echo "  Core: $CORE_TGZ"
echo "  CLI:  $CLI_TGZ"
echo ""

# Update package.json to use local packages
echo "Updating package.json..."

# Use node to update package.json
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));

// Update dependencies
if (pkg.dependencies) {
  if (pkg.dependencies['@nextsparkjs/core']) {
    pkg.dependencies['@nextsparkjs/core'] = 'file:./$CORE_TGZ';
  }
  if (pkg.dependencies['@nextsparkjs/cli']) {
    pkg.dependencies['@nextsparkjs/cli'] = 'file:./$CLI_TGZ';
  }
}

// Update devDependencies
if (pkg.devDependencies) {
  if (pkg.devDependencies['@nextsparkjs/core']) {
    pkg.devDependencies['@nextsparkjs/core'] = 'file:./$CORE_TGZ';
  }
  if (pkg.devDependencies['@nextsparkjs/cli']) {
    pkg.devDependencies['@nextsparkjs/cli'] = 'file:./$CLI_TGZ';
  }
}

fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
console.log('   ✓ package.json updated');
"

# Also update any theme/plugin references if they exist
for tgz in nextsparkjs-theme-*.tgz nextsparkjs-plugin-*.tgz; do
  if [ -f "$tgz" ]; then
    # Extract package name from tgz filename
    # e.g., nextsparkjs-theme-blog-0.1.0.tgz -> @nextsparkjs/theme-blog
    pkg_base=$(echo "$tgz" | sed 's/-[0-9].*\.tgz$//' | sed 's/^nextsparkjs-/@nextsparkjs\//')

    node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
const pkgName = '$pkg_base';
const tgzFile = '$tgz';

if (pkg.dependencies && pkg.dependencies[pkgName]) {
  pkg.dependencies[pkgName] = 'file:./' + tgzFile;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('   ✓ Updated ' + pkgName + ' -> file:./' + tgzFile);
}
if (pkg.devDependencies && pkg.devDependencies[pkgName]) {
  pkg.devDependencies[pkgName] = 'file:./' + tgzFile;
  fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
  console.log('   ✓ Updated ' + pkgName + ' -> file:./' + tgzFile);
}
" 2>/dev/null || true
  fi
done

echo ""
echo "========================================"
echo "  Local Packages Configured!"
echo "========================================"
echo ""
echo "Now run:"
echo "  cd $TEST_DIST"
echo "  pnpm install"
echo "  pnpm build"
