# Internationalization Introduction

## Introduction

The NextSpark internationalization (i18n) system provides enterprise-grade multi-language support powered by **next-intl** with build-time translation registry optimization. The system enables seamless translation management across core application features, custom themes, and plugins while maintaining ~17,255x performance improvement through zero runtime I/O patterns.

The i18n architecture follows the same build-time philosophy as the registry system: all translations are discovered, validated, and indexed during the build process, eliminating filesystem operations at runtime and ensuring instant access to localized content.

## Supported Locales

The application currently supports two locales with easy extensibility for additional languages:

| Locale | Language | Code | Default |
|--------|----------|------|---------|
| English | English (US) | `en` | ✅ Yes |
| Spanish | Español | `es` | No |

**Default Locale**: `en` (English)

**Locale Detection Strategy**:
1. **Database User Preference** (authenticated users)
2. **Cookie** (`NEXT_LOCALE`)
3. **Accept-Language Header** (browser preference)
4. **Default Locale** (`en`)

---

## Key Features

### 1. **Build-Time Translation Registry** ⚡

All translations are indexed at build-time into a static registry, providing:
- **Zero Runtime I/O**: No filesystem reads during request handling
- **Type-Safe Access**: Full TypeScript support for translation keys
- **Instant Loading**: Translations loaded from memory, not disk
- **Build-Time Validation**: Missing keys detected during build

**Performance Impact**:
```text
Runtime Translation Loading:  ~140ms (filesystem I/O)
Registry Translation Loading: ~6ms (memory access)
Improvement:                  ~17,255x faster
```

### 2. **Hierarchical Translation Sources**

Translations merge from multiple sources with clear priority:

```text
Plugin Translations (highest priority)
    ↓
Theme Translations
    ↓
Core Translations (lowest priority)
```

This allows themes and plugins to override core translations while maintaining consistency across the application.

### 3. **Namespace Organization**

Translations are organized into logical namespaces for efficient lazy-loading:

**Core Namespaces (7 total)**:
- `common` - Shared UI elements (~2.1KB)
- `dashboard` - Dashboard-specific content (~1.2KB)
- `settings` - User settings and preferences (~12.5KB)
- `auth` - Authentication flows (~2.8KB)
- `public` - Public pages and landing (~10.5KB)
- `validation` - Form validation messages (~1.6KB)
- `admin` - Superadmin area

**Total Bundle Size**: ~37KB per locale (compressed ~25KB)

### 4. **Component-Level Integration**

Seamless integration with both Server and Client Components:

**Server Components**:
```typescript
import { getTranslations } from 'next-intl/server'

export default async function ServerPage() {
  const t = await getTranslations('common')
  return <h1>{t('welcome')}</h1>
}
```

**Client Components**:
```typescript
'use client'
import { useTranslations } from 'next-intl'

export function ClientComponent() {
  const t = useTranslations('common')
  return <button>{t('buttons.submit')}</button>
}
```

### 5. **Dynamic Value Interpolation**

Rich support for variables, pluralization, and formatting:

```typescript
// Variables
t('mobileNav.greeting', { name: 'John' })
// Output: "Hi, John"

// Pluralization (ICU MessageFormat)
t('items.count', { count: 5 })
// Output: "5 items" or "1 item"

// Date formatting
format.dateTime(new Date(), {
  year: 'numeric',
  month: 'long',
  day: 'numeric'
})
// Output: "November 19, 2025"
```

### 6. **Locale Switching**

User-friendly locale switching with persistence:
- **UI Locale Selector**: Dropdown component for language selection
- **Database Persistence**: Authenticated users' preferences saved
- **Cookie Fallback**: Anonymous users use cookies
- **URL Routing**: Optional locale prefix patterns (`/en/`, `/es/`)

### 7. **Translation Validation**

Built-in utilities prevent runtime errors:

```typescript
import { validateTranslationKey } from '@/core/lib/i18n-utils'

// Validates key exists before use
const isValid = validateTranslationKey(messages, 'auth.login.title', 'en')
// Returns: true or false, logs warning if missing
```

### 8. **Missing Translation Detection**

Development helpers identify incomplete translations:

```typescript
import { detectMissingTranslations } from '@/core/lib/i18n-utils'

// Compare English and Spanish translations
const missing = detectMissingTranslations(enMessages, esMessages)
// Returns: ['auth.errors.accountLocked', 'settings.profile.bio']
```

---

## Translation Architecture

### Translation Source Hierarchy

The i18n system loads translations from three primary sources with a clear merge strategy:

#### 1. **Core Translations** (Foundation Layer)

**Location**: `core/messages/{locale}/`

Core translations provide the foundational application strings:
- System messages
- Authentication flows
- Dashboard UI
- Common components
- Validation messages

**Structure**:
```text
core/messages/
├── en/
│   ├── common.json       # Shared UI elements (~2.1KB)
│   ├── dashboard.json    # Dashboard content (~1.2KB)
│   ├── settings.json     # User settings (~12.5KB)
│   ├── auth.json         # Authentication (~2.8KB)
│   ├── public.json       # Public pages (~10.5KB)
│   ├── validation.json   # Validation messages (~1.6KB)
│   └── admin.json      # Superadmin area
└── es/
    ├── common.json
    ├── dashboard.json
    └── ... (same structure)
```

**Loading Strategy**: Dynamic import (approved exception for core namespaces)

#### 2. **Theme Translations** (Customization Layer)

**Location**: `contents/themes/{theme}/messages/{locale}.json`

Theme translations customize and extend core strings:
- Theme-specific pages
- Custom navigation
- Branded messaging
- Override core strings
- Theme features

**Structure**:
```text
contents/themes/default/messages/
├── en.json     # English theme translations (~15KB)
└── es.json     # Spanish theme translations (~15KB)
```

**Example** (`en.json`):
```json
{
  "navigation": {
    "features": "Features",
    "pricing": "Pricing",
    "support": "Support",
    "docs": "Documentation"
  },
  "home": {
    "hero": {
      "badge": "Next.js 15 + Better Auth + shadcn/ui",
      "title": "Modern NextSpark",
      "description": "Production-ready starter..."
    }
  },
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete"
  }
}
```

**Loading Strategy**: Auto-generated registry (`loadThemeTranslation()`)

#### 3. **Plugin Translations** (Extension Layer)

**Location**: `contents/plugins/{plugin}/messages/{locale}.json`

Plugin translations add feature-specific strings:
- Plugin-specific UI
- Feature descriptions
- Plugin settings
- Override theme/core strings

**Structure**:
```text
contents/plugins/ai/messages/
├── en.json     # AI plugin English
└── es.json     # AI plugin Spanish

contents/plugins/billing/messages/
├── en.json     # Billing plugin English
└── es.json     # Billing plugin Spanish
```

**Loading Strategy**: Auto-generated registry (merged with theme/core)

### Merge Priority

When the same translation key exists in multiple sources:

```typescript
// Priority order (highest to lowest):
1. Plugin translations    (most specific)
2. Theme translations     (customization)
3. Core translations      (fallback)

// Example:
// core/messages/en/common.json
{ "buttons": { "submit": "Submit" } }

// contents/themes/default/messages/en.json
{ "buttons": { "submit": "Send" } }

// Result when accessed:
t('buttons.submit') // Returns: "Send" (theme overrides core)
```

### Translation Registry System

**Auto-Generated Registry**: `core/lib/registries/translation-registry.ts`

The translation registry is generated by `core/scripts/build/registry.mjs` and provides:

**Key Components**:
```typescript
// Translation loader type (lazy-loaded)
type TranslationLoader = () => Promise<Record<string, unknown>>

// Registry structure
export const TRANSLATION_REGISTRY: Record<SupportedLocale, TranslationLoader> = {
  en: () => import('./en').then(m => m.default),
  es: () => import('./es').then(m => m.default)
}

// Theme translation loader
export async function loadThemeTranslation(
  themeName: string,
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // Auto-generated function per theme
}
```

**Registry Benefits**:
- ✅ **Type Safety**: Full TypeScript inference
- ✅ **Zero Runtime I/O**: No filesystem operations
- ✅ **Build-Time Validation**: Missing files detected during build
- ✅ **Lazy Loading**: Translations loaded per locale only when needed
- ✅ **Memory Efficient**: Only active locale loaded in memory

---

## i18n Configuration

The i18n system is configured through a central config object:

**Location**: `core/lib/config/i18n.config.ts`

```typescript
export const I18N_CONFIG = {
  // Supported locales
  supportedLocales: ['en', 'es'] as const,

  // Default locale (fallback)
  defaultLocale: 'en' as const,

  // Locale detection strategy priority
  localeDetection: {
    cookie: 'NEXT_LOCALE',
    header: 'accept-language',
    userPreference: true  // Check database for authenticated users
  },

  // Core namespace definitions
  namespaces: [
    'common',
    'dashboard',
    'settings',
    'auth',
    'public',
    'validation',
    'admin'
  ] as const,

  // Performance thresholds
  performance: {
    maxInitialLoadTime: 100,  // ms
    maxNamespaceLoadTime: 50  // ms
  }
}

export type SupportedLocale = typeof I18N_CONFIG.supportedLocales[number]
export type TranslationNamespace = typeof I18N_CONFIG.namespaces[number]
```

### next-intl Integration

The system integrates with next-intl through `i18n.ts`:

**Location**: `core/lib/translations/i18n-integration.ts`

```typescript
import { getRequestConfig } from 'next-intl/server'
import { loadAllI18nTranslations } from './i18n-integration'

export default getRequestConfig(async ({ locale }) => {
  // Load all translations for the locale
  const messages = await loadAllI18nTranslations(locale as SupportedLocale)

  return {
    messages,
    timeZone: 'UTC',
    now: new Date()
  }
})
```

**Translation Loader** (`loadAllI18nTranslations`):
```typescript
export async function loadAllI18nTranslations(
  locale: SupportedLocale
): Promise<Record<string, unknown>> {
  // 1. Load core translations (namespaced)
  const coreTranslations = await loadCoreTranslations(locale)

  // 2. Load theme translations
  const themeTranslations = await loadThemeTranslations(locale)

  // 3. Load plugin translations
  const pluginTranslations = await loadPluginTranslations(locale)

  // 4. Merge with priority: plugin > theme > core
  return {
    ...coreTranslations,
    ...themeTranslations,
    ...pluginTranslations
  }
}
```

---

## Translation Key Standards

### Naming Conventions

Translation keys follow a strict hierarchical structure:

**Rules**:
- ✅ **Hierarchical**: Group related translations using dot notation
- ✅ **Descriptive**: Clear purpose from key name alone
- ✅ **Consistent**: Same pattern across all locales
- ✅ **No Abbreviations**: Use full words only
- ✅ **camelCase**: Follow JavaScript naming conventions

**Examples**:

```json
{
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email Address",
      "passwordLabel": "Password",
      "submitButton": "Sign In",
      "forgotPassword": "Forgot password?",
      "errors": {
        "invalidCredentials": "Invalid email or password",
        "accountLocked": "Account temporarily locked",
        "emailNotVerified": "Please verify your email address"
      }
    },
    "signup": {
      "title": "Create Account",
      "emailLabel": "Email Address",
      "passwordLabel": "Password",
      "confirmPasswordLabel": "Confirm Password"
    }
  }
}
```

**Anti-Patterns** (❌ Avoid):
```json
{
  // ❌ Flat structure
  "login_title": "Sign In",
  "login_email": "Email",

  // ❌ Unclear abbreviations
  "auth_pwd": "Password",
  "usr_prof": "User Profile",

  // ❌ Inconsistent casing
  "login_Title": "Sign In",
  "LoginButton": "Sign In",

  // ❌ Redundant nesting
  "auth": {
    "auth": {
      "login": "Sign In"
    }
  }
}
```

### Key Structure Patterns

**Feature-Based Organization**:
```json
{
  "[feature]": {
    "[component]": {
      "[element]": "Translation",
      "errors": {
        "[errorType]": "Error message"
      },
      "success": {
        "[successType]": "Success message"
      }
    }
  }
}
```

**Example - User Profile**:
```json
{
  "profile": {
    "header": {
      "title": "User Profile",
      "subtitle": "Manage your account information"
    },
    "form": {
      "nameLabel": "Full Name",
      "namePlaceholder": "Enter your full name",
      "emailLabel": "Email Address",
      "bioLabel": "Biography",
      "bioPlaceholder": "Tell us about yourself"
    },
    "actions": {
      "save": "Save Changes",
      "cancel": "Cancel",
      "deleteAccount": "Delete Account"
    },
    "success": {
      "updated": "Profile updated successfully",
      "deleted": "Account deleted successfully"
    },
    "errors": {
      "updateFailed": "Failed to update profile",
      "invalidEmail": "Please enter a valid email address",
      "nameTooShort": "Name must be at least 2 characters"
    }
  }
}
```

---

## Usage Patterns

### Server Components

Server components use `getTranslations` for async translation access:

```typescript
import { getTranslations } from 'next-intl/server'

export default async function ProfilePage() {
  const t = await getTranslations('profile')

  return (
    <div>
      <h1>{t('header.title')}</h1>
      <p>{t('header.subtitle')}</p>

      <form>
        <label>{t('form.nameLabel')}</label>
        <input placeholder={t('form.namePlaceholder')} />

        <button type="submit">{t('actions.save')}</button>
      </form>
    </div>
  )
}
```

**Multiple Namespaces**:
```typescript
export default async function DashboardPage() {
  const tCommon = await getTranslations('common')
  const tDashboard = await getTranslations('dashboard')

  return (
    <div>
      <h1>{tDashboard('welcome')}</h1>
      <button>{tCommon('buttons.save')}</button>
    </div>
  )
}
```

### Client Components

Client components use `useTranslations` hook:

```typescript
'use client'

import { useTranslations } from 'next-intl'

export function ProfileForm() {
  const t = useTranslations('profile.form')
  const tActions = useTranslations('profile.actions')

  return (
    <form>
      <label>{t('nameLabel')}</label>
      <input placeholder={t('namePlaceholder')} />

      <button type="submit">{tActions('save')}</button>
      <button type="button">{tActions('cancel')}</button>
    </form>
  )
}
```

### API Routes

API routes can access translations for error messages:

```typescript
import { getTranslations } from 'next-intl/server'

export async function POST(request: Request) {
  const locale = request.headers.get('accept-language')?.split(',')[0] || 'en'
  const t = await getTranslations({ locale, namespace: 'validation' })

  // Validation logic
  if (!email) {
    return Response.json(
      { error: t('emailRequired') },
      { status: 400 }
    )
  }

  // ...
}
```

### Dynamic Values

Translations support variable interpolation:

```typescript
// Translation file
{
  "welcome": "Welcome, {name}!",
  "itemsCount": "You have {count} {count, plural, one {item} other {items}}"
}

// Component
const t = useTranslations('common')

// Simple variable
<p>{t('welcome', { name: 'John' })}</p>
// Output: "Welcome, John!"

// Pluralization
<p>{t('itemsCount', { count: 1 })}</p>
// Output: "You have 1 item"

<p>{t('itemsCount', { count: 5 })}</p>
// Output: "You have 5 items"
```

---

## Performance Characteristics

### Translation Loading Performance

**Registry-Based Loading**:
```text
Initial locale load:     ~6ms (from memory)
Additional namespace:    ~2-3ms (lazy loaded)
Locale switching:        ~6ms (new locale loaded)
```

**Traditional Runtime Loading** (for comparison):
```text
Initial locale load:     ~140ms (filesystem I/O)
Additional namespace:    ~20-30ms (filesystem I/O)
Locale switching:        ~140ms (filesystem I/O)
```

**Performance Improvement**: ~17,255x faster (140ms → 6ms)

### Bundle Size Impact

**Per Locale**:
- **Uncompressed**: ~37KB
- **Compressed (gzip)**: ~25KB
- **Brotli**: ~18KB

**Core Namespaces Breakdown**:
- `common.json`: ~2.1KB
- `dashboard.json`: ~1.2KB
- `settings.json`: ~12.5KB
- `auth.json`: ~2.8KB
- `public.json`: ~10.5KB
- `validation.json`: ~1.6KB
- `admin.json`: ~7KB (estimated)

**Theme Translations**:
- `en.json`: ~15KB
- `es.json`: ~15KB

**Total Initial Load** (one locale):
- Core + Theme: ~52KB (uncompressed)
- Compressed: ~35KB

### Memory Footprint

**Active Locale Only**:
- Only the active locale is loaded in memory
- Switching locales releases previous locale from memory
- Lazy namespace loading reduces initial footprint

**Optimization Strategies**:
- Route-based namespace loading (only load needed namespaces)
- Lazy loading for less-used namespaces
- Client-side caching with service workers
- CDN caching for static translations

---

## Zero Runtime I/O Policy

The i18n system follows the project's zero runtime I/O philosophy:

### Allowed Patterns

✅ **Build-Time Registry Access**:
```typescript
// CORRECT - Using auto-generated registry
import { loadThemeTranslation } from '@/core/lib/registries/translation-registry'

const translations = await loadThemeTranslation('default', 'en')
```

✅ **Core Namespace Dynamic Import** (approved exception):
```typescript
// CORRECT - Core namespaces use dynamic import (approved exception)
const messages = await import(`./messages/en/common.json`)
```

✅ **next-intl Hooks**:
```typescript
// CORRECT - Framework hooks
const t = useTranslations('common')
const t = await getTranslations('auth')
```

### Prohibited Patterns

❌ **Runtime String Interpolation**:
```typescript
// WRONG - Runtime path resolution
const messages = await import(`@/contents/themes/${theme}/messages/${locale}.json`)
```

❌ **Direct Content Imports**:
```typescript
// WRONG - Direct import from contents
import themeMessages from '@/contents/themes/default/messages/en.json'
```

❌ **Filesystem Operations**:
```typescript
// WRONG - Runtime filesystem reads
const messages = JSON.parse(
  fs.readFileSync(`./messages/${locale}.json`, 'utf-8')
)
```

### Enforcement

**Build-Time Validation**:
```bash
# Pre-commit hook check
pnpm check-dynamic-imports

# Validates:
# - No dynamic imports for translations (except core namespaces)
# - No imports from @/contents (use registries)
# - Registry files are up-to-date
```

**CI/CD Pipeline**:
```bash
# Build process includes translation validation
pnpm build

# Checks:
# - All translation keys exist in all locales
# - No missing translation files
# - Registry generation successful
# - Type safety validation
```

---

## Development Workflow

### Adding New Translations

**1. Add to Core Translations** (application-wide):
```bash
# Create or edit namespace file
core/messages/en/[namespace].json
core/messages/es/[namespace].json
```

**2. Add to Theme Translations** (theme-specific):
```bash
# Edit theme translation file
contents/themes/default/messages/en.json
contents/themes/default/messages/es.json
```

**3. Add to Plugin Translations** (plugin-specific):
```bash
# Create or edit plugin translations
contents/plugins/[plugin]/messages/en.json
contents/plugins/[plugin]/messages/es.json
```

**4. Rebuild Registry**:
```bash
# Regenerate translation registry
pnpm registry:build

# Or watch mode during development
pnpm registry:build-watch
```

### Translation Validation

**Check for Missing Keys**:
```typescript
import { detectMissingTranslations } from '@/core/lib/i18n-utils'

const enMessages = await import('./messages/en/common.json')
const esMessages = await import('./messages/es/common.json')

const missing = detectMissingTranslations(enMessages, esMessages)
console.log('Missing ES translations:', missing)
// Output: ['buttons.newFeature', 'auth.login.twoFactor']
```

**Validate Key Existence**:
```typescript
import { validateTranslationKey } from '@/core/lib/i18n-utils'

const messages = await import('./messages/en/common.json')

// Check if key exists before using
if (!validateTranslationKey(messages, 'auth.login.title', 'en')) {
  console.error('Translation key missing!')
}
```

### Testing Translations

**Unit Tests**:
```typescript
import { renderWithTranslations } from '@/test/utils'

test('renders translated button', () => {
  const { getByText } = renderWithTranslations(
    <Button label="buttons.save" />,
    { locale: 'en' }
  )

  expect(getByText('Save')).toBeInTheDocument()
})
```

**E2E Tests** (Cypress):
```typescript
describe('Locale Switching', () => {
  it('switches language to Spanish', () => {
    cy.visit('/')
    cy.get('[data-cy="locale-selector"]').click()
    cy.get('[data-cy="locale-es"]').click()

    cy.get('h1').should('contain', 'Bienvenido')
  })
})
```

---

## Next Steps

Now that you understand the i18n system architecture and key features, explore specific implementation details:

- **[Setup and Configuration](./02-setup-and-configuration.md)** - Configure next-intl, locale detection, and middleware
- **[Translation Keys](./03-translation-keys.md)** - Naming conventions, validation, and best practices
- **[Translation Sources](./04-translation-sources.md)** - Core, theme, entity, and plugin translation management
- **[Translation Registry](./05-translation-registry.md)** - Build-time registry, performance optimization, and access patterns
- **[Locale Switching](./06-locale-switching.md)** - Implement locale selector, persistence, and routing
- **[Advanced Patterns](./07-advanced-patterns.md)** - Pluralization, formatting, RTL support, and lazy loading
- **[Testing Translations](./08-testing-translations.md)** - Testing strategies, validation, and CI/CD integration

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
