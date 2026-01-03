# Plugin Structure

## Introduction

This document provides a complete reference for plugin directory structure and organization. Understanding the standard plugin structure is essential for creating well-organized, maintainable plugins that integrate seamlessly with the application.

**Key Principles:**
- **Convention over Configuration** - Standard directory structure for predictability
- **Self-Contained** - All plugin code, assets, and config in one directory
- **Type-Safe** - TypeScript throughout with strict type checking
- **Discoverable** - Build script automatically finds and registers plugins
- **Modular** - Clear separation of concerns (API, components, hooks, lib)

---

## Standard Plugin Structure

### Complete Directory Layout

```text
contents/plugins/[plugin-name]/
├── plugin.config.ts        # ✅ REQUIRED - Plugin configuration
├── README.md               # ✅ REQUIRED - Plugin documentation
├── .env.example            # ✅ REQUIRED - Environment variable template
├── .env                    # ⚠️ IGNORED - Local environment variables (git-ignored)
├── .gitignore              # ✅ RECOMMENDED - Ignore patterns for plugin
├── package.json            # ⚠️ OPTIONAL - Plugin-specific dependencies
├── tsconfig.json           # ⚠️ OPTIONAL - Plugin-specific TypeScript config
├── types/                  # ✅ RECOMMENDED - TypeScript type definitions
│   └── [plugin].types.ts
├── lib/                    # ✅ RECOMMENDED - Core plugin logic
│   ├── core-utils.ts       # Main plugin utilities
│   ├── [feature]-service.ts # Business logic services
│   └── server-env.ts       # Environment configuration
├── api/                    # ⚠️ OPTIONAL - API endpoints
│   ├── README.md           # API documentation
│   ├── [endpoint]/
│   │   └── route.ts        # Next.js API route handler
│   └── [nested]/[param]/
│       └── route.ts
├── components/             # ⚠️ OPTIONAL - React components
│   ├── [Component].tsx     # React component files
│   └── index.ts            # Component exports
├── hooks/                  # ⚠️ OPTIONAL - Custom React hooks
│   ├── use[Feature].ts     # Custom hooks
│   └── index.ts            # Hook exports
├── entities/               # ⚠️ OPTIONAL - Plugin-specific entities
│   └── [entity-name]/
│       ├── [entity].config.ts
│       ├── [entity].fields.ts
│       ├── [entity].types.ts
│       └── [entity].service.ts
├── docs/                   # ⚠️ OPTIONAL - Plugin documentation
│   ├── 01-getting-started/
│   │   ├── 01-introduction.md
│   │   └── 02-installation.md
│   └── 02-features/
│       └── 01-[feature].md
├── public/                 # ⚠️ OPTIONAL - Public assets
│   └── docs/               # Documentation images
│       └── [image].png
├── migrations/             # ⚠️ OPTIONAL - Database migrations
│   └── [timestamp]_[description].sql
├── messages/               # ⚠️ OPTIONAL - i18n translations
│   ├── en.json
│   └── es.json
└── node_modules/           # ⚠️ AUTO-GENERATED - Plugin dependencies (git-ignored)
```

**Legend:**
- ✅ **REQUIRED** - Must be present for plugin to be discovered
- ✅ **RECOMMENDED** - Should be included for best practices
- ⚠️ **OPTIONAL** - Include only if needed for your plugin
- ⚠️ **IGNORED** - Git-ignored, not committed to repository
- ⚠️ **AUTO-GENERATED** - Created automatically, don't edit manually

---

## Required Files

### 1. `plugin.config.ts` ✅ REQUIRED

**Purpose**: Main plugin configuration file that defines plugin metadata, capabilities, and lifecycle hooks.

**Must export**: A `PluginConfig` object with plugin name, version, and settings.

**Example:**
```typescript
// contents/plugins/my-plugin/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'

export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Awesome Plugin',
  version: '1.0.0',
  description: 'A plugin that does amazing things',
  enabled: true,
  dependencies: [],

  // API exports
  api: {
    processData: () => import('./lib/core-utils').then(m => m.processData),
    validateInput: () => import('./lib/core-utils').then(m => m.validateInput)
  },

  // Lifecycle hooks
  hooks: {
    async onLoad() {
      console.log('[My Plugin] Loading...')
    }
  }
}

export default myPluginConfig
```

**Naming Convention**: `[plugin-name].config.ts` OR `plugin.config.ts`

**Discovery**: Build script (`core/scripts/build/registry.mjs`) looks for this file to identify plugins.

---

### 2. `README.md` ✅ REQUIRED

**Purpose**: Plugin documentation for developers and users.

**Must include**:
- Plugin name and description
- Features list
- Installation instructions
- Configuration guide
- Usage examples
- API reference (if applicable)

**Example:**
```markdown
# My Plugin

Brief description of what the plugin does.

## Features

- ✅ Feature 1
- ✅ Feature 2
- ✅ Feature 3

## Installation

1. Copy environment variables:
   ```bash
   cp contents/plugins/my-plugin/.env.example contents/plugins/my-plugin/.env
   ```

2. Configure your API keys in `.env`

3. Rebuild registry:
   ```bash
   pnpm registry:build
   ```

## Usage

### Basic Usage
```typescript
import { usePlugin } from '@/core/lib/registries/plugin-registry'

const { processData } = usePlugin('my-plugin')
const result = await processData({ input: 'test' })
```

## API Reference

### `processData(input)`
Processes input data and returns result.

**Parameters:**
- `input` (object) - Input data to process

**Returns:**
- `Promise<Result>` - Processing result

## Configuration

See `.env.example` for all available configuration options.
```

**Format**: Markdown with code examples, preferably in English

---

### 3. `.env.example` ✅ REQUIRED

**Purpose**: Template for plugin environment variables that developers copy to `.env`.

**Must include**:
- All plugin-namespaced environment variables
- Clear descriptions of each variable
- Example values
- Warning about not including global variables

**Example:**
```bash
# contents/plugins/my-plugin/.env.example
# ============================================
# MY PLUGIN ENVIRONMENT VARIABLES
# ============================================
#
# ⚠️  IMPORTANT:
# - This file should ONLY contain MY_PLUGIN_* namespaced variables
# - Global variables should be in root .env ONLY
# - This prevents override conflicts
#
# ❌ DO NOT PUT IN THIS FILE:
# - USE_LOCAL_AI
# - API keys (unless plugin-specific)
# - DATABASE_URL
# - Any system-wide configuration
#
# ✅ ONLY PUT IN THIS FILE:
# - MY_PLUGIN_* namespaced variables
# ============================================

# Enable/disable plugin
MY_PLUGIN_ENABLED=true

# Debug mode
MY_PLUGIN_DEBUG=false

# Plugin-specific API key
MY_PLUGIN_API_KEY=your_api_key_here

# Maximum requests per minute
MY_PLUGIN_MAX_REQUESTS=100

# Request timeout (milliseconds)
MY_PLUGIN_TIMEOUT=5000
```

**Naming**: Always `.env.example`, never commit `.env` to git

---

## Recommended Directories

### `types/` Directory ✅ RECOMMENDED

**Purpose**: TypeScript type definitions for plugin data structures.

**Structure**:
```text
types/
├── [plugin].types.ts       # Main plugin types
└── index.ts                # Type exports (optional)
```

**Example:**
```typescript
// contents/plugins/my-plugin/types/my-plugin.types.ts
export interface MyPluginOptions {
  readonly apiKey: string
  readonly timeout: number
  readonly retryAttempts: number
}

export interface MyPluginResult<T = unknown> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly metadata: {
    readonly processingTime: number
    readonly timestamp: string
  }
}

export interface MyPluginConfig {
  readonly enabled: boolean
  readonly debug: boolean
  readonly maxRequests: number
}
```

**Naming Convention**: `kebab-case` with `.types.ts` suffix

**Best Practices**:
- Use `readonly` for immutable properties
- Export all types for use in other parts of the application
- Use generic types for flexible data structures
- Document complex types with JSDoc comments

---

### `lib/` Directory ✅ RECOMMENDED

**Purpose**: Core plugin logic, utilities, and business services.

**Structure**:
```text
lib/
├── core-utils.ts           # Main plugin utilities (exported via plugin.config.ts)
├── [feature]-service.ts    # Business logic services
├── server-env.ts           # Environment configuration loader
├── plugin-env.ts           # Alternative environment loader
├── sanitize.ts             # Input sanitization
└── [helper].ts             # Additional helpers
```

**Example - Core Utilities:**
```typescript
// contents/plugins/my-plugin/lib/core-utils.ts
import type { MyPluginOptions, MyPluginResult } from '../types/my-plugin.types'

/**
 * Process data using plugin logic
 */
export async function processData(
  input: string,
  options: MyPluginOptions
): Promise<MyPluginResult<string>> {
  try {
    // Processing logic
    const result = await performProcessing(input, options)

    return {
      success: true,
      data: result,
      metadata: {
        processingTime: Date.now(),
        timestamp: new Date().toISOString()
      }
    }
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      metadata: {
        processingTime: Date.now(),
        timestamp: new Date().toISOString()
      }
    }
  }
}

/**
 * Validate plugin input
 */
export function validateInput(input: unknown): boolean {
  // Validation logic
  return typeof input === 'string' && input.length > 0
}
```

**Example - Environment Configuration:**
```typescript
// contents/plugins/my-plugin/lib/server-env.ts
import { config } from 'dotenv'
import { join } from 'path'
import type { MyPluginConfig } from '../types/my-plugin.types'

// Load plugin-level .env file
config({ path: join(__dirname, '../.env') })

export const pluginEnv: MyPluginConfig = {
  enabled: process.env.MY_PLUGIN_ENABLED === 'true',
  debug: process.env.MY_PLUGIN_DEBUG === 'true',
  maxRequests: parseInt(process.env.MY_PLUGIN_MAX_REQUESTS || '100', 10),
  timeout: parseInt(process.env.MY_PLUGIN_TIMEOUT || '5000', 10),
  apiKey: process.env.MY_PLUGIN_API_KEY || ''
}

// Validate configuration
export function validateEnvironment(): void {
  if (!pluginEnv.apiKey) {
    throw new Error('[My Plugin] API key is required')
  }

  if (pluginEnv.maxRequests < 1) {
    throw new Error('[My Plugin] Max requests must be at least 1')
  }
}
```

**Naming Convention**: `kebab-case` with `.ts` suffix

---

## Optional Directories

### `api/` Directory ⚠️ OPTIONAL

**Purpose**: Next.js API route handlers for plugin endpoints.

**Structure**:
```text
api/
├── README.md               # API documentation
├── [endpoint]/
│   └── route.ts            # GET, POST, PATCH, DELETE handlers
├── [nested]/[param]/
│   └── route.ts
└── [feature]/
    └── route.ts
```

**Example API Route:**
```typescript
// contents/plugins/my-plugin/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export async function POST(request: NextRequest) {
  // Authenticate request
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  // Get plugin functions
  const { processData } = usePlugin('my-plugin')

  // Validate input
  const body = await request.json()
  if (!body.input) {
    return NextResponse.json(
      { error: 'Input is required' },
      { status: 400 }
    )
  }

  // Process data
  const result = await processData(body.input)

  return NextResponse.json(result)
}

export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  return NextResponse.json({
    status: 'healthy',
    plugin: 'my-plugin',
    version: '1.0.0'
  })
}
```

**URL Pattern**: `/api/v1/plugin/[plugin-name]/[endpoint]`

**Example URLs**:
- `/api/v1/plugin/my-plugin/process`
- `/api/v1/plugin/ai/generate`
- `/api/v1/plugin/billing/subscriptions`

**Best Practices**:
- Always authenticate requests using `authenticateRequest`
- Validate all inputs with Zod schemas
- Return proper HTTP status codes
- Include error messages in responses
- Use TypeScript for request/response types

---

### `components/` Directory ⚠️ OPTIONAL

**Purpose**: React components that integrate with the application UI.

**Structure**:
```text
components/
├── MyComponent.tsx         # React component
├── MyButton.tsx
├── MyForm.tsx
└── index.ts                # Component exports
```

**Example Component:**
```typescript
// contents/plugins/my-plugin/components/MyWidget.tsx
'use client'

import { useState } from 'react'
import { Button } from '@/core/components/ui/button'

interface MyWidgetProps {
  initialValue?: string
  onProcess?: (result: string) => void
}

export function MyWidget({ initialValue = '', onProcess }: MyWidgetProps) {
  const [value, setValue] = useState(initialValue)
  const [loading, setLoading] = useState(false)

  const handleProcess = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/v1/plugin/my-plugin/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input: value })
      })

      const result = await response.json()

      if (result.success && onProcess) {
        onProcess(result.data)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4" data-cy="my-plugin-widget">
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full px-4 py-2 border rounded-md"
        data-cy="my-plugin-input"
      />
      <Button
        onClick={handleProcess}
        disabled={loading || !value}
        data-cy="my-plugin-process-button"
      >
        {loading ? 'Processing...' : 'Process'}
      </Button>
    </div>
  )
}
```

**Naming Convention**: PascalCase (e.g., `MyComponent.tsx`)

**Best Practices**:
- Use `'use client'` directive for client components
- Include `data-cy` attributes for Cypress E2E testing
- Use shadcn/ui components for consistency
- Handle loading and error states
- Make components accessible (ARIA attributes)
- Use TypeScript for props

---

### `hooks/` Directory ⚠️ OPTIONAL

**Purpose**: Custom React hooks for reusable plugin logic.

**Structure**:
```text
hooks/
├── useMyPlugin.ts          # Main plugin hook
├── useMyFeature.ts         # Feature-specific hook
└── index.ts                # Hook exports
```

**Example Hook:**
```typescript
// contents/plugins/my-plugin/hooks/useMyPlugin.ts
'use client'

import { useState, useCallback } from 'react'

interface UseMyPluginOptions {
  autoProcess?: boolean
}

export function useMyPlugin(options: UseMyPluginOptions = {}) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const processData = useCallback(async (input: string) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/v1/plugin/my-plugin/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Processing failed')
      }

      setResult(data)
      return data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    processData,
    loading,
    error,
    result,
    reset: () => {
      setResult(null)
      setError(null)
    }
  }
}
```

**Naming Convention**: `camelCase` starting with `use` (e.g., `useMyPlugin.ts`)

---

### `entities/` Directory ⚠️ OPTIONAL

**Purpose**: Plugin-specific database entities with CRUD operations.

**Structure**:
```text
entities/
└── [entity-name]/
    ├── [entity].config.ts  # Entity configuration
    ├── [entity].fields.ts  # Field definitions
    ├── [entity].types.ts   # TypeScript interfaces
    ├── [entity].service.ts # Data access service
    └── messages/           # i18n translations
```

**Example Entity Configuration:**
```typescript
// contents/plugins/my-plugin/entities/my-records/my-records.config.ts
import type { EntityConfig } from '@/core/types/entity'

export const myRecordsConfig: EntityConfig = {
  name: 'my-records',
  label: 'My Record',
  pluralLabel: 'My Records',
  icon: 'Database',

  api: {
    enabled: true,
    basePath: '/api/v1/my-records'
  },

  dashboard: {
    enabled: true,
    path: '/dashboard/my-records'
  },

  database: {
    table: 'my_records',
    primaryKey: 'id'
  },

  pluginContext: {
    pluginName: 'my-plugin'
  }
}
```

**Example Field Definitions:**
```typescript
// contents/plugins/my-plugin/entities/my-records/my-records.fields.ts
import type { FieldDefinition } from '@/core/types/entity'

export const myRecordsFields: FieldDefinition[] = [
  {
    name: 'title',
    type: 'text',
    label: 'Title',
    required: true,
    validation: {
      minLength: 3,
      maxLength: 255
    }
  },
  {
    name: 'status',
    type: 'select',
    label: 'Status',
    required: true,
    options: [
      { value: 'active', label: 'Active' },
      { value: 'inactive', label: 'Inactive' }
    ]
  }
]
```

**Registry Integration**: Plugin entities are automatically discovered and included in `ENTITY_REGISTRY`

---

### `docs/` Directory ⚠️ OPTIONAL

**Purpose**: Comprehensive plugin documentation with examples and guides.

**Structure**:
```text
docs/
├── 01-getting-started/
│   ├── 01-introduction.md
│   ├── 02-installation.md
│   └── 03-configuration.md
├── 02-features/
│   ├── 01-feature-one.md
│   └── 02-feature-two.md
└── 03-api-reference/
    ├── 01-endpoints.md
    └── 02-functions.md
```

**Example Documentation:**
```markdown
# Feature: Data Processing

## Overview

The data processing feature allows you to transform input data using AI-powered algorithms.

## Usage

### Basic Example
```typescript
import { usePlugin } from '@/core/lib/registries/plugin-registry'

const { processData } = usePlugin('my-plugin')
const result = await processData({ input: 'test data' })
console.log(result.data)
```

### Advanced Example
```typescript
const result = await processData({
  input: 'complex data',
  options: {
    timeout: 10000,
    retryAttempts: 3
  }
})
```

## API Reference

### `processData(input, options?)`

Processes input data and returns a result.

**Parameters:**
- `input` (string) - The data to process
- `options` (object, optional) - Processing options
  - `timeout` (number) - Request timeout in milliseconds
  - `retryAttempts` (number) - Number of retry attempts

**Returns:**
- `Promise<MyPluginResult>` - Processing result

**Throws:**
- `MyPluginError` - If processing fails

## Examples

See the [examples directory](/contents/plugins/my-plugin/examples) for more use cases.
```

**Format**: Markdown with code examples, English preferred

---

### `public/` Directory ⚠️ OPTIONAL

**Purpose**: Public assets accessible via URLs (images, fonts, etc.).

**Structure**:
```text
public/
└── docs/               # Documentation images
    ├── screenshot.png
    ├── diagram.svg
    └── logo.png
```

**Access Pattern**: `/theme/docs/[filename]` (if theme build script copies them)

**Best Practices**:
- Keep image sizes optimized (< 500KB per image)
- Use WebP format for photos
- Use SVG for logos and diagrams
- Include alt text in documentation

---

### `migrations/` Directory ⚠️ OPTIONAL

**Purpose**: Database migration scripts for plugin tables.

**Structure**:
```text
migrations/
├── 001_create_my_records.sql
├── 002_add_status_column.sql
└── 003_create_indexes.sql
```

**Example Migration:**
```sql
-- migrations/001_create_my_records.sql
CREATE TABLE IF NOT EXISTS my_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Row-level security
ALTER TABLE my_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY my_records_user_isolation ON my_records
  FOR ALL
  USING (user_id = current_setting('app.current_user_id')::uuid);

-- Indexes
CREATE INDEX idx_my_records_user_id ON my_records(user_id);
CREATE INDEX idx_my_records_status ON my_records(status);
```

**Naming**: `[number]_[description].sql`

---

### `messages/` Directory ⚠️ OPTIONAL

**Purpose**: Internationalization (i18n) translations for plugin text.

**Structure**:
```text
messages/
├── en.json
├── es.json
├── fr.json
└── de.json
```

**Example Translations:**
```json
// messages/en.json
{
  "my-plugin": {
    "title": "My Plugin",
    "description": "A plugin that does amazing things",
    "actions": {
      "process": "Process Data",
      "cancel": "Cancel"
    },
    "messages": {
      "processing": "Processing...",
      "success": "Processing completed successfully",
      "error": "Processing failed"
    }
  }
}

// messages/es.json
{
  "my-plugin": {
    "title": "Mi Plugin",
    "description": "Un plugin que hace cosas increíbles",
    "actions": {
      "process": "Procesar Datos",
      "cancel": "Cancelar"
    },
    "messages": {
      "processing": "Procesando...",
      "success": "Procesamiento completado exitosamente",
      "error": "Error en el procesamiento"
    }
  }
}
```

**Usage in Components:**
```typescript
import { useTranslations } from 'next-intl'

export function MyComponent() {
  const t = useTranslations('my-plugin')

  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
      <button>{t('actions.process')}</button>
    </div>
  )
}
```

---

## File Naming Conventions

### TypeScript Files

| Type | Convention | Example |
|------|------------|---------|
| **Config** | `kebab-case.config.ts` | `plugin.config.ts`, `my-plugin.config.ts` |
| **Types** | `kebab-case.types.ts` | `my-plugin.types.ts`, `ai.types.ts` |
| **Utils** | `kebab-case.ts` | `core-utils.ts`, `server-env.ts` |
| **Services** | `kebab-case-service.ts` | `my-plugin-service.ts` |
| **Routes** | `route.ts` | `api/process/route.ts` |
| **Components** | `PascalCase.tsx` | `MyWidget.tsx`, `ProcessButton.tsx` |
| **Hooks** | `camelCase.ts` starting with `use` | `useMyPlugin.ts` |

### Non-TypeScript Files

| Type | Convention | Example |
|------|------------|---------|
| **Documentation** | `kebab-case.md` | `README.md`, `01-introduction.md` |
| **Environment** | `.env`, `.env.example` | `.env.example` |
| **Config** | `lowercase.json` | `package.json`, `tsconfig.json` |
| **Translations** | `[locale].json` | `en.json`, `es.json` |
| **SQL** | `[number]_[description].sql` | `001_create_table.sql` |

---

## Real-World Examples

### AI Plugin Structure

```text
contents/plugins/ai/
├── plugin.config.ts        # ✅ Plugin configuration
├── README.md               # ✅ Comprehensive docs (Spanish)
├── .env.example            # ✅ Environment template
├── .env                    # ⚠️ Local config (git-ignored)
├── .gitignore
├── package.json            # Plugin-specific dependencies
├── tsconfig.json
├── types/
│   └── ai.types.ts         # AI-specific types
├── lib/
│   ├── core-utils.ts       # selectModel, calculateCost, etc.
│   ├── ai-history-service.ts
│   ├── ai-history-meta-service.ts
│   ├── server-env.ts
│   ├── plugin-env.ts
│   ├── sanitize.ts
│   ├── ai-sdk.ts
│   └── save-example.ts
├── api/
│   ├── README.md
│   ├── generate/
│   │   └── route.ts        # POST /api/v1/plugin/ai/generate
│   ├── embeddings/
│   │   └── route.ts
│   └── ai-history/[id]/
│       └── route.ts
├── entities/
│   └── ai-history/
│       ├── ai-history.config.ts
│       └── ai-history.fields.ts
├── docs/
│   ├── 01-getting-started/
│   │   ├── 01-introduction.md
│   │   └── 02-installation.md
│   └── 02-features/
│       ├── 01-chat.md
│       └── 02-embeddings.md
└── public/
    └── docs/
        └── [images].png
```

---

### Billing Plugin Structure

```text
contents/plugins/billing/
├── plugin.config.ts        # ✅ Plugin configuration
├── .env.example            # ✅ Environment template
├── package.json
├── api/
│   ├── subscriptions/
│   │   └── route.ts        # POST /api/v1/plugin/billing/subscriptions
│   ├── invoices/
│   │   └── route.ts
│   └── webhooks/
│       └── route.ts        # Stripe webhook handler
├── components/
│   ├── SubscriptionCard.tsx
│   ├── PaymentForm.tsx
│   └── index.ts
├── hooks/
│   ├── useSubscription.ts
│   ├── useBilling.ts
│   └── index.ts
├── lib/
│   ├── stripe-client.ts
│   ├── subscription-service.ts
│   └── billing-utils.ts
└── messages/
    ├── en.json
    └── es.json
```

---

## Organization Best Practices

### 1. Keep Plugins Self-Contained

**✅ Good:**
```text
my-plugin/
├── plugin.config.ts        # All config in plugin directory
├── lib/
│   └── utils.ts            # Plugin-specific utilities
└── api/
    └── process/route.ts    # Plugin-specific endpoints
```

**❌ Bad:**
```text
my-plugin/
├── plugin.config.ts
└── utils.ts                # ❌ Should be in lib/

core/lib/
└── my-plugin-utils.ts      # ❌ Plugin code outside plugin directory
```

### 2. Use Clear Directory Names

**✅ Good:**
```text
lib/core-utils.ts           # Clear purpose
lib/user-service.ts         # Clear purpose
api/process/route.ts        # Clear endpoint
```

**❌ Bad:**
```text
lib/utils.ts                # Too generic
lib/helpers.ts              # What kind of helpers?
api/route.ts                # What does this do?
```

### 3. Group Related Files

**✅ Good:**
```text
entities/
└── ai-history/
    ├── ai-history.config.ts
    ├── ai-history.fields.ts
    └── ai-history.service.ts   # Related logic together
```

**❌ Bad:**
```text
entities/ai-history.config.ts   # ❌ Not grouped
lib/ai-history-service.ts       # ❌ Related file elsewhere
```

### 4. Separate Server and Client Code

**✅ Good:**
```text
lib/
├── server-env.ts           # Server-only
├── core-utils.ts           # Server-only
components/
├── MyWidget.tsx            # 'use client'
hooks/
└── useMyPlugin.ts          # 'use client'
```

**❌ Bad:**
```text
lib/
├── utils.ts                # ❌ Mixed server/client code
└── client-server-mix.ts    # ❌ No clear boundary
```

### 5. Document Public APIs

**✅ Good:**
```typescript
/**
 * Process data using plugin logic
 *
 * @param input - The data to process
 * @param options - Processing options
 * @returns Processing result with metadata
 * @throws {MyPluginError} If processing fails
 *
 * @example
 * ```typescript
 * const result = await processData('test', { timeout: 5000 })
 * console.log(result.data)
 * ```text
 */
export async function processData(
  input: string,
  options: MyPluginOptions
): Promise<MyPluginResult>
```

**❌ Bad:**
```typescript
// No documentation
export async function processData(input: string, options: any)
```

---

## Summary

**Required Files:**
- ✅ `plugin.config.ts` - Plugin configuration
- ✅ `README.md` - Plugin documentation
- ✅ `.env.example` - Environment variable template

**Recommended Directories:**
- ✅ `types/` - TypeScript type definitions
- ✅ `lib/` - Core plugin logic

**Optional Directories:**
- ⚠️ `api/` - API route handlers
- ⚠️ `components/` - React components
- ⚠️ `hooks/` - Custom React hooks
- ⚠️ `entities/` - Plugin-specific entities
- ⚠️ `docs/` - Comprehensive documentation
- ⚠️ `public/` - Public assets
- ⚠️ `migrations/` - Database migrations
- ⚠️ `messages/` - i18n translations

**Naming Conventions:**
- Config files: `kebab-case.config.ts`
- Components: `PascalCase.tsx`
- Hooks: `camelCase.ts` (starting with `use`)
- Utilities: `kebab-case.ts`
- API routes: `route.ts` in feature directories

**Next:** [Plugin Configuration](./03-plugin-configuration.md) - Learn about `plugin.config.ts` reference

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
