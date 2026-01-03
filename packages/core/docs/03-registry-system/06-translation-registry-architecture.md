# Translation Registry

## Overview

The Translation Registry (`core/lib/registries/translation-registry.ts`) provides **lazy-loading, zero-runtime-interpolation access** to i18n translations. It preserves next-intl's performance by generating static import paths at build time, loading only the active locale at runtime.

**Key Features:**
- ✅ Build-time translation discovery
- ✅ Lazy-loading per locale (only active locale loaded)
- ✅ Zero runtime string interpolation
- ✅ Theme and plugin translation merging
- ✅ Locale-specific registries
- ✅ Integration with next-intl

---

## Architecture

### Build-Time Translation Discovery

```typescript
// Generated at build time by core/scripts/build/registry.mjs
export const THEME_TRANSLATION_LOADERS: Record<string, Record<string, TranslationLoader>> = {
  'default': {
    'en': () => import('@/contents/themes/default/messages/en.json'),
    'es': () => import('@/contents/themes/default/messages/es.json')
  }
}

// Type-safe loader function
export type TranslationLoader = () => Promise<{ default: Record<string, unknown> } | Record<string, unknown>>
```

**Why lazy-loading?**
- Only loads active locale (not all locales)
- Reduces bundle size
- Faster initial page load
- next-intl best practice

### Runtime Lazy Loading

```typescript
// Load only when needed
const loader = THEME_TRANSLATION_LOADERS.default.en

// Execute loader to get translations
const translations = await loader()

// Returns: { default: { key: 'value', ... } } or { key: 'value', ... }
```

---

## Translation Discovery

### Automatic Discovery Process

**Build script** (`core/scripts/build/registry.mjs`) discovers:

1. **Core Translations:**
```text
core/messages/
├── en.json
├── es.json
├── fr.json
└── pt.json
```

2. **Theme Translations:**
```text
contents/themes/default/messages/
├── en.json
└── es.json
```

3. **Plugin Translations:**
```text
contents/plugins/ai/messages/
├── en.json
└── es.json
```

4. **Entity Translations:**
```text
contents/themes/default/entities/tasks/messages/
├── en.json
└── es.json
```

### Discovery Logic

```typescript
// From core/scripts/build/registry.mjs
async function discoverTranslations(themeName: string) {
  const translations: Record<string, string[]> = {}
  
  // Discover theme-level translations
  const messagesPath = join(themesDir, themeName, 'messages')
  if (existsSync(messagesPath)) {
    const files = await readdir(messagesPath)
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const locale = file.replace('.json', '')
        translations[locale] = translations[locale] || []
        translations[locale].push(`@/contents/themes/${themeName}/messages/${file}`)
      }
    }
  }
  
  // Discover entity translations
  const entitiesPath = join(themesDir, themeName, 'entities')
  if (existsSync(entitiesPath)) {
    const entities = await readdir(entitiesPath)
    
    for (const entity of entities) {
      const entityMessagesPath = join(entitiesPath, entity, 'messages')
      if (existsSync(entityMessagesPath)) {
        const files = await readdir(entityMessagesPath)
        
        for (const file of files) {
          if (file.endsWith('.json')) {
            const locale = file.replace('.json', '')
            translations[locale] = translations[locale] || []
            translations[locale].push(`@/contents/themes/${themeName}/entities/${entity}/messages/${file}`)
          }
        }
      }
    }
  }
  
  return translations
}
```

---

## Translation Loader Functions

### getThemeTranslationLoader()

**Get lazy-loading function** for a specific theme and locale:

```typescript
import { getThemeTranslationLoader } from '@/core/lib/registries/translation-registry'

// Get loader (doesn't load yet)
const loader = getThemeTranslationLoader('default', 'en')

if (loader) {
  // Execute loader to get translations
  const translations = await loader()
  console.log(translations)  // { default: { key: 'value', ... } }
}
```

### loadThemeTranslation()

**Convenience wrapper** that gets loader and executes it:

```typescript
import { loadThemeTranslation } from '@/core/lib/registries/translation-registry'

// Load translations for theme and locale
const translations = await loadThemeTranslation('default', 'en')

// Returns empty object if not found
console.log(translations)  // { key: 'value', ... }
```

### getThemeLocales()

**Get available locales** for a theme:

```typescript
import { getThemeLocales } from '@/core/lib/registries/translation-registry'

const locales = getThemeLocales('default')
console.log(locales)  // ['en', 'es']
```

### getThemesWithTranslations()

**Get all themes** that have translations:

```typescript
import { getThemesWithTranslations } from '@/core/lib/registries/translation-registry'

const themes = getThemesWithTranslations()
console.log(themes)  // ['default', 'custom-theme']
```

### hasThemeTranslation()

**Check if translation exists** for theme and locale:

```typescript
import { hasThemeTranslation } from '@/core/lib/registries/translation-registry'

if (hasThemeTranslation('default', 'fr')) {
  // French translations available
  const translations = await loadThemeTranslation('default', 'fr')
}
```

---

## Integration with next-intl

### next-intl Configuration

```typescript
// core/i18n.ts
import { getRequestConfig } from 'next-intl/server'
import { loadThemeTranslation } from '@/core/lib/registries/translation-registry'

export default getRequestConfig(async ({ locale }) => {
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME || 'default'
  
  // Load translations from registry (lazy-loaded)
  const translations = await loadThemeTranslation(activeTheme, locale)
  
  return {
    messages: translations,
    timeZone: 'America/New_York',
    now: new Date()
  }
})
```

### Usage in Components

```typescript
// Server Component
import { useTranslations } from 'next-intl'

export default function ServerPage() {
  const t = useTranslations('common')
  
  return <h1>{t('welcome')}</h1>
}

// Client Component
'use client'

import { useTranslations } from 'next-intl'

export function ClientComponent() {
  const t = useTranslations('tasks')
  
  return <button>{t('create')}</button>
}
```

---

## Translation Merging Strategy

### Priority Order

**When same key exists in multiple sources:**

```text
Core > Theme > Plugin > Entity

Examples:
- Key 'welcome' in core AND theme → Core wins
- Key 'tasks.create' in theme AND entity → Theme wins
- Key 'ai.generate' in plugin AND entity → Plugin wins
```

### Merge Logic

```typescript
// Conceptual merging (handled by next-intl)
const mergedTranslations = {
  ...entityTranslations,      // Lowest priority
  ...pluginTranslations,
  ...themeTranslations,
  ...coreTranslations         // Highest priority
}
```

**Why this order?**
- Core translations are system-wide (must be consistent)
- Theme can customize for specific branding
- Plugins provide specialized terminology
- Entities have specific context

---

## Real-World Examples

### Example 1: Multi-Language Support

```typescript
// app/[locale]/layout.tsx
import { loadThemeTranslation } from '@/core/lib/registries/translation-registry'
import { notFound } from 'next/navigation'

const supportedLocales = ['en', 'es', 'fr', 'pt']

export async function generateStaticParams() {
  return supportedLocales.map((locale) => ({ locale }))
}

export default async function LocaleLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: { locale: string }
}) {
  const { locale } = params
  
  // Validate locale
  if (!supportedLocales.includes(locale)) {
    notFound()
  }
  
  // Load translations (lazy-loaded, only active locale)
  const translations = await loadThemeTranslation('default', locale)
  
  return (
    <html lang={locale}>
      <body>
        <NextIntlClientProvider messages={translations}>
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
```

### Example 2: Locale Switcher

```typescript
'use client'

import { getThemeLocales } from '@/core/lib/registries/translation-registry'
import { useRouter, usePathname } from 'next/navigation'

export function LocaleSwitcher() {
  const router = useRouter()
  const pathname = usePathname()
  const locales = getThemeLocales('default')
  
  const handleLocaleChange = (newLocale: string) => {
    // Extract current locale from pathname
    const currentLocale = pathname.split('/')[1]
    
    // Replace locale in pathname
    const newPathname = pathname.replace(`/${currentLocale}`, `/${newLocale}`)
    
    router.push(newPathname)
  }
  
  return (
    <select onChange={(e) => handleLocaleChange(e.target.value)}>
      {locales.map((locale) => (
        <option key={locale} value={locale}>
          {locale.toUpperCase()}
        </option>
      ))}
    </select>
  )
}
```

### Example 3: Fallback Translations

```typescript
import { loadThemeTranslation, hasThemeTranslation } from '@/core/lib/registries/translation-registry'

async function getTranslationsWithFallback(theme: string, locale: string) {
  // Try to load requested locale
  if (hasThemeTranslation(theme, locale)) {
    return await loadThemeTranslation(theme, locale)
  }
  
  // Fallback to English
  if (hasThemeTranslation(theme, 'en')) {
    console.warn(`Locale '${locale}' not found, falling back to 'en'`)
    return await loadThemeTranslation(theme, 'en')
  }
  
  // No translations available
  console.error(`No translations found for theme '${theme}'`)
  return {}
}
```

### Example 4: Translation Coverage Report

```typescript
import {
  getThemesWithTranslations,
  getThemeLocales,
  loadThemeTranslation
} from '@/core/lib/registries/translation-registry'

export async function generateTranslationReport() {
  const themes = getThemesWithTranslations()
  const report: Record<string, any> = {}
  
  for (const theme of themes) {
    const locales = getThemeLocales(theme)
    report[theme] = {}
    
    for (const locale of locales) {
      const translations = await loadThemeTranslation(theme, locale)
      const keyCount = Object.keys(translations).length
      
      report[theme][locale] = {
        keyCount,
        keys: Object.keys(translations)
      }
    }
  }
  
  return report
}

// Usage
const report = await generateTranslationReport()
console.log(report)
// {
//   'default': {
//     'en': { keyCount: 120, keys: [...] },
//     'es': { keyCount: 115, keys: [...] }
//   }
// }
```

---

## Translation File Structure

### Theme-Level Translations

```json
// contents/themes/default/messages/en.json
{
  "common": {
    "welcome": "Welcome",
    "save": "Save",
    "cancel": "Cancel"
  },
  "navigation": {
    "home": "Home",
    "dashboard": "Dashboard",
    "settings": "Settings"
  }
}
```

### Entity-Level Translations

```json
// contents/themes/default/entities/tasks/messages/en.json
{
  "tasks": {
    "title": "Tasks",
    "create": "Create Task",
    "edit": "Edit Task",
    "delete": "Delete Task",
    "status": {
      "todo": "To Do",
      "in-progress": "In Progress",
      "done": "Done"
    }
  }
}
```

### Plugin-Level Translations

```json
// contents/plugins/ai/messages/en.json
{
  "ai": {
    "generate": "Generate",
    "enhance": "Enhance",
    "analyze": "Analyze",
    "suggestions": "Suggestions"
  }
}
```

---

## Translation Metadata

### Registry Metadata

```typescript
export const TRANSLATION_METADATA = {
  totalThemes: 1,
  totalTranslations: 2,
  generatedAt: '2025-11-20T02:53:31.034Z',
  themes: ['default']
}
```

### Usage in Application

```typescript
import { TRANSLATION_METADATA } from '@/core/lib/registries/translation-registry'

console.log(`Total themes with translations: ${TRANSLATION_METADATA.totalThemes}`)
console.log(`Total translation files: ${TRANSLATION_METADATA.totalTranslations}`)
console.log(`Last generated: ${TRANSLATION_METADATA.generatedAt}`)
```

---

## Performance Characteristics

### Lazy Loading Benefits

```typescript
// ❌ BAD: Load all locales (slow)
import enTranslations from '@/messages/en.json'
import esTranslations from '@/messages/es.json'
import frTranslations from '@/messages/fr.json'
import ptTranslations from '@/messages/pt.json'
// Total: ~200KB bundle size

// ✅ GOOD: Load only active locale (fast)
const loader = THEME_TRANSLATION_LOADERS.default.en
const translations = await loader()
// Total: ~50KB bundle size (only en.json)
```

### Zero Runtime Interpolation

```typescript
// ❌ BAD: Runtime string interpolation (slow)
const loader = () => import(`@/contents/themes/${themeName}/messages/${locale}.json`)

// ✅ GOOD: Build-time static paths (fast)
const loader = THEME_TRANSLATION_LOADERS.default.en
// No string concatenation, no runtime path resolution
```

### Build-Time Validation

```typescript
// Build script validates:
// - All translation files are valid JSON
// - Import paths are correct
// - No missing files
// - Compilation errors caught early

// Runtime has zero validation overhead
```

---

## Best Practices

### ✅ DO: Use Helper Functions

```typescript
import { loadThemeTranslation, hasThemeTranslation } from '@/core/lib/registries/translation-registry'

// Check before loading
if (hasThemeTranslation('default', 'fr')) {
  const translations = await loadThemeTranslation('default', 'fr')
}
```

### ✅ DO: Implement Fallbacks

```typescript
const translations = await loadThemeTranslation('default', locale)

// Always provide fallback
const messages = translations || defaultTranslations || {}
```

### ✅ DO: Lazy Load Only Active Locale

```typescript
// Get loader for active locale
const activeLocale = 'en'
const loader = getThemeTranslationLoader('default', activeLocale)

// Load only when needed
const translations = await loader()
```

### ❌ DON'T: Import Translation Files Directly

```typescript
// ❌ FORBIDDEN
import enTranslations from '@/contents/themes/default/messages/en.json'

// ✅ CORRECT
import { loadThemeTranslation } from '@/core/lib/registries/translation-registry'
const translations = await loadThemeTranslation('default', 'en')
```

### ❌ DON'T: Load All Locales

```typescript
// ❌ BAD - Loads everything
const allTranslations = {}
for (const locale of ['en', 'es', 'fr', 'pt']) {
  allTranslations[locale] = await loadThemeTranslation('default', locale)
}

// ✅ GOOD - Load only active locale
const activeTranslations = await loadThemeTranslation('default', activeLocale)
```

---

## Troubleshooting

### Translations Not Found

**Problem:** `loadThemeTranslation('default', 'fr')` returns empty object

**Solutions:**
1. Check `messages/fr.json` exists in theme
2. Verify JSON is valid
3. Run `pnpm registry:build` to regenerate
4. Restart dev server

### Wrong Locale Loaded

**Problem:** English translations showing when Spanish requested

**Solutions:**
1. Check `locale` parameter is correct
2. Verify `NEXT_PUBLIC_ACTIVE_THEME` is set
3. Check next-intl configuration in `core/i18n.ts`
4. Clear browser cache

### Translation Key Missing

**Problem:** Translation key not found in loaded translations

**Solutions:**
1. Check key exists in JSON file
2. Verify JSON structure matches usage
3. Check for typos in translation key
4. Implement fallback translations

---

## Type Safety

```typescript
import type { TranslationLoader } from '@/core/lib/registries/translation-registry'

// Strongly typed loader
const loader: TranslationLoader = getThemeTranslationLoader('default', 'en')

// Type-safe translations
const translations: Record<string, unknown> = await loadThemeTranslation('default', 'en')
```

---

## Next Steps

- **[Route Handlers Registry](./07-route-handlers-registry.md)** - API route handling
- **[Performance & Caching](./08-performance-and-caching.md)** - Optimization strategies
- **[Theme Registry](./04-theme-registry.md)** - Theme system integration
- **[Plugin Registry](./05-plugin-registry.md)** - Plugin translations

---

**Last Updated**: 2025-11-20  
**Version**: 1.0.0  
**Status**: Complete  
**Auto-Generated**: Yes (by core/scripts/build/registry.mjs)  
**Registry File**: `core/lib/registries/translation-registry.ts`  
**Integration**: next-intl v3.x
