# /how-to:set-app-languages

Interactive guide to configure internationalization (i18n) in NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/i18n-nextintl/SKILL.md` - Internationalization patterns

---

## Syntax

```
/how-to:set-app-languages
```

---

## Behavior

Guides the user through configuring supported languages, adding translations, and working with the i18n system.

---

## Tutorial Structure

```
STEPS OVERVIEW (5 steps)

Step 1: Understanding i18n Architecture
        └── How translations work

Step 2: Configure Supported Languages
        └── Add new locales

Step 3: Create Translation Files
        └── Message structure

Step 4: Use Translations in Code
        └── Components and hooks

Step 5: Add Entity Translations
        └── Per-entity messages
```

---

## Step 1: Understanding i18n Architecture

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: SET APP LANGUAGES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 5: Understanding i18n Architecture

NextSpark uses next-intl with a layered message system:

┌─────────────────────────────────────────────┐
│  MESSAGE LAYERS (merged at runtime)         │
│  ─────────────────────────────────────────  │
│                                             │
│  1. CORE MESSAGES                           │
│     core/messages/{locale}.json             │
│     → Common UI, errors, auth               │
│                                             │
│  2. THEME MESSAGES                          │
│     messages/{locale}.json                  │
│     → Theme-specific text                   │
│                                             │
│  3. ENTITY MESSAGES                         │
│     entities/{entity}/messages/{locale}.json│
│     → Per-entity labels                     │
│                                             │
│  4. PLUGIN MESSAGES                         │
│     plugins/{plugin}/messages/{locale}.json │
│     → Plugin-specific text                  │
│                                             │
└─────────────────────────────────────────────┘

All layers merge: Theme > Core (theme wins on conflicts)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Namespace Groups:

• common.*        - Buttons, labels, status
• auth.*          - Login, register, errors
• dashboard.*     - Dashboard UI
• entities.*      - Entity-specific labels
• blocks.*        - Page builder blocks
• billing.*       - Plans, subscriptions

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Configure Languages)
[2] Show me the message file structure
[3] How does language detection work?
```

---

## Step 2: Configure Supported Languages

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 5: Configure Supported Languages
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Configure languages in your theme's app config:
```

**📋 app.config.ts Example:**

```typescript
// config/app.config.ts
import type { AppConfig } from '@/core/types/app'

export const appConfig: AppConfig = {
  // Default language for new users
  defaultLocale: 'en',

  // Supported languages
  locales: ['en', 'es', 'pt', 'fr', 'de'],

  // Language labels for UI
  localeLabels: {
    en: 'English',
    es: 'Español',
    pt: 'Português',
    fr: 'Français',
    de: 'Deutsch',
  },

  // Language detection settings
  localeDetection: {
    // Detect from browser headers
    detectFromHeader: true,

    // Detect from URL path (/es/dashboard)
    detectFromPath: true,

    // Store preference in cookie
    storeCookie: true,
  },
}
```

**📋 Adding a New Language:**

1. Add locale code to `locales` array
2. Add label to `localeLabels`
3. Create message files for the locale
4. Rebuild the registry

**📋 Locale Codes:**

Use standard ISO 639-1 codes:
- en - English
- es - Spanish
- pt - Portuguese
- fr - French
- de - German
- it - Italian
- zh - Chinese
- ja - Japanese
- ko - Korean
- ar - Arabic (RTL)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Create Translations)
[2] How do I add RTL language support?
[3] Can I use regional variants (en-US, en-GB)?
```

---

## Step 3: Create Translation Files

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 5: Create Translation Files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📂 Theme Messages Structure:**

```
messages/
├── en.json    # English (required)
├── es.json    # Spanish
├── pt.json    # Portuguese
└── ...
```

**📋 Message File Template (en.json):**

```json
{
  "common": {
    "buttons": {
      "save": "Save",
      "cancel": "Cancel",
      "delete": "Delete",
      "edit": "Edit",
      "create": "Create",
      "submit": "Submit",
      "back": "Back"
    },
    "status": {
      "loading": "Loading...",
      "saving": "Saving...",
      "success": "Success!",
      "error": "An error occurred"
    },
    "labels": {
      "name": "Name",
      "email": "Email",
      "phone": "Phone",
      "address": "Address",
      "date": "Date",
      "status": "Status"
    },
    "teamRoles": {
      "owner": "Owner",
      "admin": "Administrator",
      "member": "Member",
      "viewer": "Viewer"
    }
  },

  "dashboard": {
    "title": "Dashboard",
    "welcome": "Welcome, {name}!",
    "sidebar": {
      "home": "Home",
      "settings": "Settings",
      "profile": "Profile"
    }
  },

  "auth": {
    "login": {
      "title": "Sign In",
      "email": "Email address",
      "password": "Password",
      "submit": "Sign In",
      "forgotPassword": "Forgot password?",
      "noAccount": "Don't have an account?",
      "signUp": "Sign up"
    },
    "errors": {
      "invalidCredentials": "Invalid email or password",
      "accountLocked": "Account is locked",
      "sessionExpired": "Your session has expired"
    }
  },

  "settings": {
    "title": "Settings",
    "sections": {
      "profile": "Profile Settings",
      "security": "Security",
      "notifications": "Notifications",
      "billing": "Billing"
    }
  }
}
```

**📋 Spanish Translation (es.json):**

```json
{
  "common": {
    "buttons": {
      "save": "Guardar",
      "cancel": "Cancelar",
      "delete": "Eliminar",
      "edit": "Editar",
      "create": "Crear",
      "submit": "Enviar",
      "back": "Volver"
    },
    "status": {
      "loading": "Cargando...",
      "saving": "Guardando...",
      "success": "¡Éxito!",
      "error": "Ocurrió un error"
    }
  },

  "dashboard": {
    "title": "Panel de Control",
    "welcome": "¡Bienvenido, {name}!",
    "sidebar": {
      "home": "Inicio",
      "settings": "Configuración",
      "profile": "Perfil"
    }
  }
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Use in Code)
[2] How do I use variables in translations?
[3] How do I handle pluralization?
```

---

## Step 4: Use Translations in Code

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 5: Use Translations in Code
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 In Server Components:**

```typescript
// app/[locale]/dashboard/page.tsx
import { getTranslations } from 'next-intl/server'

export default async function DashboardPage() {
  const t = await getTranslations('dashboard')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('welcome', { name: 'John' })}</p>
    </div>
  )
}
```

**📋 In Client Components:**

```typescript
'use client'

import { useTranslations } from 'next-intl'

export function WelcomeCard({ userName }: { userName: string }) {
  const t = useTranslations('dashboard')
  const tCommon = useTranslations('common.buttons')

  return (
    <div>
      <h2>{t('welcome', { name: userName })}</h2>
      <button>{tCommon('save')}</button>
    </div>
  )
}
```

**📋 With Variables (Interpolation):**

```json
// messages/en.json
{
  "items": {
    "count": "You have {count} items",
    "selected": "{count} of {total} selected"
  }
}
```

```typescript
t('items.count', { count: 5 })
// "You have 5 items"

t('items.selected', { count: 3, total: 10 })
// "3 of 10 selected"
```

**📋 With Pluralization:**

```json
// messages/en.json
{
  "cart": {
    "items": "{count, plural, =0 {No items} =1 {1 item} other {# items}}"
  }
}
```

```typescript
t('cart.items', { count: 0 })  // "No items"
t('cart.items', { count: 1 })  // "1 item"
t('cart.items', { count: 5 })  // "5 items"
```

**📋 Change Language:**

```typescript
'use client'

import { useLocale } from 'next-intl'
import { useRouter, usePathname } from 'next/navigation'

export function LanguageSwitcher() {
  const locale = useLocale()
  const router = useRouter()
  const pathname = usePathname()

  const switchLocale = (newLocale: string) => {
    // Replace locale in path
    const newPath = pathname.replace(`/${locale}`, `/${newLocale}`)
    router.push(newPath)
  }

  return (
    <select value={locale} onChange={(e) => switchLocale(e.target.value)}>
      <option value="en">English</option>
      <option value="es">Español</option>
    </select>
  )
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Entity Translations)
[2] How do I format dates and numbers?
[3] Show me rich text translations
```

---

## Step 5: Add Entity Translations

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 5: Add Entity Translations
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Entities have their own translation files:
```

**📂 Entity Messages Structure:**

```
entities/products/messages/
├── en.json
└── es.json
```

**📋 Entity Messages (en.json):**

```json
{
  "entities": {
    "products": {
      "name": "Product",
      "namePlural": "Products",
      "description": "Manage your product catalog",

      "fields": {
        "name": "Product Name",
        "description": "Description",
        "price": "Price",
        "sku": "SKU Code",
        "category": "Category",
        "isActive": "Active"
      },

      "placeholders": {
        "name": "Enter product name...",
        "description": "Describe this product...",
        "sku": "e.g., PROD-001"
      },

      "actions": {
        "create": "Create Product",
        "edit": "Edit Product",
        "delete": "Delete Product",
        "duplicate": "Duplicate Product"
      },

      "messages": {
        "created": "Product created successfully",
        "updated": "Product updated successfully",
        "deleted": "Product deleted successfully",
        "confirmDelete": "Are you sure you want to delete this product?",
        "notFound": "Product not found"
      },

      "filters": {
        "active": "Active products",
        "inactive": "Inactive products",
        "all": "All products"
      }
    }
  }
}
```

**📋 Entity Messages (es.json):**

```json
{
  "entities": {
    "products": {
      "name": "Producto",
      "namePlural": "Productos",
      "description": "Administra tu catálogo de productos",

      "fields": {
        "name": "Nombre del Producto",
        "description": "Descripción",
        "price": "Precio",
        "sku": "Código SKU",
        "category": "Categoría",
        "isActive": "Activo"
      },

      "actions": {
        "create": "Crear Producto",
        "edit": "Editar Producto",
        "delete": "Eliminar Producto"
      },

      "messages": {
        "created": "Producto creado exitosamente",
        "updated": "Producto actualizado exitosamente",
        "deleted": "Producto eliminado exitosamente",
        "confirmDelete": "¿Estás seguro de que deseas eliminar este producto?"
      }
    }
  }
}
```

**📋 Use in Entity Forms:**

```typescript
// Entity config references i18n keys
export const productsEntity: EntityConfig = {
  displayName: 'entities.products.name',
  displayNamePlural: 'entities.products.namePlural',
  fields: {
    name: {
      label: 'entities.products.fields.name',
      placeholder: 'entities.products.placeholders.name',
    },
    // ...
  },
}
```

**📋 Rebuild Translation Registry:**

```bash
node core/scripts/build/registry.mjs
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've configured:
• Supported languages in app config
• Theme message files
• Entity-specific translations
• Translation usage in components

📚 Related tutorials:
   • /how-to:create-entity - Create entities with i18n
   • /how-to:customize-theme - Theme customization

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:add-translations` | Add more translations |
| `/how-to:create-entity` | Entity with i18n |
