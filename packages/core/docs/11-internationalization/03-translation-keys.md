# Translation Keys

## Introduction

Translation keys are the backbone of the internationalization system, providing a structured way to organize and access translated content throughout the application. This document covers the naming conventions, structural patterns, validation utilities, and best practices for creating maintainable and scalable translation keys.

Well-designed translation keys make the codebase more maintainable, reduce errors, and provide clear context for translators working on localization.

---

## Key Naming Conventions

### Hierarchical Structure

Translation keys use dot notation to create a hierarchical structure that mirrors the application's logical organization:

```json
{
  "feature": {
    "component": {
      "element": "Translation",
      "subElement": "Another translation"
    }
  }
}
```

**Access Pattern**:
```typescript
t('feature.component.element') // "Translation"
t('feature.component.subElement') // "Another translation"
```

### camelCase Convention

All keys use camelCase for consistency with JavaScript naming conventions:

```json
{
  "auth": {
    "login": {
      "emailLabel": "Email Address",
      "passwordLabel": "Password",
      "submitButton": "Sign In",
      "forgotPassword": "Forgot password?"
    }
  }
}
```

**Why camelCase**:
- Consistent with JavaScript property access
- Easier to type (no underscores or hyphens)
- Better autocomplete support in IDEs
- Matches React component prop naming

### Descriptive Names

Keys should be self-documenting and clearly indicate their purpose:

✅ **Good Examples**:
```json
{
  "profile": {
    "form": {
      "nameLabel": "Full Name",
      "namePlaceholder": "Enter your full name",
      "emailLabel": "Email Address",
      "bioLabel": "Biography"
    }
  }
}
```

❌ **Bad Examples**:
```json
{
  "profile": {
    "f": {
      "n": "Full Name",         // Too abbreviated
      "name1": "Enter name",    // Unclear numbering
      "txt1": "Email",          // Generic naming
      "field4": "Biography"     // No context
    }
  }
}
```

### No Abbreviations

Avoid abbreviations unless they are universally understood:

✅ **Allowed Abbreviations**:
- `id` (identifier)
- `url` (uniform resource locator)
- `api` (application programming interface)
- `html` (hypertext markup language)

❌ **Avoid Abbreviations**:
```json
{
  // BAD
  "usr": "User",
  "pwd": "Password",
  "msg": "Message",
  "btn": "Button",
  "desc": "Description"
}
```

```json
{
  // GOOD
  "user": "User",
  "password": "Password",
  "message": "Message",
  "button": "Button",
  "description": "Description"
}
```

---

## Structural Patterns

### Feature-Based Organization

Group translations by feature or domain:

```json
{
  "auth": {
    "login": { /* ... */ },
    "signup": { /* ... */ },
    "resetPassword": { /* ... */ }
  },
  "profile": {
    "header": { /* ... */ },
    "form": { /* ... */ },
    "actions": { /* ... */ }
  },
  "billing": {
    "subscription": { /* ... */ },
    "invoices": { /* ... */ },
    "paymentMethods": { /* ... */ }
  }
}
```

### Component-Based Nesting

Within each feature, organize by component or page section:

```json
{
  "dashboard": {
    "header": {
      "title": "Dashboard",
      "subtitle": "Welcome back, {name}"
    },
    "sidebar": {
      "home": "Home",
      "analytics": "Analytics",
      "settings": "Settings"
    },
    "widgets": {
      "revenue": {
        "title": "Revenue",
        "subtitle": "Total revenue this month"
      },
      "users": {
        "title": "Active Users",
        "subtitle": "Users online now"
      }
    }
  }
}
```

### Element-Type Grouping

Group UI elements by type within components:

```json
{
  "profile": {
    "form": {
      "labels": {
        "name": "Full Name",
        "email": "Email Address",
        "bio": "Biography"
      },
      "placeholders": {
        "name": "Enter your full name",
        "email": "your@email.com",
        "bio": "Tell us about yourself"
      },
      "hints": {
        "name": "Your display name",
        "email": "We'll never share your email",
        "bio": "Maximum 500 characters"
      }
    }
  }
}
```

**Alternative Flat Structure** (preferred for simplicity):
```json
{
  "profile": {
    "form": {
      "nameLabel": "Full Name",
      "namePlaceholder": "Enter your full name",
      "nameHint": "Your display name",
      "emailLabel": "Email Address",
      "emailPlaceholder": "your@email.com",
      "emailHint": "We'll never share your email"
    }
  }
}
```

### State-Based Keys

Organize keys by state (errors, success, loading):

```json
{
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email",
      "passwordLabel": "Password",
      "submitButton": "Sign In",

      "errors": {
        "invalidCredentials": "Invalid email or password",
        "emailRequired": "Email is required",
        "passwordRequired": "Password is required",
        "accountLocked": "Account temporarily locked",
        "emailNotVerified": "Please verify your email first"
      },

      "success": {
        "loggedIn": "Successfully logged in",
        "welcomeBack": "Welcome back!"
      },

      "loading": {
        "signingIn": "Signing in...",
        "verifyingCredentials": "Verifying credentials..."
      }
    }
  }
}
```

---

## Namespace Organization

### Core Namespaces

The application uses 6 core namespaces for different areas:

**1. common** - Shared UI elements:
```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit"
  },
  "navigation": {
    "home": "Home",
    "dashboard": "Dashboard",
    "settings": "Settings"
  },
  "status": {
    "loading": "Loading...",
    "saving": "Saving...",
    "success": "Success!"
  }
}
```

**2. dashboard** - Dashboard-specific:
```json
{
  "header": {
    "title": "Dashboard",
    "subtitle": "Overview"
  },
  "widgets": {
    "revenue": "Revenue",
    "users": "Users",
    "orders": "Orders"
  }
}
```

**3. settings** - User settings:
```json
{
  "profile": {
    "title": "Profile Settings",
    "description": "Manage your profile"
  },
  "preferences": {
    "title": "Preferences",
    "language": "Language",
    "timezone": "Timezone"
  }
}
```

**4. auth** - Authentication flows:
```json
{
  "login": { /* ... */ },
  "signup": { /* ... */ },
  "forgotPassword": { /* ... */ },
  "resetPassword": { /* ... */ },
  "verifyEmail": { /* ... */ }
}
```

**5. public** - Public pages:
```json
{
  "home": {
    "hero": {
      "title": "Welcome",
      "subtitle": "Get started today"
    }
  },
  "pricing": { /* ... */ },
  "features": { /* ... */ }
}
```

**6. validation** - Form validation messages:
```json
{
  "required": "{field} is required",
  "email": "Please enter a valid email",
  "minLength": "{field} must be at least {min} characters",
  "maxLength": "{field} must not exceed {max} characters"
}
```

### When to Create a New Namespace

Create a new namespace when:
- ✅ You have a distinct feature area with 20+ keys
- ✅ The content is logically separate from existing namespaces
- ✅ The translations will be loaded on specific routes only
- ✅ Multiple developers will work on the feature independently

Don't create a new namespace when:
- ❌ You only have a few keys (< 20)
- ❌ The content fits logically in an existing namespace
- ❌ The translations are used across many routes

---

## Key Patterns and Examples

### Form Fields

```json
{
  "profile": {
    "form": {
      "nameLabel": "Full Name",
      "namePlaceholder": "Enter your full name",
      "nameError": "Name is required",

      "emailLabel": "Email Address",
      "emailPlaceholder": "your@email.com",
      "emailError": "Please enter a valid email",

      "bioLabel": "Biography",
      "bioPlaceholder": "Tell us about yourself",
      "bioHint": "Maximum 500 characters"
    }
  }
}
```

**Usage**:
```typescript
const t = useTranslations('profile.form')

<input
  placeholder={t('namePlaceholder')}
  aria-label={t('nameLabel')}
/>
```

### Buttons and Actions

```json
{
  "common": {
    "buttons": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "submit": "Submit",
      "close": "Close"
    },
    "actions": {
      "saving": "Saving...",
      "deleting": "Deleting...",
      "loading": "Loading..."
    }
  }
}
```

**Usage**:
```typescript
const t = useTranslations('common.buttons')

<button type="submit">
  {isLoading ? t('saving', { ns: 'common.actions' }) : t('save')}
</button>
```

### Error Messages

```json
{
  "auth": {
    "login": {
      "errors": {
        "invalidCredentials": "Invalid email or password",
        "accountLocked": "Account temporarily locked. Try again in {minutes} minutes",
        "tooManyAttempts": "Too many login attempts. Please try again later",
        "emailNotVerified": "Please verify your email address before logging in",
        "accountDisabled": "This account has been disabled. Contact support for help"
      }
    }
  }
}
```

**Usage**:
```typescript
const t = useTranslations('auth.login.errors')

if (error.code === 'ACCOUNT_LOCKED') {
  showError(t('accountLocked', { minutes: 15 }))
}
```

### Success Messages

```json
{
  "profile": {
    "success": {
      "updated": "Profile updated successfully",
      "photoUploaded": "Profile photo uploaded",
      "passwordChanged": "Password changed successfully",
      "emailVerified": "Email verified! You can now log in"
    }
  }
}
```

### Navigation and Menus

```json
{
  "navigation": {
    "main": {
      "home": "Home",
      "dashboard": "Dashboard",
      "products": "Products",
      "analytics": "Analytics",
      "settings": "Settings"
    },
    "user": {
      "profile": "My Profile",
      "billing": "Billing",
      "preferences": "Preferences",
      "logout": "Log Out"
    }
  }
}
```

### Confirmation Dialogs

```json
{
  "dialogs": {
    "delete": {
      "title": "Delete {itemType}",
      "message": "Are you sure you want to delete this {itemType}? This action cannot be undone.",
      "confirm": "Delete",
      "cancel": "Cancel"
    },
    "unsavedChanges": {
      "title": "Unsaved Changes",
      "message": "You have unsaved changes. Do you want to save them before leaving?",
      "save": "Save Changes",
      "discard": "Discard",
      "cancel": "Cancel"
    }
  }
}
```

### Lists and Tables

```json
{
  "users": {
    "table": {
      "columns": {
        "name": "Name",
        "email": "Email",
        "role": "Role",
        "status": "Status",
        "createdAt": "Created",
        "actions": "Actions"
      },
      "empty": "No users found",
      "loading": "Loading users...",
      "error": "Failed to load users"
    }
  }
}
```

### Pagination

```json
{
  "pagination": {
    "previous": "Previous",
    "next": "Next",
    "page": "Page {current} of {total}",
    "showing": "Showing {from} to {to} of {total} results",
    "perPage": "Items per page"
  }
}
```

---

## Using Translation Keys in Components

### Server Components

```typescript
import { getTranslations } from 'next-intl/server'

export default async function ProfilePage() {
  const t = await getTranslations('profile')

  return (
    <div>
      <h1>{t('header.title')}</h1>
      <p>{t('header.subtitle')}</p>
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
      <h1>{tDashboard('header.title')}</h1>
      <button>{tCommon('buttons.save')}</button>
    </div>
  )
}
```

### Client Components

```typescript
'use client'

import { useTranslations } from 'next-intl'

export function ProfileForm() {
  const t = useTranslations('profile.form')

  return (
    <form>
      <label>{t('nameLabel')}</label>
      <input placeholder={t('namePlaceholder')} />

      <button type="submit">{t('submit')}</button>
    </form>
  )
}
```

**Scoped Translation Hook**:
```typescript
'use client'

import { useTranslations } from 'next-intl'

export function LoginForm() {
  // Scoped to 'auth.login'
  const t = useTranslations('auth.login')

  return (
    <form>
      <h1>{t('title')}</h1> {/* auth.login.title */}

      <input placeholder={t('emailLabel')} />
      <input type="password" placeholder={t('passwordLabel')} />

      <button>{t('submitButton')}</button>
    </form>
  )
}
```

### Dynamic Values

```typescript
// Translation file
{
  "welcome": "Welcome, {name}!",
  "greeting": "Hello, {firstName} {lastName}",
  "itemCount": "You have {count} {count, plural, one {item} other {items}}"
}

// Component
const t = useTranslations('common')

<h1>{t('welcome', { name: user.name })}</h1>
// Output: "Welcome, John!"

<p>{t('greeting', { firstName: 'John', lastName: 'Doe' })}</p>
// Output: "Hello, John Doe"

<p>{t('itemCount', { count: 5 })}</p>
// Output: "You have 5 items"
```

### Rich Text

```typescript
// Translation file
{
  "terms": "By signing up, you agree to our <link>Terms of Service</link>",
  "description": "This is <strong>bold</strong> and <em>italic</em> text"
}

// Component
const t = useTranslations('auth.signup')

<p>
  {t.rich('terms', {
    link: (chunks) => <a href="/terms">{chunks}</a>
  })}
</p>
// Output: By signing up, you agree to our <a href="/terms">Terms of Service</a>
```

---

## Translation Key Validation

### Validation Utilities

**Location**: `core/lib/i18n-utils.ts`

#### validateTranslationKey()

Validates that a translation key exists in the messages object:

```typescript
import { validateTranslationKey } from '@/core/lib/i18n-utils'

const messages = await import('./messages/en/common.json')

// Check if key exists
const isValid = validateTranslationKey(
  messages,
  'auth.login.title',
  'en'
)

if (!isValid) {
  console.error('Translation key missing!')
}
// Logs warning: Missing translation key "auth.login.title" for locale "en"
```

**Implementation**:
```typescript
export function validateTranslationKey(
  messages: Record<string, unknown>,
  key: string,
  locale: string
): boolean {
  const keys = key.split('.')
  let current = messages

  for (const k of keys) {
    if (!current?.[k]) {
      console.warn(`Missing translation key "${key}" for locale "${locale}"`)
      return false
    }
    current = current[k] as Record<string, unknown>
  }

  return true
}
```

**Use Cases**:
- Pre-flight validation before using translation keys
- Build-time checks for missing translations
- Development debugging

#### detectMissingTranslations()

Compares two locale message sets to find missing translations:

```typescript
import { detectMissingTranslations } from '@/core/lib/i18n-utils'

const enMessages = await import('./messages/en/common.json')
const esMessages = await import('./messages/es/common.json')

const missing = detectMissingTranslations(enMessages, esMessages)

console.log('Missing Spanish translations:', missing)
// Output: ['buttons.newFeature', 'auth.login.twoFactor', 'settings.advanced.apiKeys']
```

**Implementation**:
```typescript
export function detectMissingTranslations(
  enMessages: Record<string, unknown>,
  esMessages: Record<string, unknown>,
  path: string = ''
): string[] {
  const missing: string[] = []

  function checkMessages(
    en: Record<string, unknown>,
    es: Record<string, unknown>,
    currentPath: string
  ) {
    for (const key in en) {
      const newPath = currentPath ? `${currentPath}.${key}` : key

      if (typeof en[key] === 'object' && en[key] !== null) {
        // Nested object - recurse
        if (!es[key]) {
          missing.push(newPath)
        } else {
          checkMessages(
            en[key] as Record<string, unknown>,
            es[key] as Record<string, unknown>,
            newPath
          )
        }
      } else {
        // Leaf node - check if exists
        if (!(key in es)) {
          missing.push(newPath)
        }
      }
    }
  }

  checkMessages(enMessages, esMessages, path)
  return missing
}
```

**Use Cases**:
- Translation completeness checks
- CI/CD validation
- Translator workflow management

### Runtime Validation

Enable validation in development mode:

```typescript
// core/i18n.ts (development only)
if (process.env.NODE_ENV === 'development') {
  const validation = validateAllTranslationKeys(messages)

  if (validation.errors.length > 0) {
    console.warn('[i18n] Translation validation errors:')
    validation.errors.forEach(error => {
      console.warn(`  - ${error}`)
    })
  }
}
```

### Build-Time Validation

Add validation to the registry build process:

```javascript
// core/scripts/build/registry.mjs
import { detectMissingTranslations } from './core/lib/i18n-utils.js'

// Load all locale files
const enMessages = loadMessages('en')
const esMessages = loadMessages('es')

// Check for missing translations
const missing = detectMissingTranslations(enMessages, esMessages)

if (missing.length > 0) {
  console.warn('⚠️  Missing Spanish translations:')
  missing.forEach(key => console.warn(`   - ${key}`))
}
```

---

## Best Practices

### Do's ✅

**1. Use Hierarchical Structure**:
```json
{
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email"
    }
  }
}
```

**2. Be Descriptive**:
```json
{
  "profile": {
    "form": {
      "nameLabel": "Full Name",
      "namePlaceholder": "Enter your full name"
    }
  }
}
```

**3. Group by Context**:
```json
{
  "auth": {
    "login": {
      "errors": {
        "invalidCredentials": "Invalid email or password",
        "accountLocked": "Account locked"
      }
    }
  }
}
```

**4. Use camelCase**:
```json
{
  "emailLabel": "Email",
  "submitButton": "Submit",
  "forgotPassword": "Forgot password?"
}
```

**5. Provide Context in Key Names**:
```json
{
  "deleteButton": "Delete",           // Clear context
  "deleteConfirmation": "Are you sure?",
  "deleteSuccess": "Deleted successfully"
}
```

### Don'ts ❌

**1. Avoid Flat Structure**:
```json
{
  // BAD
  "login_title": "Sign In",
  "login_email": "Email",
  "signup_title": "Sign Up",
  "signup_email": "Email"
}
```

**2. Don't Use Abbreviations**:
```json
{
  // BAD
  "usr": "User",
  "pwd": "Password",
  "btn": "Button"
}
```

**3. Don't Use snake_case or kebab-case**:
```json
{
  // BAD
  "email_label": "Email",
  "submit-button": "Submit"
}
```

**4. Avoid Generic Names**:
```json
{
  // BAD
  "text1": "Welcome",
  "message": "Hello",
  "label": "Name"
}
```

**5. Don't Duplicate Keys Across Namespaces**:
```json
// common.json
{
  "buttons": {
    "save": "Save"
  }
}

// auth.json (BAD - duplicates common)
{
  "buttons": {
    "save": "Save"  // Use common.buttons.save instead
  }
}
```

---

## Migration and Refactoring

### Renaming Keys

When renaming translation keys:

**1. Update all locale files**:
```json
// Before
{
  "login_title": "Sign In"
}

// After
{
  "login": {
    "title": "Sign In"
  }
}
```

**2. Update all component usage**:
```typescript
// Before
t('login_title')

// After
t('login.title')
```

**3. Run validation**:
```bash
pnpm registry:build
# Check for missing key warnings
```

### Splitting Large Namespaces

When a namespace grows too large (> 100 keys), split it:

**Before** (`common.json`):
```json
{
  "buttons": { /* ... */ },
  "navigation": { /* ... */ },
  "forms": { /* ... */ },
  "billing": { /* 50+ keys */ }
}
```

**After** (create `billing.json` namespace):
```json
// common.json
{
  "buttons": { /* ... */ },
  "navigation": { /* ... */ },
  "forms": { /* ... */ }
}

// billing.json (new namespace)
{
  "subscription": { /* ... */ },
  "invoices": { /* ... */ },
  "paymentMethods": { /* ... */ }
}
```

---

## Next Steps

Now that you understand translation key conventions, explore:

- **[Translation Sources](./04-translation-sources.md)** - Managing core, theme, and plugin translations
- **[Translation Registry](./05-translation-registry.md)** - Build-time optimization and performance
- **[Locale Switching](./06-locale-switching.md)** - Implementing user locale selection
- **[Advanced Patterns](./07-advanced-patterns.md)** - Pluralization, formatting, and dynamic values
- **[Testing Translations](./08-testing-translations.md)** - Ensure translation quality and completeness

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
