# Translation Sources

## Introduction

The NextSpark i18n system loads translations from multiple sources, providing a flexible and extensible architecture for managing localized content. This document covers the four translation sources, their structure, merge priority, and best practices for organizing translations across different application layers.

Understanding translation sources is essential for effective localization management and avoiding conflicts when customizing or extending the application.

---

## Translation Source Hierarchy

### Priority Order

Translations merge from multiple sources with a clear priority system:

```text
Plugin Translations (highest priority)
        ↓
Theme Translations
        ↓
Core Translations (lowest priority)
```

**Conflict Resolution**:
When the same translation key exists in multiple sources, the higher-priority source wins.

**Example**:
```json
// core/messages/en/common.json
{
  "buttons": {
    "submit": "Submit"
  }
}

// contents/themes/default/messages/en.json
{
  "buttons": {
    "submit": "Send"
  }
}

// Result:
t('buttons.submit') // Returns: "Send" (theme overrides core)
```

---

## Core Translations

### Overview

Core translations provide the foundational application strings used across all themes and features. These translations are maintained by the core development team and serve as the default fallback for all locales.

**Location**: `core/messages/{locale}/`

**Purpose**:
- System messages
- Authentication flows
- Dashboard UI
- Common components
- Validation messages
- Admin interfaces

### Directory Structure

```text
core/messages/
├── en/                          # English locale
│   ├── common.json             # Shared UI elements (~2.1KB)
│   ├── dashboard.json          # Dashboard content (~1.2KB)
│   ├── settings.json           # Settings pages (~12.5KB)
│   ├── auth.json               # Authentication (~2.8KB)
│   ├── public.json             # Public pages (~10.5KB)
│   ├── validation.json         # Validation messages (~1.6KB)
│   └── admin.json            # Superadmin area
├── es/                          # Spanish locale
│   ├── common.json
│   ├── dashboard.json
│   ├── settings.json
│   ├── auth.json
│   ├── public.json
│   ├── validation.json
│   └── admin.json
└── index.ts                     # Namespace exports (auto-generated)
```

### Core Namespace Examples

#### common.json

Shared UI elements used across the entire application:

```json
{
  "buttons": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "submit": "Submit",
    "close": "Close",
    "back": "Back",
    "next": "Next",
    "previous": "Previous"
  },
  "navigation": {
    "home": "Home",
    "dashboard": "Dashboard",
    "settings": "Settings",
    "profile": "Profile",
    "logout": "Log Out"
  },
  "status": {
    "loading": "Loading...",
    "saving": "Saving...",
    "deleting": "Deleting...",
    "success": "Success!",
    "error": "Error",
    "warning": "Warning"
  },
  "time": {
    "justNow": "Just now",
    "minutesAgo": "{count} minutes ago",
    "hoursAgo": "{count} hours ago",
    "daysAgo": "{count} days ago"
  }
}
```

#### auth.json

Authentication flows and user management:

```json
{
  "login": {
    "title": "Sign In",
    "subtitle": "Welcome back!",
    "emailLabel": "Email Address",
    "emailPlaceholder": "your@email.com",
    "passwordLabel": "Password",
    "passwordPlaceholder": "Enter your password",
    "submitButton": "Sign In",
    "forgotPassword": "Forgot password?",
    "noAccount": "Don't have an account?",
    "signUp": "Sign up",

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
    }
  },

  "signup": {
    "title": "Create Account",
    "subtitle": "Get started today",
    "emailLabel": "Email Address",
    "passwordLabel": "Password",
    "confirmPasswordLabel": "Confirm Password",
    "submitButton": "Create Account",
    "haveAccount": "Already have an account?",
    "signIn": "Sign in",

    "errors": {
      "emailExists": "Email already registered",
      "passwordMismatch": "Passwords do not match",
      "weakPassword": "Password is too weak"
    }
  }
}
```

#### validation.json

Form validation messages with interpolation:

```json
{
  "required": "{field} is required",
  "email": "Please enter a valid email address",
  "minLength": "{field} must be at least {min} characters",
  "maxLength": "{field} must not exceed {max} characters",
  "pattern": "{field} format is invalid",
  "min": "{field} must be at least {min}",
  "max": "{field} must not exceed {max}",
  "url": "Please enter a valid URL",
  "phone": "Please enter a valid phone number",
  "date": "Please enter a valid date",
  "integer": "{field} must be a whole number",
  "decimal": "{field} must be a number",
  "positive": "{field} must be positive",
  "negative": "{field} must be negative",
  "unique": "{field} must be unique",
  "exists": "{field} does not exist"
}
```

### Loading Core Translations

Core translations use dynamic imports (approved exception for core namespaces):

```typescript
// Core namespace loading (internal)
const messages = await import(`./messages/${locale}/common.json`)
```

**Access in Components**:
```typescript
import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('common')
  return <button>{t('buttons.save')}</button>
}
```

### When to Add Core Translations

Add translations to core when:
- ✅ The text is used across multiple themes
- ✅ The translation is fundamental to the application
- ✅ The text is part of system functionality (auth, admin, etc.)
- ✅ The translation should be available in all installations

Don't add to core when:
- ❌ The text is theme-specific branding
- ❌ The translation is for a custom feature
- ❌ The text only appears in one theme
- ❌ The content is marketing or promotional

---

## Theme Translations

### Overview

Theme translations provide theme-specific content and branding, allowing complete UI customization without modifying core translations.

**Location**: `contents/themes/{theme}/messages/{locale}.json`

**Purpose**:
- Theme-specific pages
- Custom navigation
- Branded messaging
- Marketing content
- Feature-specific strings
- Override core translations

### Directory Structure

```text
contents/themes/default/messages/
├── en.json                      # English theme translations (~15KB)
├── es.json                      # Spanish theme translations (~15KB)
└── README.md                    # Optional: translation guidelines
```

### Theme Translation Example

**File**: `contents/themes/default/messages/en.json`

```json
{
  "navigation": {
    "features": "Features",
    "pricing": "Pricing",
    "support": "Support",
    "docs": "Documentation",
    "blog": "Blog",
    "company": "Company"
  },

  "home": {
    "hero": {
      "badge": "Next.js 15 + Better Auth + shadcn/ui",
      "title": "Modern NextSpark",
      "subtitle": "Production-ready starter with authentication, database, and beautiful UI components",
      "cta": {
        "primary": "Get Started Free",
        "secondary": "View Documentation"
      }
    },

    "features": {
      "title": "Everything you need to build a SaaS",
      "subtitle": "All the tools and integrations you need to launch quickly",

      "auth": {
        "title": "Authentication Built-in",
        "description": "Complete auth system with email/password and OAuth providers"
      },

      "database": {
        "title": "Database Ready",
        "description": "PostgreSQL with migrations and type-safe queries"
      },

      "ui": {
        "title": "Beautiful UI Components",
        "description": "shadcn/ui components with full accessibility support"
      }
    }
  },

  "pricing": {
    "title": "Simple, Transparent Pricing",
    "subtitle": "Choose the plan that's right for you",

    "plans": {
      "free": {
        "name": "Free",
        "price": "$0",
        "period": "/month",
        "description": "Perfect for trying out",
        "features": [
          "Up to 3 projects",
          "Basic features",
          "Community support"
        ],
        "cta": "Get Started"
      },

      "pro": {
        "name": "Pro",
        "price": "$19",
        "period": "/month",
        "description": "For professionals",
        "features": [
          "Unlimited projects",
          "Advanced features",
          "Priority support",
          "Custom domain"
        ],
        "cta": "Start Free Trial"
      }
    }
  },

  "footer": {
    "company": "Company",
    "product": "Product",
    "resources": "Resources",
    "legal": "Legal",
    "copyright": "© 2025 Your Company. All rights reserved.",
    "madeWith": "Made with ❤️ by Your Team"
  }
}
```

### Loading Theme Translations

Theme translations use the auto-generated registry:

```typescript
import { loadThemeTranslation } from '@/core/lib/registries/translation-registry'

const translations = await loadThemeTranslation('default', 'en')
```

**Automatic Integration**:
Theme translations are automatically merged into the application's translation system and don't require manual loading in components.

### Overriding Core Translations

Themes can override specific core translations:

```json
// core/messages/en/common.json
{
  "buttons": {
    "submit": "Submit",
    "cancel": "Cancel"
  }
}

// contents/themes/custom/messages/en.json
{
  "buttons": {
    "submit": "Send Now"  // Overrides core translation
  }
}

// Result in components:
t('common.buttons.submit')  // Returns: "Send Now"
t('common.buttons.cancel')  // Returns: "Cancel" (from core)
```

### When to Add Theme Translations

Add translations to theme when:
- ✅ The text is specific to this theme's branding
- ✅ The content is marketing or promotional
- ✅ You want to customize core strings for this theme
- ✅ The translation is for theme-specific features

Don't add to theme when:
- ❌ The text should be available in all themes (use core)
- ❌ The translation is system functionality
- ❌ The content is plugin-specific (use plugin translations)

---

## Plugin Translations

### Overview

Plugin translations provide localized content for plugin-specific features and UI elements.

**Location**: `contents/plugins/{plugin}/messages/{locale}.json`

**Purpose**:
- Plugin-specific UI
- Feature descriptions
- Plugin settings
- Custom workflows
- Override theme/core strings

### Directory Structure

```text
contents/plugins/ai/messages/
├── en.json                      # English plugin translations
├── es.json                      # Spanish plugin translations
└── README.md                    # Optional: translation guidelines
```

### Plugin Translation Example

**File**: `contents/plugins/ai/messages/en.json`

```json
{
  "ai": {
    "title": "AI Assistant",
    "subtitle": "Powered by GPT-4",

    "chat": {
      "placeholder": "Ask me anything...",
      "submit": "Send",
      "clear": "Clear conversation",
      "newChat": "New Chat",

      "thinking": "Thinking...",
      "generating": "Generating response...",

      "errors": {
        "rateLimitExceeded": "Too many requests. Please try again later.",
        "contextTooLong": "Your message is too long. Please shorten it.",
        "serviceUnavailable": "AI service is currently unavailable"
      }
    },

    "settings": {
      "title": "AI Settings",
      "model": {
        "label": "AI Model",
        "gpt4": "GPT-4 (Most Capable)",
        "gpt35": "GPT-3.5 (Faster)"
      },
      "temperature": {
        "label": "Creativity Level",
        "hint": "Higher values make output more creative"
      },
      "maxTokens": {
        "label": "Response Length",
        "short": "Short",
        "medium": "Medium",
        "long": "Long"
      }
    }
  }
}
```

### Loading Plugin Translations

Plugin translations are automatically loaded and merged by the registry system:

```typescript
// Internal: Automatic plugin translation loading
const pluginTranslations = await loadAllPluginTranslations(locale)
```

**Access in Components**:
```typescript
import { useTranslations } from 'next-intl'

export function AIChat() {
  const t = useTranslations('ai.chat')

  return (
    <div>
      <h1>{t('title')}</h1>
      <input placeholder={t('placeholder')} />
    </div>
  )
}
```

### Plugin Translation Override

Plugins have the highest priority and can override both theme and core translations:

```json
// core/messages/en/common.json
{
  "buttons": {
    "save": "Save"
  }
}

// contents/themes/default/messages/en.json
{
  "buttons": {
    "save": "Save Changes"
  }
}

// contents/plugins/custom-workflow/messages/en.json
{
  "buttons": {
    "save": "Apply Workflow"  // Highest priority
  }
}

// Result (when plugin is active):
t('common.buttons.save')  // Returns: "Apply Workflow"
```

### When to Add Plugin Translations

Add translations to plugin when:
- ✅ The text is specific to this plugin's functionality
- ✅ The content is for plugin settings or configuration
- ✅ You need to override core/theme strings for plugin context
- ✅ The translation is for plugin-specific workflows

Don't add to plugin when:
- ❌ The text should be in all installations (use core)
- ❌ The translation is for general theming (use theme)
- ❌ The content is unrelated to the plugin's purpose

---

## Entity Translations

### Overview

Entities can include inline translations for field labels, descriptions, and UI text specific to that entity.

**Location**: Entity configuration i18n section

**Purpose**:
- Field labels
- Field descriptions
- Entity-specific actions
- Validation messages
- Help text

### Entity Translation Configuration

Entities define translations directly in their configuration:

```typescript
// contents/themes/default/entities/tasks/tasks.config.ts
export const taskConfig: EntityConfig = {
  slug: 'tasks',

  names: {
    singular: 'Task',
    plural: 'Tasks'
  },

  i18n: {
    loaders: {
      en: async () => ({
        fields: {
          title: {
            label: "Title",
            placeholder: "Enter task title",
            description: "A brief description of the task"
          },
          description: {
            label: "Description",
            placeholder: "Describe the task...",
            description: "Detailed task information"
          },
          status: {
            label: "Status",
            options: {
              todo: "To Do",
              in_progress: "In Progress",
              done: "Done",
              blocked: "Blocked"
            }
          },
          priority: {
            label: "Priority",
            options: {
              low: "Low",
              medium: "Medium",
              high: "High",
              urgent: "Urgent"
            }
          },
          dueDate: {
            label: "Due Date",
            placeholder: "Select a date"
          }
        },

        actions: {
          create: "Create Task",
          edit: "Edit Task",
          delete: "Delete Task",
          duplicate: "Duplicate Task",
          archive: "Archive Task"
        },

        messages: {
          created: "Task created successfully",
          updated: "Task updated successfully",
          deleted: "Task deleted successfully",
          noTasks: "No tasks found",
          loading: "Loading tasks..."
        }
      }),

      es: async () => ({
        fields: {
          title: {
            label: "Título",
            placeholder: "Ingresa el título de la tarea",
            description: "Una breve descripción de la tarea"
          },
          // ... Spanish translations
        }
      })
    }
  }
}
```

### Accessing Entity Translations

Entity translations are automatically integrated into the namespace system:

```typescript
import { useTranslations } from 'next-intl'

export function TaskForm() {
  // Entity translations loaded under entity slug
  const t = useTranslations('tasks.fields')

  return (
    <form>
      <label>{t('title.label')}</label>
      <input placeholder={t('title.placeholder')} />

      <label>{t('status.label')}</label>
      <select>
        <option value="todo">{t('status.options.todo')}</option>
        <option value="in_progress">{t('status.options.in_progress')}</option>
      </select>
    </form>
  )
}
```

### When to Use Entity Translations

Use entity translations when:
- ✅ The text is specific to entity fields
- ✅ The content is for entity CRUD operations
- ✅ You want translations co-located with entity definition
- ✅ The translation is tightly coupled to entity schema

Use namespace translations when:
- ❌ The text is used across multiple entities
- ❌ The content is for general UI elements
- ❌ You want translations centralized

---

## Translation Merge Process

### Merge Algorithm

The i18n system merges translations from all sources using deep merge:

```typescript
// Pseudo-code for translation merging
function mergeTranslations(locale: string): Messages {
  // 1. Load core translations (base layer)
  const coreMessages = await loadCoreTranslations(locale)

  // 2. Load theme translations (customization layer)
  const themeMessages = await loadThemeTranslations(locale)

  // 3. Load plugin translations (extension layer)
  const pluginMessages = await loadAllPluginTranslations(locale)

  // 4. Load entity translations (domain layer)
  const entityMessages = await loadAllEntityTranslations(locale)

  // 5. Deep merge (higher priority overrides lower)
  return deepMerge(
    coreMessages,
    themeMessages,
    entityMessages,
    pluginMessages  // Highest priority
  )
}
```

### Deep Merge Example

```typescript
// Core
{
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email"
    }
  }
}

// Theme
{
  "auth": {
    "login": {
      "title": "Welcome Back"  // Overrides core
      // emailLabel inherited from core
    }
  }
}

// Plugin
{
  "auth": {
    "login": {
      "emailLabel": "Enter your email"  // Overrides theme & core
    }
  }
}

// Final merged result:
{
  "auth": {
    "login": {
      "title": "Welcome Back",          // From theme
      "emailLabel": "Enter your email"   // From plugin
    }
  }
}
```

### Conflict Resolution

When the same key exists in multiple sources:

1. **Plugin wins** (highest priority)
2. **Theme wins** (if no plugin override)
3. **Core is fallback** (if no theme/plugin override)

**Example**:
```typescript
// All sources define "buttons.submit"
core:   "Submit"
theme:  "Send"
plugin: "Process"

// Result: "Process" (plugin has highest priority)
```

---

## Best Practices

### Do's ✅

**1. Use Core for System Functionality**:
```json
// core/messages/en/auth.json
{
  "login": {
    "title": "Sign In",
    "errors": {
      "invalidCredentials": "Invalid credentials"
    }
  }
}
```

**2. Use Theme for Branding**:
```json
// contents/themes/custom/messages/en.json
{
  "home": {
    "hero": {
      "title": "Your Custom Brand Message"
    }
  }
}
```

**3. Use Plugin for Feature-Specific Text**:
```json
// contents/plugins/analytics/messages/en.json
{
  "analytics": {
    "dashboard": {
      "title": "Analytics Dashboard"
    }
  }
}
```

**4. Override Strategically**:
```json
// Only override what needs to change
{
  "buttons": {
    "submit": "Custom Submit Text"
    // Don't duplicate other buttons if not changing them
  }
}
```

**5. Keep Translations Organized**:
```json
{
  "feature": {
    "component": {
      "element": "Translation"
    }
  }
}
```

### Don'ts ❌

**1. Don't Duplicate Across Sources**:
```json
// BAD - Same translation in core and theme unnecessarily
// core/messages/en/common.json
{ "buttons": { "save": "Save" } }

// contents/themes/default/messages/en.json
{ "buttons": { "save": "Save" } }  // Unnecessary duplication
```

**2. Don't Mix Concerns**:
```json
// BAD - Theme-specific content in core
// core/messages/en/common.json
{
  "companyName": "Acme Corp",  // This is branding, belongs in theme
  "marketingTagline": "We're the best!"  // Marketing content
}
```

**3. Don't Override Without Purpose**:
```json
// BAD - Overriding with identical text
// core
{ "title": "Dashboard" }

// theme
{ "title": "Dashboard" }  // No point in this override
```

**4. Don't Hardcode Strings**:
```typescript
// BAD
<button>Submit</button>

// GOOD
<button>{t('buttons.submit')}</button>
```

**5. Don't Skip Namespaces**:
```json
// BAD - Flat structure
{
  "loginTitle": "Sign In",
  "loginEmail": "Email",
  "signupTitle": "Sign Up"
}

// GOOD - Hierarchical
{
  "auth": {
    "login": {
      "title": "Sign In",
      "emailLabel": "Email"
    },
    "signup": {
      "title": "Sign Up"
    }
  }
}
```

---

## File Organization

### Core Translations Structure

```text
core/messages/
├── en/
│   ├── common.json              # Shared UI (~2KB)
│   ├── dashboard.json           # Dashboard (~1KB)
│   ├── settings.json            # Settings (~12KB)
│   ├── auth.json                # Auth flows (~3KB)
│   ├── public.json              # Public pages (~10KB)
│   ├── validation.json          # Validation (~2KB)
│   └── admin.json             # Superadmin
├── es/
│   └── [same structure]
└── index.ts                     # Auto-generated exports
```

### Theme Translations Structure

```text
contents/themes/[theme]/messages/
├── en.json                      # All theme translations
├── es.json                      # Spanish translations
└── README.md                    # Translation guidelines
```

### Plugin Translations Structure

```text
contents/plugins/[plugin]/messages/
├── en.json                      # Plugin translations
├── es.json                      # Spanish translations
└── README.md                    # Translation guidelines
```

---

## Translation Workflow

### Adding New Translations

**1. Determine Source**:
- System functionality → Core
- Branding/marketing → Theme
- Plugin features → Plugin
- Entity fields → Entity config

**2. Add Translation Keys**:
```json
// Choose appropriate file based on source
{
  "newFeature": {
    "title": "New Feature",
    "description": "Feature description"
  }
}
```

**3. Add All Locales**:
```bash
# Add to all supported locales
core/messages/en/[namespace].json
core/messages/es/[namespace].json
```

**4. Rebuild Registry**:
```bash
pnpm registry:build
```

**5. Use in Components**:
```typescript
const t = useTranslations('newFeature')
<h1>{t('title')}</h1>
```

### Updating Translations

**1. Identify Source**:
```bash
# Search for existing key
grep -r "oldTranslationKey" core/messages/
grep -r "oldTranslationKey" contents/themes/
```

**2. Update All Locales**:
```json
// Update in English
{ "key": "New translation" }

// Update in Spanish
{ "key": "Nueva traducción" }
```

**3. Verify No Duplicates**:
```bash
# Check if key exists in multiple sources
grep -r "translationKey" core/ contents/
```

---

## Next Steps

Now that you understand translation sources, explore:

- **[Translation Registry](./05-translation-registry.md)** - Build-time optimization and performance
- **[Locale Switching](./06-locale-switching.md)** - Implementing user locale selection
- **[Advanced Patterns](./07-advanced-patterns.md)** - Pluralization, formatting, and dynamic values
- **[Testing Translations](./08-testing-translations.md)** - Ensure translation quality and completeness

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
