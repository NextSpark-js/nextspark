# /how-to:add-translations

Interactive guide to add translations and internationalize your NextSpark app.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/i18n-nextintl/SKILL.md` - Internationalization patterns

---

## Syntax

```
/how-to:add-translations
```

---

## Behavior

Guides the user through adding translations to entities, components, and themes using next-intl.

---

## Tutorial Overview

```
STEPS OVERVIEW (4 steps)

Step 1: Understanding i18n Structure
        └── Message layers and namespaces

Step 2: Add Entity Translations
        └── Translate entity labels and fields

Step 3: Add Component Translations
        └── Translate UI components

Step 4: Add New Language
        └── Add a complete new locale
```

---

## Step 1: Understanding i18n Structure

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: ADD TRANSLATIONS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 4: Understanding i18n Structure

NextSpark uses next-intl with layered messages:

┌─────────────────────────────────────────────┐
│  MESSAGE LAYERS (Priority Order)            │
│  ─────────────────────────────────────────  │
│                                             │
│  1. THEME MESSAGES (highest priority)       │
│     themes/{theme}/messages/{locale}.json   │
│     → Theme-specific overrides              │
│                                             │
│  2. ENTITY MESSAGES                         │
│     themes/{theme}/entities/*/messages/     │
│     → Auto-generated from entity config     │
│                                             │
│  3. CORE MESSAGES (lowest priority)         │
│     core/messages/{locale}.json             │
│     → Default translations                  │
│                                             │
└─────────────────────────────────────────────┘

Theme messages override core. Entity messages auto-register.
```

**📂 Message Structure:**

```
contents/themes/your-theme/
├── messages/
│   ├── en.json           # Theme messages (English)
│   ├── es.json           # Theme messages (Spanish)
│   └── pt.json           # Theme messages (Portuguese)
└── entities/
    └── products/
        └── messages/
            ├── en.json   # Entity messages (English)
            ├── es.json   # Entity messages (Spanish)
            └── pt.json   # Entity messages (Portuguese)
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Namespace Groups:

| Group | Purpose | Example |
|-------|---------|---------|
| common | Shared UI text | buttons, labels |
| auth | Authentication | login, register |
| dashboard | Dashboard UI | navigation, stats |
| entities | Entity labels | products, customers |
| errors | Error messages | validation, 404 |
| success | Success messages | created, updated |

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Entity Translations)
[2] Show me how to use translations in code
[3] How does message merging work?
```

---

## Step 2: Add Entity Translations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 4: Add Entity Translations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Entity translations are stored per-entity:
```

**📋 Create Entity Messages:**

```
contents/themes/your-theme/entities/products/messages/
├── en.json
├── es.json
└── pt.json
```

**📋 English (en.json):**

```json
{
  "products": {
    "label": "Products",
    "labelSingular": "Product",
    "description": "Manage your product catalog",

    "fields": {
      "name": "Name",
      "description": "Description",
      "price": "Price",
      "sku": "SKU",
      "stock": "Stock",
      "category": "Category",
      "status": "Status"
    },

    "placeholders": {
      "name": "Enter product name",
      "description": "Enter product description",
      "sku": "e.g., PROD-001"
    },

    "status": {
      "active": "Active",
      "inactive": "Inactive",
      "draft": "Draft"
    },

    "messages": {
      "created": "Product created successfully",
      "updated": "Product updated successfully",
      "deleted": "Product deleted successfully",
      "notFound": "Product not found"
    },

    "validation": {
      "nameRequired": "Product name is required",
      "pricePositive": "Price must be greater than 0",
      "skuUnique": "SKU already exists"
    }
  }
}
```

**📋 Spanish (es.json):**

```json
{
  "products": {
    "label": "Productos",
    "labelSingular": "Producto",
    "description": "Gestiona tu catálogo de productos",

    "fields": {
      "name": "Nombre",
      "description": "Descripción",
      "price": "Precio",
      "sku": "SKU",
      "stock": "Stock",
      "category": "Categoría",
      "status": "Estado"
    },

    "placeholders": {
      "name": "Ingresa el nombre del producto",
      "description": "Ingresa la descripción del producto",
      "sku": "ej., PROD-001"
    },

    "status": {
      "active": "Activo",
      "inactive": "Inactivo",
      "draft": "Borrador"
    },

    "messages": {
      "created": "Producto creado exitosamente",
      "updated": "Producto actualizado exitosamente",
      "deleted": "Producto eliminado exitosamente",
      "notFound": "Producto no encontrado"
    },

    "validation": {
      "nameRequired": "El nombre del producto es requerido",
      "pricePositive": "El precio debe ser mayor a 0",
      "skuUnique": "El SKU ya existe"
    }
  }
}
```

**📋 Use in Code:**

```typescript
// In React component
import { useTranslations } from 'next-intl'

function ProductForm() {
  const t = useTranslations('products')

  return (
    <form>
      <label>{t('fields.name')}</label>
      <input placeholder={t('placeholders.name')} />

      <label>{t('fields.price')}</label>
      <input type="number" />

      <button type="submit">
        {t('messages.created')}
      </button>
    </form>
  )
}
```

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Component Translations)
[2] Show me validation message patterns
[3] How do I use interpolation?
```

---

## Step 3: Add Component Translations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 4: Add Component Translations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Theme-level translations for UI components:
```

**📋 Theme Messages (en.json):**

```json
{
  "common": {
    "actions": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "search": "Search",
      "filter": "Filter",
      "export": "Export",
      "import": "Import"
    },
    "status": {
      "loading": "Loading...",
      "saving": "Saving...",
      "deleting": "Deleting..."
    },
    "confirm": {
      "delete": "Are you sure you want to delete this?",
      "unsavedChanges": "You have unsaved changes. Discard?"
    },
    "pagination": {
      "showing": "Showing {from} to {to} of {total}",
      "previous": "Previous",
      "next": "Next",
      "page": "Page {current} of {total}"
    }
  },

  "dashboard": {
    "welcome": "Welcome back, {name}!",
    "stats": {
      "totalUsers": "Total Users",
      "activeUsers": "Active Users",
      "revenue": "Revenue",
      "growth": "Growth"
    },
    "navigation": {
      "home": "Home",
      "settings": "Settings",
      "profile": "Profile",
      "logout": "Log out"
    }
  },

  "auth": {
    "login": {
      "title": "Sign In",
      "email": "Email",
      "password": "Password",
      "forgotPassword": "Forgot password?",
      "submit": "Sign In",
      "noAccount": "Don't have an account?",
      "signUp": "Sign Up"
    },
    "register": {
      "title": "Create Account",
      "name": "Full Name",
      "email": "Email",
      "password": "Password",
      "confirmPassword": "Confirm Password",
      "submit": "Create Account",
      "hasAccount": "Already have an account?",
      "signIn": "Sign In"
    }
  },

  "errors": {
    "generic": "Something went wrong. Please try again.",
    "notFound": "Page not found",
    "unauthorized": "You don't have permission to access this",
    "validation": {
      "required": "{field} is required",
      "email": "Please enter a valid email",
      "minLength": "{field} must be at least {min} characters",
      "maxLength": "{field} cannot exceed {max} characters"
    }
  }
}
```

**📋 Using Interpolation:**

```typescript
// Simple interpolation
t('dashboard.welcome', { name: user.name })
// Output: "Welcome back, John!"

// Plural forms
t('items.count', { count: items.length })
// In JSON: "count": "{count, plural, =0 {No items} one {# item} other {# items}}"

// Rich text (with components)
t.rich('terms', {
  link: (chunks) => <a href="/terms">{chunks}</a>
})
// In JSON: "terms": "By signing up you agree to our <link>Terms</link>"
```

**📋 Server Components:**

```typescript
// In Server Components
import { getTranslations } from 'next-intl/server'

async function ServerComponent() {
  const t = await getTranslations('dashboard')

  return <h1>{t('welcome', { name: 'User' })}</h1>
}
```

**📋 Client Components:**

```typescript
'use client'

import { useTranslations } from 'next-intl'

function ClientComponent() {
  const t = useTranslations('common')

  return (
    <button onClick={handleSave}>
      {t('actions.save')}
    </button>
  )
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Add New Language)
[2] Show me date/number formatting
[3] How do I organize large translation files?
```

---

## Step 4: Add New Language

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 4: Add New Language
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To add a new language to your app:
```

**📋 Step 1: Update App Config**

```typescript
// contents/themes/your-theme/config/app.config.ts
export const appConfig: AppConfig = {
  defaultLocale: 'en',
  locales: ['en', 'es', 'pt', 'fr'],  // Add 'fr' for French
  localeLabels: {
    en: 'English',
    es: 'Español',
    pt: 'Português',
    fr: 'Français',  // Add French label
  },
}
```

**📋 Step 2: Create Theme Messages**

```bash
# Copy from English as base
cp contents/themes/your-theme/messages/en.json \
   contents/themes/your-theme/messages/fr.json
```

Then translate fr.json:

```json
{
  "common": {
    "actions": {
      "save": "Enregistrer",
      "cancel": "Annuler",
      "delete": "Supprimer",
      "edit": "Modifier",
      "create": "Créer"
    }
  },
  "dashboard": {
    "welcome": "Bienvenue, {name}!"
  }
}
```

**📋 Step 3: Create Entity Messages**

For each entity:

```bash
# Copy entity messages
cp contents/themes/your-theme/entities/products/messages/en.json \
   contents/themes/your-theme/entities/products/messages/fr.json
```

**📋 Step 4: Rebuild and Test**

```bash
# Rebuild registries
pnpm build:registries

# Start dev server
pnpm dev

# Test at http://localhost:3000/fr
```

**📋 Language Switcher Component:**

```typescript
'use client'

import { useLocale } from 'next-intl'
import { usePathname, useRouter } from 'next/navigation'
import { useAppConfig } from '@/core/lib/hooks/useAppConfig'

function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()
  const config = useAppConfig()

  const switchLocale = (newLocale: string) => {
    // Replace locale in path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <select
      value={locale}
      onChange={(e) => switchLocale(e.target.value)}
    >
      {config.locales.map((loc) => (
        <option key={loc} value={loc}>
          {config.localeLabels[loc]}
        </option>
      ))}
    </select>
  )
}
```

**📋 Translation Checklist:**

- [ ] Update app.config.ts with new locale
- [ ] Create theme messages file
- [ ] Create entity message files for all entities
- [ ] Test all pages in new language
- [ ] Verify date/number formatting
- [ ] Check RTL if applicable (ar, he)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've learned:
• i18n message structure and layers
• Entity translations
• Component translations
• Adding new languages

📚 Related tutorials:
   • /how-to:set-app-languages - Configure supported languages
   • /how-to:customize-theme - Theme customization

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:set-app-languages` | Configure languages |
| `/how-to:create-entity` | Create entities |
