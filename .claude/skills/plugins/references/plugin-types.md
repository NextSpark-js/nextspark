# Plugin Types Reference

Detailed structures and examples for each plugin type.

## 1. Utility Plugin

Simple utilities and helper functions. Minimal structure.

```
my-utility-plugin/
├── package.json
├── plugin.config.ts
├── README.md
├── .env.example
├── lib/
│   ├── utils.ts
│   └── helpers.ts
└── types/
    └── utility.types.ts
```

### Example: String Utilities Plugin

```typescript
// plugin.config.ts
export const stringUtilsConfig: PluginConfig = {
  name: 'string-utils',
  version: '1.0.0',
  displayName: 'String Utilities',
  description: 'Common string manipulation functions',
  enabled: true,
  dependencies: [],
  services: {
    capitalize: undefined,
    slugify: undefined,
    truncate: undefined
  }
}

// lib/utils.ts
export function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function slugify(str: string): string {
  return str.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '')
}

export function truncate(str: string, length: number): string {
  return str.length > length ? str.slice(0, length) + '...' : str
}
```

---

## 2. Service Plugin

Feature-rich plugins with full stack integration including components, hooks, API endpoints.

```
my-service-plugin/
├── package.json
├── plugin.config.ts
├── README.md
├── .env.example
├── types/
│   └── plugin.types.ts
├── lib/
│   ├── core.ts
│   └── client.ts
├── hooks/
│   └── usePlugin.ts
├── components/
│   ├── PluginWidget.tsx
│   └── PluginSettings.tsx
├── providers/
│   └── PluginProvider.tsx
├── api/
│   ├── data/route.ts
│   └── process/route.ts
├── entities/           # If plugin has its own entities
│   └── my-entity/
│       ├── messages/
│       └── migrations/
└── docs/
    └── 01-getting-started/
```

### Example: AI Chat Plugin

```typescript
// plugin.config.ts
export const aiChatConfig: PluginConfig = {
  name: 'ai-chat',
  version: '1.0.0',
  displayName: 'AI Chat',
  description: 'AI-powered chat functionality',
  enabled: true,
  dependencies: [],

  components: {
    ChatWidget: undefined,
    ChatHistory: undefined,
    ChatInput: undefined
  },

  services: {
    useChat: undefined,
    useChatHistory: undefined
  },

  hooks: {
    async onLoad() {
      console.log('[AI Chat] Validating API keys...')
    },
    async onActivate() {
      console.log('[AI Chat] Initializing chat service...')
    }
  }
}
```

---

## 3. Configuration Plugin

Settings and configuration management. Focuses on schema validation and persistence.

```
my-config-plugin/
├── package.json
├── plugin.config.ts
├── README.md
├── .env.example
├── lib/
│   ├── config-loader.ts
│   └── config-validator.ts
├── types/
│   └── config.types.ts
├── schemas/
│   └── settings.schema.ts
└── components/
    └── SettingsForm.tsx
```

### Example: Theme Configuration Plugin

```typescript
// plugin.config.ts
export const themeConfigPlugin: PluginConfig = {
  name: 'theme-config',
  version: '1.0.0',
  displayName: 'Theme Configuration',
  description: 'Manage theme colors, fonts, and styling',
  enabled: true,
  dependencies: [],

  components: {
    ThemeSettings: undefined,
    ColorPicker: undefined,
    FontSelector: undefined
  },

  services: {
    useThemeConfig: undefined,
    useUpdateTheme: undefined
  }
}

// schemas/settings.schema.ts
import { z } from 'zod'

export const ThemeSettingsSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  secondaryColor: z.string().regex(/^#[0-9A-F]{6}$/i),
  fontFamily: z.enum(['inter', 'roboto', 'poppins']),
  fontSize: z.enum(['sm', 'md', 'lg']),
  borderRadius: z.number().min(0).max(24)
})

export type ThemeSettings = z.infer<typeof ThemeSettingsSchema>
```

---

## Choosing the Right Type

| Requirement | Utility | Service | Configuration |
|-------------|---------|---------|---------------|
| Pure functions only | ✅ | ❌ | ❌ |
| UI components | ❌ | ✅ | ✅ |
| API endpoints | ❌ | ✅ | ⚠️ |
| Database entities | ❌ | ✅ | ⚠️ |
| User settings | ❌ | ⚠️ | ✅ |
| External API integration | ⚠️ | ✅ | ❌ |
| Real-time features | ❌ | ✅ | ❌ |

Legend: ✅ Primary use case | ⚠️ Possible but not typical | ❌ Not appropriate
