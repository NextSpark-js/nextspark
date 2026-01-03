# Setup and Configuration

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
   - `contents/themes/{theme}/messages/{locale}.json` - Theme translations
3. Rebuild the registry: `pnpm registry:build`

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
  httpOnly: false,                        // Allow client-side JavaScript access
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
| `httpOnly` | boolean | Prevent JavaScript access (false for client-side locale switching) |
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
import { I18N_CONFIG } from '@/core/lib/config'
import { loadAllI18nTranslations } from '@/core/lib/translations/i18n-integration'
import { getUserLocale } from './lib/locale'
import type { SupportedLocale } from '@/core/lib/entities/types'

export default getRequestConfig(async () => {
  // Detect user locale (database → cookie → header → default)
  const locale = await getUserLocale()

  // Load all translations for the detected locale
  const messages = await loadAllI18nTranslations(locale as SupportedLocale)

  return {
    locale,
    messages
  }
})
```

**How It Works**:

1. **Locale Detection**: Calls `getUserLocale()` to determine the user's preferred locale
2. **Translation Loading**: Loads all translations (core + theme + plugin) for the locale
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

The system employs a 4-tier locale detection strategy with clear priority:

### Priority Order

```text
1. Database User Preference (authenticated users)
       ↓
2. Cookie (NEXT_LOCALE)
       ↓
3. Accept-Language Header (browser preference)
       ↓
4. Default Locale (fallback)
```

### Implementation

**Location**: `core/lib/locale.ts`

```typescript
export async function getUserLocale(): Promise<SupportedLocale> {
  // 1. Check user profile from database (highest priority)
  try {
    const session = await auth.api.getSession({ headers: await headers() })

    if (session?.user?.id) {
      const user = await queryOne<{ language: string }>(
        'SELECT language FROM "users" WHERE id = $1',
        [session.user.id]
      )

      if (user?.language && I18N_CONFIG.supportedLocales.includes(user.language as SupportedLocale)) {
        return user.language as SupportedLocale
      }
    }
  } catch (error) {
    // Continue to next detection method
  }

  // 2. Check cookie
  try {
    const cookieStore = await cookies()
    const cookieLocale = cookieStore.get(I18N_CONFIG.cookie.name)?.value

    if (cookieLocale && I18N_CONFIG.supportedLocales.includes(cookieLocale as SupportedLocale)) {
      return cookieLocale as SupportedLocale
    }
  } catch (error) {
    // Continue to next detection method
  }

  // 3. Check Accept-Language header
  try {
    const headersList = await headers()
    const acceptLanguage = headersList.get('accept-language')

    if (acceptLanguage) {
      const preferredLocale = acceptLanguage.split(',')[0].split('-')[0] as SupportedLocale
      if (I18N_CONFIG.supportedLocales.includes(preferredLocale)) {
        return preferredLocale
      }
    }
  } catch (error) {
    // Continue to fallback
  }

  // 4. Default to configured default locale
  return I18N_CONFIG.defaultLocale
}
```

### Detection Method Details

#### 1. Database User Preference

**Source**: `users` table, `language` column
**Scope**: Authenticated users only
**Persistence**: Permanent (stored in database)

**When Used**:
- User is logged in
- User has set a language preference in their profile
- Language value is in `supportedLocales`

**Example**:
```sql
SELECT language FROM users WHERE id = 'user_123'
-- Returns: 'es' (Spanish)
```

#### 2. Cookie Preference

**Source**: Cookie named `locale` (configurable via `I18N_CONFIG.cookie.name`)
**Scope**: Anonymous and authenticated users
**Persistence**: 1 year (configurable via `I18N_CONFIG.cookie.maxAge`)

**When Used**:
- No database preference (user not logged in OR no preference set)
- Cookie exists and contains valid locale

**Cookie Structure**:
```text
Name:     locale
Value:    es
MaxAge:   31536000000 (1 year)
Path:     /
SameSite: lax
Secure:   true (production only)
```

#### 3. Accept-Language Header

**Source**: Browser `Accept-Language` HTTP header
**Scope**: All users (browser setting)
**Persistence**: Browser-level (not application-controlled)

**When Used**:
- No database or cookie preference
- Browser sends `Accept-Language` header
- First language in header is supported

**Example Header**:
```text
Accept-Language: es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7
```

**Parsing Logic**:
```typescript
// Extract: 'es-AR,es;q=0.9,en-US;q=0.8,en;q=0.7'
const preferredLocale = acceptLanguage.split(',')[0].split('-')[0]
// Result: 'es'
```

#### 4. Default Locale Fallback

**Source**: `I18N_CONFIG.defaultLocale`
**Scope**: All users
**Persistence**: Application configuration

**When Used**:
- All detection methods fail
- User preference is not in `supportedLocales`
- Static site generation (no request context)

**Always Returns**: `'en'` (or configured default)

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

## Namespace Optimization Strategy

The i18n system includes intelligent namespace loading based on the current route to minimize initial bundle size.

### Namespace Groups

**Location**: `core/i18n.ts`

```typescript
const NAMESPACE_GROUPS = {
  // Public pages: includes auth for login/signup buttons
  PUBLIC_INITIAL: ['common', 'public', 'auth'],

  // Dashboard: authenticated users don't need auth namespace
  DASHBOARD_AUTHENTICATED: ['common', 'dashboard', 'settings', 'public'],

  // Auth pages: focused on authentication flows
  AUTH_ONLY: ['common', 'auth', 'validation'],

  // Fallback: all namespaces for edge cases
  ALL: ['common', 'dashboard', 'settings', 'auth', 'public', 'validation']
}
```

### Route-Based Loading

**Function**: `getPageNamespaces(pathname: string)`

Determines which namespaces to load based on the current route:

```typescript
function getPageNamespaces(pathname: string): string[] {
  // Dashboard pages - authenticated users
  if (pathname.startsWith('/dashboard')) {
    return NAMESPACE_GROUPS.DASHBOARD_AUTHENTICATED
    // Loads: common, dashboard, settings, public
  }

  // Auth pages - login, signup, password reset
  if (pathname === '/login' || pathname === '/signup' ||
      pathname.includes('auth')) {
    return NAMESPACE_GROUPS.AUTH_ONLY
    // Loads: common, auth, validation
  }

  // Public pages - landing, pricing, docs
  if (pathname === '/' || pathname.startsWith('/pricing') ||
      pathname.startsWith('/docs')) {
    return NAMESPACE_GROUPS.PUBLIC_INITIAL
    // Loads: common, public, auth (for login/signup buttons)
  }

  // Unknown routes - public fallback
  return NAMESPACE_GROUPS.PUBLIC_INITIAL
}
```

### Performance Impact

**Without Optimization** (loading all namespaces):
```text
Initial bundle: ~37KB (all 6 namespaces)
Parse time:     ~15ms
```

**With Optimization** (route-based loading):
```text
Landing page:  ~18KB (common + public + auth)
Dashboard:     ~25KB (common + dashboard + settings + public)
Auth pages:    ~16KB (common + auth + validation)

Average savings: ~40-50% bundle size reduction
```

**Benefits**:
- Faster initial page load
- Reduced JavaScript parse time
- Lower memory footprint
- Better Core Web Vitals scores

---

## Middleware Integration

The middleware system supports locale handling and theme-specific overrides.

**Location**: `middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { hasThemeMiddleware, executeThemeMiddleware } from '@/core/lib/registries/middleware-registry'

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // 1. Check for theme middleware override
  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME
  if (activeTheme && hasThemeMiddleware(activeTheme)) {
    const themeResponse = await executeThemeMiddleware(activeTheme, request)
    if (themeResponse) {
      return themeResponse
    }
  }

  // 2. Core middleware logic
  // (authentication, route protection, etc.)

  // 3. Continue to page
  return NextResponse.next()
}
```

### Pathname Injection

The middleware injects pathname into headers for namespace optimization:

```typescript
export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Inject pathname for i18n optimization
  response.headers.set('x-pathname', request.nextUrl.pathname)

  return response
}
```

**Usage in i18n.ts**:
```typescript
const headersList = await headers()
const pathname = headersList.get('x-pathname') || ''

// Use pathname for namespace optimization
const namespaces = getPageNamespaces(pathname)
```

### Theme Middleware Override

Themes can provide custom middleware for locale handling:

**Location**: `contents/themes/{theme}/middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server'

export async function middleware(request: NextRequest) {
  // Custom locale detection logic
  const locale = detectCustomLocale(request)

  // Set custom headers or cookies
  const response = NextResponse.next()
  response.cookies.set('theme-locale', locale)

  return response
}

export default middleware
```

---

## Environment Variables

### Required Variables

None required - i18n system works with default configuration.

### Optional Variables

**NEXT_PUBLIC_ACTIVE_THEME**:
```bash
# .env.local
NEXT_PUBLIC_ACTIVE_THEME=default
```

Controls which theme is active, affecting:
- Theme-specific translations
- Theme configuration overrides
- Theme middleware overrides

### Build-Time Variables

**NODE_ENV**:
- `development`: Enables debug logging, validation warnings
- `production`: Disables debug output, optimizes performance

---

## Theme Configuration Overrides

Themes can override i18n configuration:

**Location**: `contents/themes/{theme}/app.config.ts`

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
// contents/themes/default/messages/fr.json
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
pnpm registry:build
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
3. Rebuild registry: `pnpm registry:build`

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
2. Verify `httpOnly: false` for client-side access
3. Check browser cookie settings
4. Verify `secure` setting matches environment (HTTPS in production)

#### Issue: Wrong Locale Detected

**Symptom**: User sees unexpected locale

**Solution**:
1. Check locale detection priority (database > cookie > header > default)
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
- Set `httpOnly: true` if using client-side locale switching
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
- Import directly from `@/contents` (use registry)

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
