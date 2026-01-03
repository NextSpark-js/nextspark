# Enforcement and Validation

## Introduction

The Registry System's ~17,255x performance improvement **depends entirely** on zero dynamic imports for content/config loading. This document explains the zero-tolerance enforcement policy, validation tools, and how to maintain compliance.

**Critical:** One dynamic import violation can reintroduce 140ms+ latency and defeat the entire registry architecture.

---

## Zero Tolerance Policy

### Policy Statement

**ZERO TOLERANCE for:**

1. ❌ Runtime dynamic imports outside approved exceptions
2. ❌ Direct imports from `@/contents` directory (except in `core/scripts/build/registry.mjs`)
3. ❌ Manual edits to `core/lib/registries/` files

**Severity:** CRITICAL - Pre-commit and CI/CD must validate compliance

### Why This Policy Exists

**Performance impact:**
- Registry system: 6ms for all entities
- One dynamic import: +140ms per import
- **Result:** 17,255x performance loss

**Example violation cost:**

```typescript
// ❌ ONE violation destroys performance
const config = await import('@/contents/themes/default/entities/tasks/tasks.config')
// Cost: +140ms runtime I/O

// ✅ Registry access (correct)
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
const config = ENTITY_REGISTRY.tasks
// Cost: <1ms (in-memory lookup)
```

**Impact of violations:**
- ❌ Cold start: 140ms → 2-3 seconds
- ❌ Core Web Vitals: LCP degraded
- ❌ Serverless functions: Timeout risk
- ❌ User experience: Slow page loads

---

## Allowed Exceptions

### 1. i18n/Translation Loading

**Pattern:** Lazy-load translations (only active locale)

```typescript
// ✅ ALLOWED - Reduces initial bundle by ~80%
const messages = await import(`@/core/messages/${locale}/${namespace}.json`)
const translations = await import(`@/core/messages/${locale}/index.ts`)
```

**Justification:**
- Standard practice in i18n libraries (next-intl, react-i18next)
- Only loads active locale, not all languages
- Translation files are data, not executable code
- Significant bundle size reduction

**Location:** `core/messages/` and entity message files

### 2. UI Code-Splitting

**Pattern:** React.lazy for large components (>100KB)

```typescript
// ✅ ALLOWED - Lazy-load heavy components
const HeavyChart = lazy(() => import('./HeavyChart'))
const AdvancedEditor = lazy(() => import('./AdvancedEditor'))
const VideoPlayer = lazy(() => import('./VideoPlayer'))
```

**Justification:**
- Built into React, recommended by Next.js
- Reduces initial bundle size
- Improves Core Web Vitals (LCP, FID)
- Components load on-demand

**Usage:**

```typescript
import { lazy, Suspense } from 'react'

const ChartComponent = lazy(() => import('./ChartComponent'))

export function Dashboard() {
  return (
    <Suspense fallback={<ChartSkeleton />}>
      <ChartComponent data={data} />
    </Suspense>
  )
}
```

### 3. Type-Only Imports

**Pattern:** Zero runtime cost type imports

```typescript
// ✅ ALLOWED - Compile-time only, erased during build
export type Messages = typeof import('./es/index.ts').default
flags?: import('@/core/lib/entities/types').UserFlag[]
```

**Justification:**
- TypeScript feature, zero runtime cost
- Completely erased during build process
- No performance impact

### 4. Build Scripts Only

**Pattern:** Development-time tooling

```typescript
// ✅ ALLOWED - scripts/ directory only
// core/scripts/create-theme.mjs
const config = await import(`./${themeName}/theme.config`)
```

**Justification:**
- Runs at build time, not runtime
- Development tooling, not production code
- Does not affect production performance

**Location:** `scripts/` directory only

### 5. Heavy Client-Side Libraries

**Pattern:** User-triggered libraries (>500KB)

```typescript
// ✅ ALLOWED - Large libraries loaded only when user triggers them
export async function extractTextFromPDF(file: File): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist')  // ~2MB
  // Process PDF...
  return text
}

export async function extractTextFromDOCX(file: File): Promise<string> {
  const mammoth = await import('mammoth')  // ~500KB
  // Process DOCX...
  return text
}
```

**Requirements for this exception:**
- Library must be >500KB
- Must be triggered by explicit user action (upload, click)
- Cannot be used for service/registry/content loading
- Should have clear performance benefit (bundle size reduction)
- Client-side only (browser APIs)

**Example use case:** Document parser that loads PDF.js (2MB) only when user uploads a PDF file.

---

## Prohibited Patterns

### 1. Registry/Content Loading

**❌ FORBIDDEN:**

```typescript
// ❌ Defeats registry performance
const { ENTITY_REGISTRY } = await import('@/core/lib/registries/entity-registry')
const { THEME_REGISTRY } = await import('@/core/lib/registries/theme-registry')
const entityConfig = await import('@/contents/entities/products/product.config')
```

**✅ CORRECT:**

```typescript
// ✅ Static imports at module level
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'
import { THEME_REGISTRY } from '@/core/lib/registries/theme-registry'

const entityConfig = ENTITY_REGISTRY.products // <1ms lookup
```

**Why prohibited:**
- Registry system provides ~17,255x improvement
- Dynamic import reintroduces 140ms+ overhead
- All content available via static registries

### 2. API/Service Loading

**❌ FORBIDDEN:**

```typescript
// ❌ Unnecessary runtime overhead
const { MetaService } = await import('@/core/lib/services/meta.service')
const { auth } = await import('@/core/lib/auth')
const { queryOne } = await import('@/core/lib/db')
```

**✅ CORRECT:**

```typescript
// ✅ Static imports at module level
import { MetaService } from '@/core/lib/services/meta.service'
import { auth } from '@/core/lib/auth'
import { queryOne } from '@/core/lib/db'
```

**Why prohibited:**
- Services should be imported statically for tree-shaking
- No performance benefit to lazy-loading services
- Complicates dependency graph

### 3. Plugin/Theme API Routes

**❌ FORBIDDEN:**

```typescript
// ❌ Runtime route loading
const themeRoute = await import(`@/contents/themes/${theme}/api/${path}/route`)
const pluginRoute = await import(`@/contents/plugins/${plugin}/api/${path}/route`)
```

**✅ CORRECT:**

```typescript
// ✅ Use registry-based route resolution
import { getThemeRouteHandler, getPluginRouteHandler } from '@/core/lib/registries/route-handlers'

const themeHandler = getThemeRouteHandler(path, method) // <1ms
const pluginHandler = getPluginRouteHandler(path, method) // <1ms
```

**Why prohibited:**
- Routes registered at build time via registry
- Runtime route loading bypasses Next.js optimizations
- Security risk (allows arbitrary file path execution)

### 4. Conditional Module Loading

**❌ FORBIDDEN:**

```typescript
// ❌ Runtime conditional imports
if (shouldUseFeature) {
  const { Feature } = await import('./feature')
  Feature.execute()
}
```

**✅ CORRECT:**

```typescript
// ✅ Import statically, execute conditionally
import { Feature } from './feature'

if (shouldUseFeature) {
  Feature.execute()
}
```

**Why prohibited:**
- Breaks static analysis and tree-shaking
- Unpredictable bundle size
- Use conditional execution, not conditional imports

### 5. eval() Workarounds

**❌ FORBIDDEN:**

```typescript
// ❌ Disguised dynamic imports - SECURITY VIOLATION
const module = await eval(`import('${path}')`)
const fn = new Function('path', 'return import(path)')
```

**Why prohibited:**
- Security vulnerability (arbitrary code execution)
- Bypasses static analysis completely
- Defeats all optimization systems

---

## Enforcement Tools

### check-dynamic-imports.sh Script

**Location:** `core/scripts/validation/check-imports.sh`
**Size:** 58 lines
**Purpose:** Validate zero dynamic import violations

**What it checks:**

1. **Dynamic import violations:**
   - Searches for `await import(` patterns
   - Excludes allowed locations (messages/, scripts/, tests)
   - Excludes React.lazy patterns
   - Reports violations with file paths

2. **Hardcoded content imports:**
   - Searches for `from '@/contents'` patterns
   - Excludes auto-generated files (registries)
   - Excludes type-only imports
   - Reports direct content imports

**Script breakdown:**

```bash
#!/bin/bash
echo "🔍 Checking for dynamic import violations..."

# Check for prohibited await import() patterns
VIOLATIONS=$(grep -r "await import(" --include="*.ts" --include="*.tsx" \
  core/ app/ 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".next" | \
  grep -v "lazy(" | \          # Exclude React.lazy
  grep -v "messages/" | \       # Exclude i18n
  grep -v "scripts/" | \        # Exclude build scripts
  grep -v "useLocale.ts" | \    # Exclude i18n hook
  grep -v "\.test\." | \        # Exclude tests
  grep -v "\.spec\." || true)   # Exclude tests

# Check for hardcoded imports from contents/ (except allowed locations)
HARDCODED=$(grep -r "from '@/contents" --include="*.ts" --include="*.tsx" \
  core/ app/ 2>/dev/null | \
  grep -v "node_modules" | \
  grep -v ".next" | \
  grep -v "core/lib/registries/" | \  # Exclude auto-generated
  grep -v "app/(templates)/" | \      # Exclude template overrides
  grep -v "app/api/v1/theme/" | \     # Exclude theme API
  grep -v "app/api/v1/plugin/" | \    # Exclude plugin API
  grep -v "types" | \                 # Exclude type imports
  grep -v "\.test\." | \
  grep -v "\.spec\." || true)

# Report violations
FOUND_VIOLATIONS=0

if [ ! -z "$VIOLATIONS" ]; then
  echo "❌ DYNAMIC IMPORT VIOLATIONS FOUND:"
  echo "$VIOLATIONS"
  FOUND_VIOLATIONS=1
fi

if [ ! -z "$HARDCODED" ]; then
  echo "❌ HARDCODED CONTENT IMPORTS FOUND:"
  echo "$HARDCODED"
  FOUND_VIOLATIONS=1
fi

if [ $FOUND_VIOLATIONS -eq 1 ]; then
  echo "See .rules/dynamic-imports.md for allowed patterns"
  exit 1
fi

echo "✅ No dynamic import violations found"
echo "✅ No hardcoded content imports found"
exit 0
```

**Usage:**

```bash
# Run manually
./core/scripts/validation/check-imports.sh

# Output if clean:
# 🔍 Checking for dynamic import violations...
# ✅ No dynamic import violations found
# ✅ No hardcoded content imports found

# Output if violations:
# 🔍 Checking for dynamic import violations...
# ❌ DYNAMIC IMPORT VIOLATIONS FOUND:
# core/lib/bad-file.ts:15: const config = await import('@/contents/...')
# See .rules/dynamic-imports.md for allowed patterns
```

---

## Pre-Commit Hook Setup

### Installation

**1. Install Husky (if not already):**

```bash
pnpm add -D husky
npx husky install
```

**2. Create pre-commit hook:**

```bash
npx husky add .husky/pre-commit "chmod +x core/scripts/validation/check-imports.sh && ./core/scripts/validation/check-imports.sh"
```

**3. Make executable:**

```bash
chmod +x .husky/pre-commit
chmod +x core/scripts/validation/check-imports.sh
```

### Pre-Commit Hook Content

**File:** `.husky/pre-commit`

```bash
#!/bin/bash
. "$(dirname "$0")/_/husky.sh"

echo "🔍 Running pre-commit checks..."
echo ""

# Check dynamic imports
chmod +x core/scripts/validation/check-imports.sh
./core/scripts/validation/check-imports.sh

if [ $? -ne 0 ]; then
  echo ""
  echo "❌ Pre-commit checks failed"
  echo "Fix violations before committing"
  exit 1
fi

echo ""
echo "✅ All pre-commit checks passed"
```

### How It Works

**Workflow:**

1. Developer runs `git commit`
2. Pre-commit hook triggers automatically
3. `check-dynamic-imports.sh` scans for violations
4. If violations found:
   - ❌ Commit blocked
   - Developer sees violation file paths
   - Must fix before committing
5. If no violations:
   - ✅ Commit proceeds

**Example blocked commit:**

```bash
$ git commit -m "Add new feature"

🔍 Running pre-commit checks...
🔍 Checking for dynamic import violations...

❌ DYNAMIC IMPORT VIOLATIONS FOUND:
core/lib/entities/loader.ts:45: const config = await import(configPath)

See .rules/dynamic-imports.md for allowed patterns

❌ Pre-commit checks failed
Fix violations before committing
```

---

## CI/CD Integration

### GitHub Actions

**File:** `.github/workflows/ci.yml`

```yaml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main, develop]

jobs:
  enforce-policies:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '20'

      - name: Check Dynamic Import Policy
        run: |
          chmod +x core/scripts/validation/check-imports.sh
          ./core/scripts/validation/check-imports.sh

      - name: Report Results
        if: failure()
        run: |
          echo "❌ Dynamic import policy violations detected"
          echo "Review .rules/dynamic-imports.md for allowed patterns"
          exit 1
```

### GitLab CI

**File:** `.gitlab-ci.yml`

```yaml
policy-enforcement:
  stage: test
  script:
    - chmod +x core/scripts/validation/check-imports.sh
    - ./core/scripts/validation/check-imports.sh
  only:
    - merge_requests
    - main
    - develop
```

### Vercel Build Hook

**File:** `vercel.json`

```json
{
  "buildCommand": "pnpm check:imports && pnpm build",
  "devCommand": "pnpm dev"
}
```

**Package.json:**

```json
{
  "scripts": {
    "check:imports": "./core/scripts/validation/check-imports.sh",
    "prebuild": "pnpm check:imports"
  }
}
```

---

## ESLint Configuration

### Setup

**File:** `.eslintrc.js`

```javascript
module.exports = {
  rules: {
    // Restrict await import() patterns
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ImportExpression',
        message: 'Dynamic imports are restricted. See .rules/dynamic-imports.md for allowed patterns.',
      },
    ],
    // Restrict imports from @/contents
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@/contents/*'],
            message: 'Direct imports from @/contents are prohibited. Use registries instead.',
          },
        ],
      },
    ],
  },
  overrides: [
    // Allow dynamic imports in approved locations
    {
      files: [
        'scripts/**/*',
        '**/*.test.ts',
        '**/*.spec.ts',
        'core/messages/**/*',
      ],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
    // Allow @/contents imports in auto-generated files
    {
      files: [
        'core/lib/registries/**/*',
        'core/scripts/build/registry.mjs',
      ],
      rules: {
        'no-restricted-imports': 'off',
      },
    },
  ],
}
```

### IDE Integration

**VSCode:** `.vscode/settings.json`

```json
{
  "eslint.enable": true,
  "eslint.validate": [
    "javascript",
    "javascriptreact",
    "typescript",
    "typescriptreact"
  ],
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  }
}
```

---

## Common Violations and Fixes

### Violation 1: Dynamic Registry Import

**❌ Violation:**

```typescript
// core/lib/api/dynamic-loader.ts
export async function loadEntityConfig(entityName: string) {
  const { ENTITY_REGISTRY } = await import('@/core/lib/registries/entity-registry')
  return ENTITY_REGISTRY[entityName]
}
```

**✅ Fix:**

```typescript
// core/lib/api/static-loader.ts
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

export function loadEntityConfig(entityName: string) {
  return ENTITY_REGISTRY[entityName] // <1ms
}
```

### Violation 2: Direct Content Import

**❌ Violation:**

```typescript
// app/api/v1/tasks/route.ts
import { taskEntityConfig } from '@/contents/themes/default/entities/tasks/tasks.config'

export async function GET() {
  // Use taskEntityConfig...
}
```

**✅ Fix:**

```typescript
// app/api/v1/tasks/route.ts
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

export async function GET() {
  const taskConfig = ENTITY_REGISTRY.tasks // Use registry
  // Use taskConfig...
}
```

### Violation 3: Dynamic Route Loading

**❌ Violation:**

```typescript
// core/lib/api/route-resolver.ts
export async function resolvePluginRoute(plugin: string, path: string) {
  const route = await import(`@/contents/plugins/${plugin}/routes/${path}/route`)
  return route
}
```

**✅ Fix:**

```typescript
// core/lib/api/route-resolver.ts
import { getPluginRouteHandler } from '@/core/lib/registries/route-handlers'

export function resolvePluginRoute(plugin: string, path: string, method: string) {
  const routeKey = `${plugin}/${path}`
  return getPluginRouteHandler(routeKey, method) // <1ms
}
```

### Violation 4: Conditional Service Import

**❌ Violation:**

```typescript
// core/lib/features/analytics.ts
export async function trackEvent(event: string) {
  if (process.env.NODE_ENV === 'production') {
    const { AnalyticsService } = await import('./analytics-service')
    AnalyticsService.track(event)
  }
}
```

**✅ Fix:**

```typescript
// core/lib/features/analytics.ts
import { AnalyticsService } from './analytics-service'

export function trackEvent(event: string) {
  if (process.env.NODE_ENV === 'production') {
    AnalyticsService.track(event) // Conditional execution, not import
  }
}
```

---

## Debugging Enforcement Failures

### False Positives

**Issue:** Legitimate dynamic import flagged as violation

**Example:**

```typescript
// ✅ ALLOWED - But flagged
const messages = await import(`@/core/messages/${locale}/common.json`)
```

**Solution:** Add to exception list in `check-dynamic-imports.sh`:

```bash
grep -v "messages/" | \  # Already excluded
```

### Missing Violations

**Issue:** Violation not caught by script

**Diagnosis:**

```bash
# Manual check
grep -r "await import(" core/ app/ | grep -v "lazy(" | grep -v "messages/"
```

**Solution:** Update regex patterns in `check-dynamic-imports.sh`

### Bypass Attempts

**Issue:** Developer tries to bypass checks

**Examples:**

```typescript
// ❌ Disguised dynamic import
const importFn = (path) => import(path)
await importFn('@/contents/...')

// ❌ eval workaround
await eval('import("@/contents/...")')
```

**Solution:** These are caught by:
1. Code review
2. Runtime performance monitoring
3. TypeScript type checking

---

## Migration Patterns

### Migrating from Dynamic Imports

**Before (Dynamic):**

```typescript
// Old pattern
export async function getEntityList() {
  const entities = []

  for (const entityName of ['tasks', 'products', 'users']) {
    const config = await import(`@/contents/entities/${entityName}/${entityName}.config`)
    entities.push(config.default)
  }

  return entities
}
```

**After (Registry):**

```typescript
// New pattern
import { getRegisteredEntities } from '@/core/lib/registries/entity-registry'

export function getEntityList() {
  return getRegisteredEntities() // <1ms for all entities
}
```

**Performance improvement:** 420ms (140ms × 3) → <1ms

### Migrating from Direct Imports

**Before (Direct):**

```typescript
// Old pattern
import { taskEntityConfig } from '@/contents/themes/default/entities/tasks/tasks.config'
import { productEntityConfig } from '@/contents/themes/default/entities/products/products.config'

export function getConfigs() {
  return [taskEntityConfig, productEntityConfig]
}
```

**After (Registry):**

```typescript
// New pattern
import { ENTITY_REGISTRY } from '@/core/lib/registries/entity-registry'

export function getConfigs() {
  return [
    ENTITY_REGISTRY.tasks,
    ENTITY_REGISTRY.products
  ]
}
```

**Benefits:**
- Single import statement
- Type-safe entity names
- Auto-updates when entities added/removed

---

## Testing Enforcement

### Unit Tests

```typescript
// scripts/__tests__/check-dynamic-imports.test.ts
describe('Dynamic Import Enforcement', () => {
  it('should detect dynamic import violations', async () => {
    const result = await exec('./core/scripts/validation/check-imports.sh')
    expect(result.code).toBe(0)
  })

  it('should allow React.lazy patterns', () => {
    const code = `const Component = lazy(() => import('./Component'))`
    expect(isAllowedPattern(code)).toBe(true)
  })

  it('should allow i18n message imports', () => {
    const code = `const messages = await import('@/core/messages/en/common.json')`
    expect(isAllowedPattern(code)).toBe(true)
  })

  it('should block content imports', () => {
    const code = `const config = await import('@/contents/entities/tasks/tasks.config')`
    expect(isAllowedPattern(code)).toBe(false)
  })
})
```

### Integration Tests

```typescript
// test/enforcement.e2e.test.ts
describe('Registry System Enforcement', () => {
  it('should have no dynamic imports in production code', () => {
    const violations = scanForDynamicImports('core/', 'app/')
    expect(violations).toHaveLength(0)
  })

  it('should have no direct @/contents imports', () => {
    const violations = scanForContentImports('core/', 'app/')
    expect(violations).toHaveLength(0)
  })
})
```

---

## Summary

**Enforcement layers:**

1. ✅ **Pre-commit hook** - Blocks violations before commit
2. ✅ **CI/CD pipeline** - Validates on push/PR
3. ✅ **ESLint rules** - IDE warnings in real-time
4. ✅ **Code review** - Human validation
5. ✅ **Performance monitoring** - Runtime verification

**Zero tolerance violations:**
- ❌ Dynamic imports for content/config
- ❌ Direct imports from `@/contents`
- ❌ Manual edits to registry files

**Allowed exceptions:**
- ✅ i18n translations (`messages/`)
- ✅ React.lazy UI code-splitting
- ✅ Type-only imports
- ✅ Build scripts (`scripts/`)
- ✅ Heavy client libraries (>500KB, user-triggered)

**Tools:**
- `core/scripts/validation/check-imports.sh` - Validation script
- `.husky/pre-commit` - Pre-commit hook
- `.eslintrc.js` - ESLint rules
- CI/CD workflows - Pipeline integration

**Key takeaway:** One violation can destroy ~17,255x performance gain. Enforcement is not optional.

**See Also:**
- [Introduction](./01-introduction.md) - Zero runtime I/O philosophy
- [Dynamic Import Rules](/.rules/dynamic-imports.md) - Complete policy (503 lines)
- [Troubleshooting](./13-troubleshooting-and-debugging.md) - Fixing violations

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
**Enforcement:** Zero Tolerance
