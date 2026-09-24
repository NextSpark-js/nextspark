#!/bin/bash
# Root-first layer import enforcement. Run from the project root.
set -e

if [ ! -f nextspark.config.ts ]; then
  echo "❌ nextspark.config.ts not found; run this command from the project root"
  exit 1
fi

FOUND_VIOLATIONS=0

echo "🔍 Checking root-first layer import violations..."

# Local plugins may use core and themselves, but not another local plugin.
if [ -d plugins ]; then
  for plugin_dir in plugins/*/; do
    [ -d "$plugin_dir" ] || continue
    plugin_name=$(basename "$plugin_dir")
    CROSS_PLUGIN=$(grep -rn "from ['\"]@/plugins/" --include="*.ts" --include="*.tsx" "$plugin_dir" 2>/dev/null |
      grep -v "from ['\"]@/plugins/${plugin_name}" |
      grep -v "\.test\." | grep -v "\.spec\." || true)
    if [ -n "$CROSS_PLUGIN" ]; then
      echo "❌ Plugin '$plugin_name' imports another local plugin"
      echo "$CROSS_PLUGIN" | sed 's/^/   /'
      FOUND_VIOLATIONS=1
    fi
  done
fi

# The root-first cutover is strict: supported source must not reintroduce the legacy tree.
LEGACY_LAYOUT="contents/(""themes|plugins)"
ACTIVE_SELECTOR="NEXT_PUBLIC_ACTIVE""_THEME"
LEGACY=$(grep -rnE "${LEGACY_LAYOUT}|${ACTIVE_SELECTOR}" \
  --include="*.ts" --include="*.tsx" --include="*.js" --include="*.mjs" --include="*.cjs" \
  api blocks components config entities lib messages migrations plugins styles templates src 2>/dev/null |
  grep -v "\.test\." | grep -v "\.spec\." || true)
if [ -n "$LEGACY" ]; then
  echo "❌ Legacy theme/plugin layout references found"
  echo "$LEGACY" | sed 's/^/   /'
  FOUND_VIOLATIONS=1
fi

DYNAMIC=$(grep -rn "await import(" --include="*.ts" --include="*.tsx" \
  api blocks components config entities lib plugins templates src 2>/dev/null |
  grep -v node_modules | grep -v .next | grep -v "lazy(" | grep -v "messages/" |
  grep -v "useLocale.ts" | grep -v sonner | grep -v "subscription.service.ts" |
  grep -v "blocks/validate" | grep -v "\.test\." | grep -v "\.spec\." || true)
if [ -n "$DYNAMIC" ]; then
  echo "❌ Forbidden dynamic imports found"
  echo "$DYNAMIC" | sed 's/^/   /'
  FOUND_VIOLATIONS=1
fi

if [ "$FOUND_VIOLATIONS" -eq 1 ]; then exit 1; fi
echo "✅ ALL LAYER IMPORT RULES PASSED"
