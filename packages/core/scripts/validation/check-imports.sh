#!/bin/bash
# ══════════════════════════════════════════════════════════════════════════════
# Layer-Aware Import Enforcement Script
# ══════════════════════════════════════════════════════════════════════════════
#
# Enforces the project's layer architecture rules:
#
# ┌─────────────────────────────────────────────────────────────────────────────┐
# │                           LAYER IMPORT RULES                                │
# ├─────────────────────────────────────────────────────────────────────────────┤
# │  FROM        │  TO                        │  ALLOWED?                       │
# │  ────────────┼────────────────────────────┼───────────────────────────────  │
# │  Core        │  Theme                     │  ❌ FORBIDDEN                   │
# │  Core        │  Plugin                    │  ❌ FORBIDDEN                   │
# │  Theme       │  Core                      │  ✅ ALLOWED                     │
# │  Theme       │  Same Theme                │  ✅ ALLOWED                     │
# │  Theme       │  Other Theme               │  ❌ FORBIDDEN                   │
# │  Theme       │  Plugin                    │  ✅ ALLOWED                     │
# │  Plugin      │  Core                      │  ✅ ALLOWED                     │
# │  Plugin      │  Same Plugin               │  ✅ ALLOWED                     │
# │  Plugin      │  Other Plugin              │  ❌ FORBIDDEN                   │
# │  Plugin      │  Theme                     │  ❌ FORBIDDEN                   │
# └─────────────────────────────────────────────────────────────────────────────┘
#
# See .rules/dynamic-imports.md for policy details
# ══════════════════════════════════════════════════════════════════════════════

set -e

echo "🔍 Checking layer import violations..."
echo ""

FOUND_VIOLATIONS=0

# ══════════════════════════════════════════════════════════════════════════════
# RULE 1: Core NUNCA puede importar de themes o plugins
# ══════════════════════════════════════════════════════════════════════════════
echo "📋 Rule 1: Core → Theme/Plugin (FORBIDDEN)"

CORE_VIOLATIONS=$(grep -rn "from ['\"]@/contents" --include="*.ts" --include="*.tsx" \
  core/ 2>/dev/null | \
  grep -v "core/lib/registries/" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." || true)

if [ ! -z "$CORE_VIOLATIONS" ]; then
  echo "   ❌ VIOLATION: Core importing from contents/"
  echo "$CORE_VIOLATIONS" | sed 's/^/      /'
  echo ""
  FOUND_VIOLATIONS=1
else
  echo "   ✅ Passed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RULE 2: Theme no puede importar de OTRO theme
# ══════════════════════════════════════════════════════════════════════════════
echo "📋 Rule 2: Theme → Other Theme (FORBIDDEN)"

THEME_VIOLATIONS_FOUND=0

if [ -d "contents/themes" ]; then
  for theme_dir in contents/themes/*/; do
    [ -d "$theme_dir" ] || continue
    theme_name=$(basename "$theme_dir")

    # Buscar imports de otros themes dentro de este theme
    CROSS_THEME=$(grep -rn "from ['\"]@/contents/themes/" --include="*.ts" --include="*.tsx" \
      "$theme_dir" 2>/dev/null | \
      grep -v "from ['\"]@/contents/themes/${theme_name}" | \
      grep -v "\.test\." | \
      grep -v "\.spec\." || true)

    if [ ! -z "$CROSS_THEME" ]; then
      echo "   ❌ VIOLATION: Theme '$theme_name' importing from other themes"
      echo "$CROSS_THEME" | sed 's/^/      /'
      echo ""
      FOUND_VIOLATIONS=1
      THEME_VIOLATIONS_FOUND=1
    fi
  done
fi

if [ $THEME_VIOLATIONS_FOUND -eq 0 ]; then
  echo "   ✅ Passed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RULE 3: Plugin no puede importar de OTRO plugin
# ══════════════════════════════════════════════════════════════════════════════
echo "📋 Rule 3: Plugin → Other Plugin (FORBIDDEN)"

PLUGIN_VIOLATIONS_FOUND=0

if [ -d "contents/plugins" ]; then
  for plugin_dir in contents/plugins/*/; do
    [ -d "$plugin_dir" ] || continue
    plugin_name=$(basename "$plugin_dir")

    # Buscar imports de otros plugins dentro de este plugin
    CROSS_PLUGIN=$(grep -rn "from ['\"]@/contents/plugins/" --include="*.ts" --include="*.tsx" \
      "$plugin_dir" 2>/dev/null | \
      grep -v "from ['\"]@/contents/plugins/${plugin_name}" | \
      grep -v "\.test\." | \
      grep -v "\.spec\." || true)

    if [ ! -z "$CROSS_PLUGIN" ]; then
      echo "   ❌ VIOLATION: Plugin '$plugin_name' importing from other plugins"
      echo "$CROSS_PLUGIN" | sed 's/^/      /'
      echo ""
      FOUND_VIOLATIONS=1
      PLUGIN_VIOLATIONS_FOUND=1
    fi
  done
fi

if [ $PLUGIN_VIOLATIONS_FOUND -eq 0 ]; then
  echo "   ✅ Passed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RULE 4: Plugin NUNCA puede importar de themes
# Excepciones temporales:
#   - social-media-publisher (TODO: move platformRequiresImage to core)
# ══════════════════════════════════════════════════════════════════════════════
echo "📋 Rule 4: Plugin → Theme (FORBIDDEN)"

if [ -d "contents/plugins" ]; then
  PLUGIN_THEME=$(grep -rn "from ['\"]@/contents/themes" --include="*.ts" --include="*.tsx" \
    contents/plugins/ 2>/dev/null | \
    grep -v "\.test\." | \
    grep -v "\.spec\." | \
    grep -v "social-media-publisher" || true)

  if [ ! -z "$PLUGIN_THEME" ]; then
    echo "   ❌ VIOLATION: Plugins importing from themes"
    echo "$PLUGIN_THEME" | sed 's/^/      /'
    echo ""
    FOUND_VIOLATIONS=1
  else
    echo "   ✅ Passed"
  fi
else
  echo "   ✅ Passed (no plugins directory)"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RULE 5: app/ no puede importar directamente de contents/ (debe usar registries)
# Excepciones: (templates)/, api/v1/theme/, api/v1/plugin/
# ══════════════════════════════════════════════════════════════════════════════
echo "📋 Rule 5: App → Contents direct import (FORBIDDEN, use registries)"

APP_CONTENTS=$(grep -rn "from ['\"]@/contents" --include="*.ts" --include="*.tsx" \
  app/ 2>/dev/null | \
  grep -v "app/(templates)/" | \
  grep -v "app/api/v1/theme/" | \
  grep -v "app/api/v1/plugin/" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." || true)

if [ ! -z "$APP_CONTENTS" ]; then
  echo "   ❌ VIOLATION: App importing directly from contents/ (use registries)"
  echo "$APP_CONTENTS" | sed 's/^/      /'
  echo ""
  FOUND_VIOLATIONS=1
else
  echo "   ✅ Passed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RULE 6: Dynamic imports prohibidos (await import())
# Excepciones:
#   - lazy() - React lazy loading
#   - messages/ - i18n message loading
#   - scripts/ - Build scripts
#   - useLocale.ts - Locale resolution
#   - sonner - Toast library
#   - subscription.service.ts - Circular dependency workaround
#   - blocks/validate - Dynamic schema validation (server-side only)
# ══════════════════════════════════════════════════════════════════════════════
echo "📋 Rule 6: Dynamic imports - await import() (FORBIDDEN)"

DYNAMIC=$(grep -rn "await import(" --include="*.ts" --include="*.tsx" \
  core/ app/ contents/ 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".next" | \
  grep -v "lazy(" | \
  grep -v "messages/" | \
  grep -v "scripts/" | \
  grep -v "useLocale.ts" | \
  grep -v "sonner" | \
  grep -v "subscription.service.ts" | \
  grep -v "blocks/validate" | \
  grep -v "\.test\." | \
  grep -v "\.spec\." || true)

if [ ! -z "$DYNAMIC" ]; then
  echo "   ❌ VIOLATION: Dynamic imports found"
  echo "$DYNAMIC" | sed 's/^/      /'
  echo ""
  FOUND_VIOLATIONS=1
else
  echo "   ✅ Passed"
fi

# ══════════════════════════════════════════════════════════════════════════════
# RESULT
# ══════════════════════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════════════════════════"

if [ $FOUND_VIOLATIONS -eq 1 ]; then
  echo "❌ LAYER IMPORT VIOLATIONS FOUND"
  echo ""
  echo "Quick reference:"
  echo "  • Core → Theme/Plugin:     ❌ FORBIDDEN"
  echo "  • Theme → Other Theme:     ❌ FORBIDDEN"
  echo "  • Plugin → Other Plugin:   ❌ FORBIDDEN"
  echo "  • Plugin → Theme:          ❌ FORBIDDEN"
  echo "  • App → Contents (direct): ❌ FORBIDDEN (use registries)"
  echo "  • Dynamic imports:         ❌ FORBIDDEN"
  echo ""
  echo "  • Theme/Plugin → Core:     ✅ ALLOWED"
  echo "  • Theme → Same Theme:      ✅ ALLOWED"
  echo "  • Theme → Plugin:          ✅ ALLOWED"
  echo "  • Plugin → Same Plugin:    ✅ ALLOWED"
  echo ""
  echo "See .rules/dynamic-imports.md for details"
  echo "════════════════════════════════════════════════════════════════════════════"
  exit 1
fi

echo "✅ ALL LAYER IMPORT RULES PASSED"
echo "════════════════════════════════════════════════════════════════════════════"
exit 0
