# Setup and Configuration

> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.

## Introduction

The internationalization (i18n) setup in NextSpark is built on **next-intl** v4.3.4 with a sophisticated configuration system that supports locale detection, namespace optimization, and build-time registry integration. This document covers everything you need to know to configure, customize, and extend the i18n system.

The configuration architecture follows a layered approach: core defaults can be overridden by theme-specific settings, providing flexibility while maintaining sensible defaults out of the box.

---

## Core Configuration Structure

### I18N_CONFIG Object

The i18n system is configured through a central configuration object located in `core/lib/config/app.config.ts`:

**Location**: `core/lib/config/app.config.ts`

```typescript
export const DEFAULT_APP_CONFIG: AppConfig = {
  i18n: {
    /**
     * Supported locales for your project
     * Add/remove locales as needed
     */
    supportedLocales: ['en', 'es'],

    /**
     * Default fallback locale
     */
    defaultLocale: 'en',

    /**
     * Cookie settings for locale persistence
     */
    cookie: {
      name: 'locale',
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: false,
      secure: 'auto',
      sameSite: 'lax',
      path: '/',
    },

    /**
     * Translation namespaces for your project
     * Add/remove namespaces based on your app structure
     */
    namespaces: [
      'common',      // Shared UI elements, buttons, navigation
      'dashboard',   // Dashboard-specific content
      'settings',    // Settings pages
      'auth',        // Authentication flows
      'public',      // Public pages (home, pricing, etc.)
      'validation'   // Form validation messages
    ],

    /**
     * Performance optimizations
     */
    performance: {
      preloadCriticalNamespaces: ['common', 'dashboard'],
    }
  }
}
```

**Access Configuration**:
```typescript
// Import merged configuration (includes theme overrides)
import { I18N_CONFIG, type SupportedLocale } from '@/core/lib/config'

// Use in your code
const defaultLocale = I18N_CONFIG.defaultLocale // 'en'
const supported = I18N_CONFIG.supportedLocales // ['en', 'es']
```

---

## Configuration Properties

### Supported Locales

**Property**: `supportedLocales`
**Type**: `readonly string[]`
**Default**: `['en', 'es']`

Defines which locales your application supports. Add or remove locales based on your requirements:

```typescript
// Example: Adding French and German
supportedLocales: ['en', 'es', 'fr', 'de']
```

**Important**: When adding a new locale:
1. Add the locale code to `supportedLocales`
2. Create translation files for the locale:
   - `core/messages/{locale}/` - Core namespaces
   - `messages/{locale}.json` - Theme translations
3. Rebuild the registry: `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs`

### Default Locale

**Property**: `defaultLocale`
**Type**: `string`
**Default**: `'en'`

The fallback locale used when:
- Locale detection fails
- User's preferred locale is not supported
- No locale preference is set

```typescript
defaultLocale: 'en'
```

**Best Practice**: Always use a locale with complete translations as the default.

### Cookie Configuration

**Property**: `cookie`
**Type**: `object`

Cookie settings for persisting user locale preference:

```typescript
cookie: {
  name: 'locale',                         // Cookie name
  maxAge: 365 * 24 * 60 * 60 * 1000,     // 1 year in milliseconds
  httpOnly: false,                        // Not applied: the cookie is always readable
  secure: 'auto',                         // HTTPS only in production
  sameSite: 'lax',                        // CSRF protection
  path: '/',                              // Cookie available on all paths
}
```

**Cookie Properties**:

| Property | Type | Description |
|----------|------|-------------|
| `name` | string | Cookie identifier (default: `'locale'`) |
| `maxAge` | number | Cookie lifetime in milliseconds |
| `httpOnly` | boolean | Not applied: the locale cookie is always written readable, because client code rewrites it (a language switch, a sign-in, the account's language) |
| `secure` | 'auto' \| boolean | Require HTTPS (auto enables in production only) |
| `sameSite` | 'strict' \| 'lax' \| 'none' | CSRF protection level |
| `path` | string | Cookie scope (default: `'/'`) |

### Translation Namespaces

**Property**: `namespaces`
**Type**: `readonly string[]`
**Default**: `['common', 'dashboard', 'settings', 'auth', 'public', 'validation']`

Namespaces organize translations into logical groups for efficient lazy-loading:

```typescript
namespaces: [
  'common',      // Shared UI: buttons, navigation, common labels
  'dashboard',   // Dashboard-specific content
  'settings',    // User settings pages
  'auth',        // Authentication flows (login, signup, etc.)
  'public',      // Public pages (landing, pricing, docs)
  'validation'   // Form validation messages
]
```

**Adding a New Namespace**:

1. **Update Configuration**:
```typescript
// core/lib/config/app.config.ts
namespaces: [
  'common',
  'dashboard',
  'billing',  // NEW NAMESPACE
  // ...
]
```

2. **Create Translation Files**:
```bash
# English
core/messages/en/billing.json

# Spanish
core/messages/es/billing.json
```

3. **Add Translations**:
```json
// core/messages/en/billing.json
{
  "subscription": {
    "title": "Subscription",
    "currentPlan": "Current Plan",
    "upgrade": "Upgrade Plan"
  },
  "invoices": {
    "title": "Invoices",
    "download": "Download Invoice"
  }
}
```

4. **Use in Components**:
```typescript
import { useTranslations } from 'next-intl'

export function BillingPage() {
  const t = useTranslations('billing')
  return <h1>{t('subscription.title')}</h1>
}
```

### Performance Configuration

**Property**: `performance`
**Type**: `object`

Optimization settings for translation loading:

```typescript
performance: {
  preloadCriticalNamespaces: ['common', 'dashboard'],
}
```

**Preload Critical Namespaces**:
Namespaces listed here are loaded immediately on app initialization, avoiding lazy-load delays for frequently used translations.

**Recommendation**: Only preload namespaces used on every page (typically `common` and initial route namespace).

---

## next-intl Integration

### Request Configuration

The i18n system integrates with next-intl through `core/i18n.ts`:

**Location**: `core/i18n.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'
import { I18N_CONFIG } from './lib/config'
import { loadMergedTranslations } from './lib/translations/registry'
import { getUserLocale } from './lib/locale'

export default getRequestConfig(async ({ locale: requestedLocale }) => {
  // getMessages({ locale }) and the root layout pass the locale they resolved
  const locale = I18N_CONFIG.supportedLocales.includes(requestedLocale)
    ? requestedLocale
    : await getUserLocale()

  // Core → theme → entity translations for the locale
  const messages = await loadMergedTranslations(locale)

  return { locale, messages }
})
```

**How It Works**:

1. **Locale**: Uses the locale the caller passes, or `getUserLocale()`. The config reads nothing from the request itself (no `headers()`), so it never makes a page dynamic on its own.
2. **Translation Loading**: Loads the merged translations (core + theme + entities) for the locale
3. **next-intl Configuration**: Returns locale and messages to next-intl

### next.config.js Configuration

next-intl requires configuration in your Next.js config:

**Location**: `next.config.js` or `next.config.ts`

```typescript
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./core/i18n.ts')

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Your Next.js config...
}

export default withNextIntl(nextConfig)
```

**Plugin Path**: Points to `core/i18n.ts` where the request configuration is defined.

---

## Locale Detection Strategy

`getUserLocale()` (`core/lib/locale.ts`) resolves the locale once per request (React `cache()`), in this order:

```text
0. Fixed locale → defaultLocale, without reading the request
1. Locale cookie
2. Signed-in user's language (session, only with a session cookie)
3. Accept-Language header
4. Default locale
```

#### 0. Fixed Locale

**When**: `supportedLocales` has a single entry, or `app.config.ts` sets `i18n.localeDetection: false`.
**Effect**: Every page renders `defaultLocale`, and nothing is read from the request, so pages can be prerendered.

#### 1. Locale Cookie

**Source**: Cookie named `locale` (configurable via `I18N_CONFIG.cookie.name`)
**Scope**: Anonymous and authenticated users
**Persistence**: 1 year (configurable via `I18N_CONFIG.cookie.maxAge`)

It is written when the language changes in the profile, when a user signs in with email or a one-time code, and by `<SessionCookieRefresher />` when the account's language changed elsewhere (see [Locale Switching](./06-locale-switching.md)).

```text
Name:     locale
Value:    es
MaxAge:   31536000000 (1 year)
Path:     /
SameSite: lax
Secure:   true (production only)
```

#### 2. Signed-in User's Language

**Source**: `session.user.language` (a Better Auth user field, stored in `users.language`)
**When Used**: No locale cookie, and the request carries a Better Auth session cookie (`better-auth.session_token`, `__Secure-` prefixed over HTTPS). A request without one reads no session at all.

#### 3. Accept-Language Header

**Source**: Browser `Accept-Language` HTTP header
**Matching**: Ranges are ranked by quality, then order; a full tag (`pt-BR`) matches before its language (`pt`).

```text
Accept-Language: fr;q=0.9, es-AR, es;q=0.8
→ es (es-AR has the highest quality; es-AR is not supported, es is)
```

#### 4. Default Locale Fallback

**Source**: `I18N_CONFIG.defaultLocale`
**When Used**: Nothing above matched, or there is no request (static generation).

### Setting User Locale

**Function**: `setUserLocale(locale: string)`
**Location**: `core/lib/locale.ts`

Sets the locale cookie with proper configuration:

```typescript
import { setUserLocale } from '@/core/lib/locale'

// Set locale to Spanish
await setUserLocale('es')

// Cookie is automatically set with configuration:
// - Name: 'locale'
// - Value: 'es'
// - Expires: 1 year from now
// - Secure: auto (based on environment)
// - SameSite: 'lax'
```

**Validation**:
```typescript
// Throws error if locale not supported
await setUserLocale('fr') // Error: Unsupported locale: fr
```

**Use Case**: Locale selector component
```typescript
export function LocaleSelector() {
  const handleLocaleChange = async (newLocale: string) => {
    await setUserLocale(newLocale)
    window.location.reload() // Reload to apply new locale
  }

  return (
    <select onChange={(e) => handleLocaleChange(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  )
}
```

---

## Namespace Groups (not applied)

`core/i18n.ts` still exports `NAMESPACE_GROUPS` and `getPageNamespaces(pathname)`, and `loadOptimizedTranslations(locale, pathname)` exists in `core/lib/translations/i18n-integration.ts`, but none of them decides what a request loads: every request gets the merged catalog (core → theme → entities) for its locale, and the root layout passes it to `NextIntlClientProvider`. They are deprecated and kept only for code that imports them.

Choosing namespaces from the request's pathname would mean reading request headers, which makes every page dynamic, so the request config does not do it.

## Request-hook integration

A project may extend request handling with the optional root-first hook at
`config/hooks/proxy.ts`. It must export a named `proxyHook`; the framework-owned
root `proxy.ts` composes it with authentication, route protection, and locale
handling.

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function proxyHook(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('x-pathname', request.nextUrl.pathname)
  return response
}
```

The project hook is an extension point, not a replacement security boundary.
Do not create a project-root `middleware.ts` or replace the framework proxy to
customize locale handling.

## Environment Variables

### Required Variables

None required - i18n system works with default configuration.

### Optional Variables

No project-selection variable exists. Locale behavior comes from root-level project configuration.

### Build-Time Variables

**NODE_ENV**:
- `development`: Enables debug logging, validation warnings
- `production`: Disables debug output, optimizes performance

---

## Theme Configuration Overrides

Themes can override i18n configuration:

**Location**: `app.config.ts`

```typescript
import type { AppConfig } from '@/core/lib/config/types'

export const themeAppConfig: Partial<AppConfig> = {
  i18n: {
    // Override default locale
    defaultLocale: 'es',

    // Add additional namespaces
    namespaces: [
      'common',
      'dashboard',
      'settings',
      'auth',
      'public',
      'validation',
      'custom-theme-namespace'  // Theme-specific namespace
    ],

    // Override cookie settings
    cookie: {
      name: 'theme-locale',
      maxAge: 180 * 24 * 60 * 60 * 1000, // 6 months
    }
  }
}
```

**Merge Behavior**:
```typescript
// Core default
defaultLocale: 'en'

// Theme override
defaultLocale: 'es'

// Merged result
defaultLocale: 'es'  // Theme wins
```

**Access Merged Config**:
```typescript
import { I18N_CONFIG } from '@/core/lib/config'

// Automatically includes theme overrides
const locale = I18N_CONFIG.defaultLocale // 'es' (from theme)
```

---

## TypeScript Types

### SupportedLocale

Type representing supported locale codes:

```typescript
import type { SupportedLocale } from '@/core/lib/config'

// Type: 'en' | 'es'
const locale: SupportedLocale = 'en'

// Type-safe function parameter
function loadMessages(locale: SupportedLocale) {
  // ...
}
```

### TranslationNamespace

Type representing valid namespace names:

```typescript
import type { TranslationNamespace } from '@/core/lib/config'

// Type: 'common' | 'dashboard' | 'settings' | 'auth' | 'public' | 'validation'
const namespace: TranslationNamespace = 'common'

// Type-safe hook
const t = useTranslations<TranslationNamespace>('dashboard')
```

### AppConfig

Complete application configuration type:

```typescript
import type { AppConfig } from '@/core/lib/config/types'

const config: AppConfig = {
  app: {
    name: 'My SaaS',
    version: '1.0.0',
  },
  i18n: {
    supportedLocales: ['en', 'es'],
    defaultLocale: 'en',
    // ...
  },
  // ...
}
```

---

## Adding a New Locale

### Step-by-Step Guide

**1. Update Configuration**:
```typescript
// core/lib/config/app.config.ts
i18n: {
  supportedLocales: ['en', 'es', 'fr'], // Add 'fr'
  defaultLocale: 'en',
  // ...
}
```

**2. Create Core Translation Files**:
```bash
# Create directory
mkdir -p core/messages/fr

# Create namespace files
touch core/messages/fr/common.json
touch core/messages/fr/dashboard.json
touch core/messages/fr/settings.json
touch core/messages/fr/auth.json
touch core/messages/fr/public.json
touch core/messages/fr/validation.json
```

**3. Add Translations**:
```json
// core/messages/fr/common.json
{
  "buttons": {
    "save": "Enregistrer",
    "cancel": "Annuler",
    "delete": "Supprimer"
  },
  "navigation": {
    "home": "Accueil",
    "dashboard": "Tableau de bord",
    "settings": "Paramètres"
  }
}
```

**4. Add Theme Translations**:
```json
// messages/fr.json
{
  "home": {
    "hero": {
      "title": "Modèle SaaS Moderne",
      "description": "Démarrage prêt pour la production..."
    }
  }
}
```

**5. Rebuild Registry**:
```bash
cd apps/dev && node ../../packages/core/scripts/build/registry.mjs
```

**6. Update Locale Selector**:
```typescript
export function LocaleSelector() {
  return (
    <select>
      <option value="en">English</option>
      <option value="es">Español</option>
      <option value="fr">Français</option> {/* NEW */}
    </select>
  )
}
```

**7. Test**:
```bash
# Visit app and switch locale
# Verify all translations load correctly
```

---

## Troubleshooting

### Common Issues

#### Issue: "Locale not found" Error

**Symptom**:
```text
Error: Locale 'fr' not found in supported locales
```

**Solution**:
1. Verify locale is in `I18N_CONFIG.supportedLocales`
2. Check spelling matches exactly (`'fr'` not `'FR'`)
3. Rebuild registry: `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs`

#### Issue: Missing Translations

**Symptom**:
```text
Warning: Missing translation key "auth.login.title" for locale "es"
```

**Solution**:
1. Create translation file if missing
2. Add missing key to translation file
3. Verify JSON syntax is valid
4. Rebuild registry

#### Issue: Cookie Not Persisting

**Symptom**: Locale resets on page refresh

**Solution**:
1. Check cookie configuration in `I18N_CONFIG.cookie`
2. Check that nothing else writes a `locale` cookie with `HttpOnly`: client code cannot replace it
3. Check browser cookie settings
4. Verify `secure` setting matches environment (HTTPS in production)

#### Issue: Wrong Locale Detected

**Symptom**: User sees unexpected locale

**Solution**:
1. Check locale detection priority (cookie > account language > Accept-Language > default)
2. Verify user profile `language` column
3. Clear cookies and test
4. Check `Accept-Language` header

### Debug Mode

Enable detailed logging:

```typescript
// core/i18n.ts (temporarily add for debugging)
console.log('[i18n] Detected locale:', locale)
console.log('[i18n] Loaded namespaces:', Object.keys(messages))
console.log('[i18n] Pathname:', pathname)
```

---

## Best Practices

### Configuration

✅ **DO**:
- Use descriptive namespace names
- Keep default locale with complete translations
- Set appropriate cookie expiration (1 year for long-term projects)
- Enable `secure: 'auto'` for automatic HTTPS in production

❌ **DON'T**:
- Change `supportedLocales` without adding translation files
- Use abbreviations in namespace names
- Write the locale cookie `HttpOnly` from your own code: client code keeps it in line with the account and cannot replace it
- Add too many namespaces (increases complexity)

### Locale Detection

✅ **DO**:
- Respect user database preference (highest priority)
- Provide locale selector UI
- Store preference in database for authenticated users
- Use cookie for anonymous users

❌ **DON'T**:
- Override user preference without consent
- Rely solely on `Accept-Language` header
- Change locale automatically based on IP geolocation (ask user first)

### Namespace Organization

✅ **DO**:
- Group related translations in same namespace
- Use route-based namespace loading
- Preload only critical namespaces
- Keep namespaces under 20KB

❌ **DON'T**:
- Mix unrelated translations in one namespace
- Load all namespaces on every page
- Create too many granular namespaces
- Duplicate translations across namespaces

### Performance

✅ **DO**:
- Use build-time registry (zero runtime I/O)
- Leverage route-based namespace optimization
- Lazy-load non-critical namespaces
- Monitor bundle size impact

❌ **DON'T**:
- Use dynamic imports for translations (use registry)
- Load unused namespaces
- Skip registry rebuild after changes
- Import project translation files directly (use the generated registry)

---

## Next Steps

Now that you've configured the i18n system, learn about:

- **[Translation Keys](./03-translation-keys.md)** - Naming conventions, validation, and best practices
- **[Translation Sources](./04-translation-sources.md)** - Managing core, theme, and plugin translations
- **[Translation Registry](./05-translation-registry.md)** - Build-time optimization and performance
- **[Locale Switching](./06-locale-switching.md)** - Implementing user locale selection
- **[Advanced Patterns](./07-advanced-patterns.md)** - Pluralization, formatting, and dynamic values
- **[Testing Translations](./08-testing-translations.md)** - Ensure translation quality and completeness

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
