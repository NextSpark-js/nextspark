# Troubleshooting and Debugging

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

**Common errors • Debugging techniques • Migration patterns • Best practices**

---

## Table of Contents

- [Common Errors](#common-errors)
- [Debugging Techniques](#debugging-techniques)
- [Migration Patterns](#migration-patterns)
- [Registry Validation](#registry-validation)
- [Build Script Debugging](#build-script-debugging)
- [Type Errors](#type-errors)
- [Performance Issues](#performance-issues)
- [Best Practices](#best-practices)

---

## Common Errors

### Error 1: "This module cannot be imported from a Client Component"

**Symptom:**
```text
Error: This module cannot be imported from a Client Component module.
It should only be used from a Server Component.

.nextspark/registries/plugin-registry.ts
```

**Cause:** Importing server-only registry in client component

**Solution:**
```typescript
// ❌ Wrong - Server-only registry in client component
'use client'
import { usePlugin } from '@nextsparkjs/registries/plugin-registry'

// ✅ Correct - Use client-safe registry
'use client'
import { usePlugin } from '@nextsparkjs/registries/plugin-registry.client'
```

---

### Error 2: Registry Returns Empty Object

**Symptom:**
```typescript
const entity = ENTITY_REGISTRY.tasks
console.log(entity) // undefined
```

**Cause:** Registry not rebuilt after adding new content

**Solution:**
```bash
# Rebuild registry
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# Or with verbose output
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --verbose

# Verify entity exists
cat .nextspark/registries/entity-registry.ts | grep "tasks"
```

---

### Error 3: Type Error - Property Does Not Exist

**Symptom:**
```typescript
const entity = ENTITY_REGISTRY.tasks
// Error: Property 'tasks' does not exist on type 'typeof ENTITY_REGISTRY'
```

**Cause:** TypeScript not recognizing new entity type

**Solution:**
```bash
# 1. Rebuild registry (generates new types)
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# 2. Restart TypeScript server in VS Code
# Cmd/Ctrl + Shift + P → "TypeScript: Restart TS Server"

# 3. Verify type is generated
cat .nextspark/registries/entity-registry.ts | grep "export type EntityName"
```

---

### Error 4: Dynamic Import Violation

**Symptom:**
```bash
❌ DYNAMIC IMPORT VIOLATIONS FOUND:
core/lib/loaders/entity-loader.ts:15: const config = await import(`@/entities/...`)
```

**Cause:** Using runtime dynamic imports instead of registry

**Solution:**
```typescript
// ❌ Wrong - Dynamic import
const config = await import(`@/entities/${entity}/config.ts`)

// ✅ Correct - Registry lookup
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
const entity = ENTITY_REGISTRY[entityName]
```

---

### Error 5: Hardcoded Import from Contents

**Symptom:**
```bash
❌ HARDCODED IMPORTS FROM CONTENTS FOUND:
app/entities/tasks/page.tsx:3: import { taskConfig } from '@/...'
```

**Cause:** Direct import from project source instead of a registry

**Solution:**
```typescript
// ❌ Wrong - Hardcoded import
import { taskConfig } from '@/entities/tasks/tasks.config'

// ✅ Correct - Registry import
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
const taskConfig = ENTITY_REGISTRY.tasks?.config
```

---

### Error 6: Registry File Missing

**Symptom:**
```text
Module not found: Can't resolve '@nextsparkjs/registries/entity-registry'
```

**Cause:** Registry file not generated

**Solution:**
```bash
# Generate all registries
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# Check file exists
ls .nextspark/registries/entity-registry.ts

# If still missing, check build script for errors
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs 2>&1 | tee build.log
```

---

### Error 7: Stale Registry Data

**Symptom:** Registry shows old data after content changes

**Cause:** Registry not automatically rebuilt in dev mode

**Solution:**
```bash
# Manual rebuild in the monorepo
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# Watch for changes in the monorepo
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --watch
```

---

## Debugging Techniques

### Technique 1: Verbose Logging

**Enable verbose logging:**
```bash
# Long form
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --verbose

# Short form
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs -v
```

**Output:**
```text
[Registry] Starting build process...
[Registry] Discovering entities in entities...
[Registry] Found entity: tasks
[Registry] - Config: tasks.config.ts
[Registry] - Migrations: ✓
[Registry] - Messages: ✓
[Registry] Generating entity-registry.ts...
[Registry] ✓ Entity registry generated (219 lines)
```

---

### Technique 2: Registry Inspection

**Inspect generated registry:**
```bash
# View entire registry
cat .nextspark/registries/entity-registry.ts

# Search for specific entity
grep -A 20 "'tasks'" .nextspark/registries/entity-registry.ts

# Check metadata
grep "ENTITY_METADATA" .nextspark/registries/entity-registry.ts
```

**Inspect in code:**
```typescript
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

console.log('Total entities:', ENTITY_METADATA.totalEntities)
console.log('Entities:', ENTITY_METADATA.entities)
console.log('Registry keys:', Object.keys(ENTITY_REGISTRY))

// Detailed inspection
Object.entries(ENTITY_REGISTRY).forEach(([name, entry]) => {
  console.log(`Entity: ${name}`)
  console.log(`  - Source: ${entry.source}`)
  console.log(`  - Migrations: ${entry.hasMigrations}`)
  console.log(`  - Messages: ${entry.hasMessages}`)
})
```

---

### Technique 3: Build Script Dry Run

**Run build without writing files:**
```typescript
// Add to packages/core/scripts/build/registry.mjs
const DRY_RUN = process.env.DRY_RUN === 'true'

if (DRY_RUN) {
  console.log('Would generate:', registryContent)
  console.log('File path:', outputPath)
} else {
  await writeFile(outputPath, registryContent)
}
```

**Usage:**
```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

---

### Technique 4: Type Checking

**Verify registry types:**
```bash
# Check for type errors in generated registry
npx tsc --noEmit .nextspark/registries/entity-registry.ts

# Check types in consuming code
npx tsc --noEmit app/entities/page.tsx
```

---

## Migration Patterns

### Pattern 1: From Dynamic Imports to Registry

**Before:**
```typescript
// ❌ Old pattern - Dynamic imports
export async function loadEntityConfig(name: string) {
  const config = await import(
    `@/entities/${name}/${name}.config`
  )
  return config.starter
}
```

**After:**
```typescript
// ✅ New pattern - Registry lookup
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'

export function loadEntityConfig(name: string) {
  return ENTITY_REGISTRY[name]?.config
}

// ✅ With type safety
export function loadEntityConfig(name: EntityName) {
  return ENTITY_REGISTRY[name].config
}
```

---

### Pattern 2: From Runtime Discovery to Registry

**Before:**
```typescript
// ❌ Old pattern - Runtime file system access
export async function getAllEntities() {
  const entitiesDir = 'entities'
  const dirs = await fs.readdir(entitiesDir)

  return Promise.all(
    dirs.map(async dir => {
      const config = await import(`${entitiesDir}/${dir}/${dir}.config`)
      return config.starter
    })
  )
}
```

**After:**
```typescript
// ✅ New pattern - Registry access
import { getRegisteredEntities } from '@nextsparkjs/registries/entity-registry'

export function getAllEntities() {
  return getRegisteredEntities()
}
```

---

### Pattern 3: From Plugin-Specific Hooks to Generic usePlugin

**Before:**
```typescript
// ❌ Old pattern - Plugin-specific generated hooks
import { useAIPlugin } from '@nextsparkjs/registries/plugin-registry'
import { useAnalyticsPlugin } from '@nextsparkjs/registries/plugin-registry'

const { generateText } = useAIPlugin()
const { trackEvent } = useAnalyticsPlugin()
```

**After:**
```typescript
// ✅ New pattern - Generic usePlugin hook
import { usePlugin } from '@nextsparkjs/registries/plugin-registry'

const { generateText } = usePlugin('ai')
const { trackEvent } = usePlugin('analytics')
```

---

### Pattern 4: From String Interpolation to Registry

**Before:**
```typescript
// ❌ Old pattern - String interpolation in dynamic imports
const locale = getUserLocale()
const translations = await import(
  `@/messages/${locale}.json`
)
```

**After:**
```typescript
// ✅ New pattern - Registry with lazy loading
import { loadThemeTranslation } from '@nextsparkjs/registries/translation-registry'

const locale = getUserLocale()
const translations = await loadThemeTranslation('starter', locale)
```

---

## Registry Validation

### Validation Script

**Create validation utility:**
```typescript
// scripts/validate-registries.ts
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'
import { PLUGIN_REGISTRY, PLUGIN_METADATA } from '@nextsparkjs/registries/plugin-registry'
import { THEME_REGISTRY, THEME_METADATA } from '@nextsparkjs/registries/theme-registry'

function validateEntityRegistry() {
  const errors: string[] = []

  // Check metadata matches actual registry
  if (Object.keys(ENTITY_REGISTRY).length !== ENTITY_METADATA.totalEntities) {
    errors.push(
      `Entity count mismatch: ${Object.keys(ENTITY_REGISTRY).length} vs ${ENTITY_METADATA.totalEntities}`
    )
  }

  // Check each entity has required properties
  Object.entries(ENTITY_REGISTRY).forEach(([name, entry]) => {
    if (!entry.config) {
      errors.push(`Entity ${name} missing config`)
    }
    if (!entry.source) {
      errors.push(`Entity ${name} missing source`)
    }
  })

  return errors
}

function validateAllRegistries() {
  const allErrors = {
    entity: validateEntityRegistry(),
    // Add other registry validations...
  }

  const hasErrors = Object.values(allErrors).some(errors => errors.length > 0)

  if (hasErrors) {
    console.error('❌ Registry validation failed:')
    Object.entries(allErrors).forEach(([registry, errors]) => {
      if (errors.length > 0) {
        console.error(`\n${registry}:`)
        errors.forEach(error => console.error(`  - ${error}`))
      }
    })
    process.exit(1)
  } else {
    console.log('✓ All registries valid')
  }
}

validateAllRegistries()
```

**Run validation:**
```bash
npx tsx scripts/validate-registries.ts
```

---

## Build Script Debugging

### Common Build Script Issues

**Issue: Build script hangs**
```bash
# Check for infinite loops or unresolved promises
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# Add progress logging
```

**Issue: Build script crashes**
```bash
# Run with error details
cd apps/dev && node --trace-warnings ../../packages/core/scripts/build/registry.mjs
```

From the monorepo root, check for syntax errors:
```bash
pnpm exec eslint packages/core/scripts/build/registry.mjs
```

**Issue: Incorrect file discovery**
```bash
# Enable verbose file discovery
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs --verbose
```

---

### Build Script Profiling

```typescript
// Add to packages/core/scripts/build/registry.mjs
import { performance } from 'perf_hooks'

function profileSection(name: string, fn: () => any) {
  const start = performance.now()
  const result = fn()
  const end = performance.now()
  console.log(`[Profile] ${name}: ${(end - start).toFixed(2)}ms`)
  return result
}

// Usage
const entities = profileSection('Entity Discovery', () => discoverEntities())
```

---

## Type Errors

### Error: Type 'string' is not assignable to type EntityName

**Symptom:**
```typescript
const name = 'tasks' // Type: string
const entity = ENTITY_REGISTRY[name] // Error: Type 'string' is not assignable to type 'EntityName'
```

**Solution:**
```typescript
// Option 1: Type assertion
const name = 'tasks' as EntityName
const entity = ENTITY_REGISTRY[name]

// Option 2: Type guard
function isEntityName(name: string): name is EntityName {
  return name in ENTITY_REGISTRY
}

const name = 'tasks'
if (isEntityName(name)) {
  const entity = ENTITY_REGISTRY[name] // Type-safe
}

// Option 3: Use helper function with dynamic lookup
const entity = getEntity(name) // Returns EntityConfig | undefined
```

---

### Error: Cannot find name 'EntityName'

**Symptom:**
```typescript
import { EntityName } from '@nextsparkjs/registries/entity-registry'
// Error: Module has no exported member 'EntityName'
```

**Solution:**
```bash
# Registry not built yet
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs

# Verify export exists
grep "export type EntityName" .nextspark/registries/entity-registry.ts
```

---

## Performance Issues

### Issue: Slow Registry Lookups

**Symptoms:**
- Registry lookups taking >50ms
- Application feels slow

**Debugging:**
```typescript
import { performance } from 'perf_hooks'

const start = performance.now()
const entity = ENTITY_REGISTRY.tasks
const end = performance.now()

console.log(`Lookup took ${end - start}ms`) // Should be <10ms
```

**Causes:**
1. Not using registry (still using runtime discovery)
2. Large registry (>10,000 entries)
3. Registry not tree-shaken properly

**Solutions:**
```bash
# 1. Verify registry usage
grep -r "ENTITY_REGISTRY" app/

# 2. Check registry size
ls -lh .nextspark/registries/*.ts

# 3. Build the application and inspect the emitted bundle sizes
pnpm build
```

---

### Issue: Large Bundle Size

**Symptoms:**
- Registry files >500KB
- Slow page loads

**Debugging:**
```bash
# Check registry file sizes
du -sh .nextspark/registries/*

# Build the application before inspecting its emitted bundles
pnpm build
```

**Solutions:**
```typescript
// 1. Split server/client registries
// Server: Full registry
import { PLUGIN_REGISTRY } from '@nextsparkjs/registries/plugin-registry'

// Client: Metadata only
import { PLUGIN_REGISTRY } from '@nextsparkjs/registries/plugin-registry.client'

// 2. Lazy load heavy registries
const EntityRegistry = lazy(() => import('@nextsparkjs/registries/entity-registry'))
```

---

## Best Practices

### 1. Always Rebuild After Content Changes

```bash
# Add to git hooks
# .husky/pre-commit
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
git add .nextspark/registries/
```

---

### 2. Use Type-Safe Registry Access

```typescript
// ✅ Good - Type-safe
import type { EntityName } from '@nextsparkjs/registries/entity-registry'

function loadEntity(name: EntityName) {
  return ENTITY_REGISTRY[name] // Autocomplete + type checking
}

// ❌ Bad - Unsafe
function loadEntity(name: string) {
  return ENTITY_REGISTRY[name as any] // No type safety
}
```

---

### 3. Validate Registry in CI/CD

```yaml
# .github/workflows/ci.yml
name: CI

on: [push, pull_request]

jobs:
  validate-registries:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
      - run: npx tsx scripts/validate-registries.ts
      - run: pnpm lint
      - run: npx tsc --noEmit
```

---

### 4. Monitor Registry Build Times

```typescript
// packages/core/scripts/build/registry.mjs
const buildStart = performance.now()

// ... build logic ...

const buildEnd = performance.now()
const buildTime = buildEnd - buildStart

console.log(`✓ Registry build completed in ${buildTime.toFixed(0)}ms`)

if (buildTime > 1000) {
  console.warn('⚠️ Build time exceeded 1 second')
}
```

---

### 5. Document Registry Usage

```typescript
/**
 * Load entity configuration from registry
 *
 * @param name - Entity name (must exist in ENTITY_REGISTRY)
 * @returns Entity configuration
 * @throws Error if entity not found
 *
 * @example
 * const taskConfig = loadEntity('tasks')
 * console.log(taskConfig.slug) // 'tasks'
 */
export function loadEntity(name: EntityName) {
  const entity = ENTITY_REGISTRY[name]
  if (!entity) {
    throw new Error(`Entity not found: ${name}`)
  }
  return entity.config
}
```

---

## Summary

**Common Issues:**
- ✅ Server-only registry in client component → Use .client registry
- ✅ Registry returns undefined → Rebuild registry
- ✅ Type errors → Restart TypeScript server
- ✅ Dynamic import violations → Use registry instead
- ✅ Stale data → Rebuild or use watch mode

**Debugging Checklist:**
1. Enable verbose logging (`DEBUG=true`)
2. Inspect generated registry files
3. Validate registry structure
4. Check TypeScript types
5. Profile build script
6. Analyze bundle size

**Migration Steps:**
1. Replace dynamic imports with registry lookups
2. Replace runtime discovery with registry access
3. Use type-safe EntityName/PluginName types
4. Validate in CI/CD
5. Monitor performance

**Best Practices:**
- Always rebuild after content changes
- Use type-safe access patterns
- Validate registries in CI/CD
- Monitor build times
- Document usage patterns

**Next steps:**
- [Introduction](./01-introduction.md) - Registry system overview
- [Performance](./12-performance-and-benchmarks.md) - Performance analysis
- [Enforcement](./11-enforcement-and-validation.md) - Policy enforcement

**Documentation:** `core/docs/03-registry-system/13-troubleshooting-and-debugging.md`
