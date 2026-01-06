---
name: plugins
description: |
  Plugin development system for this Next.js application.
  Covers plugin structure, configuration, lifecycle hooks, registry integration, environment variables, and testing patterns.
  CRITICAL: Includes MANDATORY dependency management rules for NPM distribution.
  Use this skill when creating, modifying, or validating plugins.
allowed-tools: Read, Glob, Grep, Bash
version: 2.0.0
---

# Plugins Skill

Patterns for developing plugins in this Next.js application.

## Architecture Overview

### ⚠️ Model B Distribution: Plugin Locations

| Contexto | Plugin Location | Razón |
|----------|-----------------|-------|
| **Monorepo** (desarrollo) | `plugins/<plugin-name>/` | Workspace package |
| **Proyecto usuario** | `contents/plugins/<plugin-name>/` | Copiado por CLI (no node_modules) |

> **CRÍTICO**: Los paquetes NPM son para DISTRIBUCIÓN. En proyectos de usuario, el código se COPIA a `/contents/plugins/`, NO queda en `node_modules`.

```
PLUGIN SYSTEM ARCHITECTURE:

Plugin Location (Monorepo):
plugins/
└── [plugin-name]/              # Workspace package (@nextsparkjs/plugin-*)
    ├── package.json            # REQUIRED: peerDependencies, NO duplicate deps
    ├── plugin.config.ts        # Plugin configuration (REQUIRED)
    ├── README.md               # Plugin documentation (REQUIRED)
    ├── .env.example            # Environment template (REQUIRED)
    ├── types/                  # TypeScript type definitions
    │   └── [plugin].types.ts
    ├── lib/                    # Core plugin logic
    │   ├── core.ts
    │   └── utils.ts
    ├── hooks/                  # React hooks
    │   └── use[Plugin].ts
    ├── components/             # React components
    │   └── [Component].tsx
    ├── providers/              # Context providers
    │   └── [Plugin]Provider.tsx
    ├── api/                    # API endpoints (Next.js needs these in project!)
    │   └── [endpoint]/
    │       └── route.ts
    ├── entities/               # Plugin entities (optional)
    │   └── [entity]/
    │       ├── messages/
    │       └── migrations/
    └── docs/                   # Plugin documentation
        └── 01-getting-started/

Plugin Types:
├── utility      # Core utilities and helper functions
├── service      # Feature-rich with components, hooks, API
└── configuration # Settings and configuration management

Registry Integration:
core/lib/registries/plugin-registry.ts  # Auto-generated
```

---

## ⚠️ MANDATORY: NPM Distribution & Dependency Management

### Principio Fundamental

> **Si `@nextsparkjs/core` tiene una dependencia, los plugins DEBEN declararla como `peerDependency`, NUNCA como `dependency`.**

### Por qué es OBLIGATORIO

```
❌ INCORRECTO - Dependencias duplicadas (PROHIBIDO):
┌─────────────────────────────────────────────────┐
│ node_modules/                                   │
│ ├── @nextsparkjs/core/                          │
│ │   └── node_modules/zod@4.1.5  ← Instancia 1   │
│ ├── @nextsparkjs/plugin-ai/                     │
│ │   └── node_modules/zod@4.1.5  ← Instancia 2   │
│ └── @nextsparkjs/plugin-langchain/              │
│     └── node_modules/zod@3.23.0 ← Instancia 3!  │
└─────────────────────────────────────────────────┘
Resultado: Conflictos de tipos, errores de instanceof, bundle inflado

✅ CORRECTO - Una sola instancia (OBLIGATORIO):
┌─────────────────────────────────────────────────┐
│ node_modules/                                   │
│ ├── zod@4.1.5  ← UNA sola instancia (hoisted)   │
│ ├── @nextsparkjs/core/  (provee zod)            │
│ ├── @nextsparkjs/plugin-ai/  (usa zod del host) │
│ └── @nextsparkjs/plugin-langchain/ (usa zod)    │
└─────────────────────────────────────────────────┘
Resultado: Sin conflictos, bundle optimizado
```

### Clasificación de Dependencias

| Categoría | Tipo | Ejemplos | Razón |
|-----------|------|----------|-------|
| **Singleton libraries** | `peerDependencies` | zod, react, react-dom, next | Una sola instancia en runtime |
| **Compartidas con core** | `peerDependencies` | @tanstack/react-query, lucide-react, clsx | Core ya las provee |
| **Exclusivas del plugin** | `dependencies` | @ai-sdk/*, @langchain/* | Solo este plugin las usa |

### Dependencias que Core Provee (NUNCA duplicar en plugins)

```json
// Estas dependencias están en @nextsparkjs/core
// Los plugins DEBEN declararlas como peerDependencies, NO como dependencies
{
  "zod": "^4.1.5",
  "@tanstack/react-query": "^5.85.0",
  "lucide-react": "^0.539.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1",
  "date-fns": "^4.1.0",
  "react-hook-form": "^7.62.0",
  "@hookform/resolvers": "^5.2.1",
  "sonner": "^2.0.7",
  "next-intl": "^4.3.4",
  "next-themes": "^0.4.6",
  "uuid": "^13.0.0",
  "better-auth": "^1.3.5"
  // ... y TODOS los @radix-ui/*
}
```

### Template OBLIGATORIO de package.json para Plugins

```json
{
  "name": "@nextsparkjs/plugin-NOMBRE",
  "version": "1.0.0",
  "private": false,
  "main": "./plugin.config.ts",
  "types": "./types/index.ts",
  "dependencies": {
    // SOLO dependencias EXCLUSIVAS de este plugin
    // que NO están en core
    "@ai-sdk/anthropic": "^2.0.17"  // ✅ Solo este plugin lo usa
  },
  "peerDependencies": {
    "@nextsparkjs/core": "workspace:*",
    "next": "^15.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
    // Agregar otras de core que el plugin use directamente
  }
}
```

### Anti-Patterns de Dependencias (PROHIBIDO)

```json
// ❌ NUNCA hacer esto en un plugin:
{
  "dependencies": {
    "zod": "^4.0.0",           // ❌ Core ya lo tiene → peerDependency
    "react": "^19.0.0",         // ❌ Core ya lo tiene → peerDependency
    "lucide-react": "^0.539.0", // ❌ Core ya lo tiene → peerDependency
    "@tanstack/react-query": "^5.0.0" // ❌ Core ya lo tiene → peerDependency
  }
}

// ✅ Correcto:
{
  "dependencies": {
    "@ai-sdk/anthropic": "^2.0.17"  // ✅ Solo este plugin lo usa
  },
  "peerDependencies": {
    "@nextsparkjs/core": "workspace:*",
    "zod": "^4.0.0",           // ✅ Documenta uso, no instala
    "react": "^19.0.0"         // ✅ Host lo provee
  }
}
```

---

## When to Use This Skill

- Creating new plugins
- Understanding plugin structure
- Implementing plugin lifecycle hooks
- Configuring plugin environment variables
- Integrating plugins with the registry
- Testing plugin functionality

## Plugin Configuration (REQUIRED)

Every plugin MUST have a `plugin.config.ts` file:

```typescript
// contents/plugins/my-plugin/plugin.config.ts
import { z } from 'zod'
import type { PluginConfig } from '@/core/types/plugin'

// Configuration schema with Zod validation
const MyPluginConfigSchema = z.object({
  apiKey: z.string().min(1).describe("API Key"),
  timeout: z.number().min(1000).max(60000).default(5000),
  debugMode: z.boolean().default(false),
  maxRetries: z.number().min(0).max(5).default(3)
})

export const myPluginConfig: PluginConfig = {
  // Required fields
  name: 'my-plugin',
  version: '1.0.0',
  displayName: 'My Custom Plugin',
  description: 'Clear description of plugin functionality',
  enabled: true,
  dependencies: [], // Other plugins this depends on

  // Components available to app
  components: {
    MyComponent: undefined, // Lazy loaded
    MyWidget: undefined
  },

  // Services and hooks
  services: {
    useMyService: undefined
  },

  // Lifecycle hooks
  hooks: {
    async onLoad() {
      console.log('[My Plugin] Loading...')
    },
    async onActivate() {
      console.log('[My Plugin] Activated')
    },
    async onDeactivate() {
      console.log('[My Plugin] Deactivated')
    },
    async onUnload() {
      console.log('[My Plugin] Unloaded')
    }
  }
}

export default myPluginConfig
```

## Plugin Types

### 1. Utility Plugin

Simple utilities and helper functions.

```typescript
// Structure
my-utility-plugin/
├── plugin.config.ts
├── lib/
│   ├── utils.ts
│   └── helpers.ts
└── types/
    └── utility.types.ts
```

### 2. Service Plugin

Feature-rich plugins with full stack integration.

```typescript
// Structure
my-service-plugin/
├── plugin.config.ts
├── types/
├── lib/
├── hooks/
├── components/
├── providers/
├── api/
├── entities/         # If plugin has its own entities
│   └── my-entity/
│       ├── messages/
│       └── migrations/
└── docs/
```

### 3. Configuration Plugin

Settings and configuration management.

```typescript
// Structure
my-config-plugin/
├── plugin.config.ts
├── lib/
│   └── config-loader.ts
├── types/
│   └── config.types.ts
└── schemas/
    └── settings.schema.ts
```

## Environment Variables Pattern

### CRITICAL: Namespace-Based Architecture

**GLOBAL Variables (root `.env` ONLY):**
- `DATABASE_URL`, `BETTER_AUTH_SECRET`
- `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`
- `USE_LOCAL_AI`, `DEFAULT_CLOUD_MODEL`

**PLUGIN Variables (plugin `.env` with prefix):**
- `MY_PLUGIN_*` - All plugin variables MUST be namespaced

```bash
# contents/plugins/my-plugin/.env.example
# ============================================
# MY PLUGIN ENVIRONMENT VARIABLES
# ============================================
#
# IMPORTANT:
# - This file should ONLY contain MY_PLUGIN_* namespaced variables
# - Global variables should be in root .env ONLY
# - This prevents override conflicts
#
# DO NOT PUT IN THIS FILE:
# - USE_LOCAL_AI, API keys, DATABASE_URL
# - Any system-wide configuration
#
# ONLY PUT IN THIS FILE:
# - MY_PLUGIN_* namespaced variables
# ============================================

MY_PLUGIN_ENABLED=true
MY_PLUGIN_DEBUG=false
MY_PLUGIN_API_KEY=your-api-key-here
MY_PLUGIN_TIMEOUT=5000
MY_PLUGIN_MAX_RETRIES=3
```

### Environment Loader Implementation

```typescript
// contents/plugins/my-plugin/lib/config.ts
const GLOBAL_VARIABLES = [
  'DATABASE_URL',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY'
] as const

const PLUGIN_VARIABLES = [
  'MY_PLUGIN_ENABLED',
  'MY_PLUGIN_DEBUG',
  'MY_PLUGIN_API_KEY',
  'MY_PLUGIN_TIMEOUT'
] as const

export function loadPluginConfig() {
  return {
    // GLOBAL - From root .env ONLY
    databaseUrl: process.env.DATABASE_URL,

    // PLUGIN - Can be in plugin .env
    enabled: process.env.MY_PLUGIN_ENABLED === 'true',
    debug: process.env.MY_PLUGIN_DEBUG === 'true',
    apiKey: process.env.MY_PLUGIN_API_KEY,
    timeout: parseInt(process.env.MY_PLUGIN_TIMEOUT || '5000', 10)
  }
}

// Validate no global overrides in development
if (process.env.NODE_ENV === 'development') {
  GLOBAL_VARIABLES.forEach(v => {
    // Warn if plugin .env contains global variables
  })
}
```

## Lifecycle Hooks

```typescript
export const myPluginConfig: PluginConfig = {
  hooks: {
    // Called when plugin is first loaded
    async onLoad() {
      console.log('[My Plugin] Loading...')
      await validateConfiguration()
      await setupServices()
    },

    // Called when plugin is activated
    async onActivate() {
      console.log('[My Plugin] Activated')
      await startBackgroundTasks()
    },

    // Called when plugin is deactivated
    async onDeactivate() {
      console.log('[My Plugin] Deactivated')
      await stopBackgroundTasks()
    },

    // Called when plugin is unloaded
    async onUnload() {
      console.log('[My Plugin] Unloaded')
      await cleanup()
    }
  }
}
```

## Type Safety

```typescript
// contents/plugins/my-plugin/types/my-plugin.types.ts

// Configuration types
export interface MyPluginConfig {
  readonly apiKey: string
  readonly timeout: number
  readonly maxRetries: number
  readonly debugMode: boolean
}

// Input/Output types
export interface MyPluginInput {
  readonly data: string
  readonly options?: MyPluginOptions
}

export interface MyPluginOutput<T = unknown> {
  readonly success: boolean
  readonly data?: T
  readonly error?: string
  readonly metadata: {
    readonly processingTime: number
    readonly timestamp: string
  }
}

// Options type
export interface MyPluginOptions {
  readonly timeout?: number
  readonly retryOnError?: boolean
}
```

## Plugin Components

```typescript
// contents/plugins/my-plugin/components/MyWidget.tsx
'use client'

import { useMyPlugin } from '../hooks/useMyPlugin'
import { Card, CardHeader, CardContent } from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'

interface MyWidgetProps {
  readonly title: string
  readonly onAction?: () => void
}

export function MyWidget({ title, onAction }: MyWidgetProps) {
  const { data, isLoading, error } = useMyPlugin()

  return (
    <Card data-cy="my-plugin-widget">
      <CardHeader>
        <h3>{title}</h3>
      </CardHeader>
      <CardContent>
        {isLoading && <div data-cy="my-plugin-loading">Loading...</div>}
        {error && <div data-cy="my-plugin-error">{error.message}</div>}
        {data && (
          <div data-cy="my-plugin-content">
            {/* Content */}
          </div>
        )}
        <Button
          data-cy="my-plugin-action-btn"
          onClick={onAction}
        >
          Action
        </Button>
      </CardContent>
    </Card>
  )
}
```

## Plugin Hooks

```typescript
// contents/plugins/my-plugin/hooks/useMyPlugin.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { MyPluginInput, MyPluginOutput } from '../types/my-plugin.types'

const QUERY_KEY = ['my-plugin'] as const

export function useMyPlugin() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async () => {
      const response = await fetch('/api/plugin/my-plugin/data')
      if (!response.ok) throw new Error('Failed to fetch')
      return response.json()
    }
  })
}

export function useMyPluginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MyPluginInput) => {
      const response = await fetch('/api/plugin/my-plugin/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input)
      })
      if (!response.ok) throw new Error('Failed to process')
      return response.json() as Promise<MyPluginOutput>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    }
  })
}
```

## Plugin API Endpoints

```typescript
// contents/plugins/my-plugin/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { authenticateRequest } from '@/core/lib/auth/authenticateRequest'

const ProcessInputSchema = z.object({
  data: z.string().min(1).max(10000),
  options: z.object({
    timeout: z.number().min(1000).max(30000).optional()
  }).optional()
})

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const auth = await authenticateRequest(request)
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Validation
    const body = await request.json()
    const input = ProcessInputSchema.parse(body)

    // Process
    const result = await processData(input)

    return NextResponse.json({
      success: true,
      data: result,
      metadata: {
        processingTime: Date.now(),
        timestamp: new Date().toISOString()
      }
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation error', details: error.errors },
        { status: 400 }
      )
    }

    console.error('[My Plugin] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

## Plugin Registry Integration

### Auto-Generated Registry

```typescript
// core/lib/registries/plugin-registry.ts (AUTO-GENERATED)
// DO NOT EDIT - Generated by build/registry.mjs

export const PLUGIN_REGISTRY: Record<string, PluginRegistryEntry> = {
  'my-plugin': {
    name: 'my-plugin',
    config: myPluginConfig,
    hasAPI: true,
    apiPath: '/api/plugin/my-plugin',
    hasComponents: true,
    dependencies: []
  }
}

// Client-safe registry (no sensitive data)
export const CLIENT_PLUGIN_REGISTRY: Record<string, ClientPluginInfo> = {
  'my-plugin': {
    name: 'my-plugin',
    displayName: 'My Plugin',
    version: '1.0.0',
    enabled: true,
    hasAPI: true,
    hasComponents: true
  }
}
```

### Rebuild Registry

```bash
# After creating or modifying plugins
node core/scripts/build/registry.mjs

# Watch mode for development
node core/scripts/build/registry.mjs --watch
```

## Plugin Testing

### Unit Tests

```typescript
// contents/plugins/my-plugin/__tests__/my-plugin.test.ts
import { MyPluginCore } from '../lib/core'

describe('MyPluginCore', () => {
  let core: MyPluginCore

  beforeEach(() => {
    core = new MyPluginCore({
      apiKey: 'test-key',
      timeout: 5000,
      maxRetries: 3
    })
  })

  describe('initialization', () => {
    it('should initialize with valid config', async () => {
      await expect(core.initialize()).resolves.not.toThrow()
    })

    it('should throw with invalid config', async () => {
      const invalid = new MyPluginCore({ apiKey: '' })
      await expect(invalid.initialize()).rejects.toThrow()
    })
  })

  describe('processing', () => {
    it('should process valid input', async () => {
      await core.initialize()
      const result = await core.process({ data: 'test' })
      expect(result.success).toBe(true)
    })
  })
})
```

### E2E Tests with Page Object Model

```typescript
// contents/themes/default/tests/cypress/e2e/uat/my-plugin.cy.ts
import { MyPluginPOM } from '../../src/features/MyPluginPOM'

describe('My Plugin E2E', () => {
  let pom: MyPluginPOM

  beforeEach(() => {
    cy.session('plugin-test', () => {
      cy.login('testuser@example.com', 'password123')
    })
    cy.visit('/dashboard')
    pom = new MyPluginPOM()
  })

  it('should complete full workflow', () => {
    pom.shouldBeVisible()
    pom.enterData('test data')
    pom.clickProcessButton()
    pom.shouldShowSuccess()
  })
})

// POM class
export class MyPluginPOM {
  private selectors = {
    widget: '[data-cy="my-plugin-widget"]',
    input: '[data-cy="my-plugin-input"]',
    processBtn: '[data-cy="my-plugin-action-btn"]',
    success: '[data-cy="my-plugin-success"]'
  }

  shouldBeVisible() {
    cy.get(this.selectors.widget).should('be.visible')
  }

  enterData(data: string) {
    cy.get(this.selectors.input).type(data)
  }

  clickProcessButton() {
    cy.get(this.selectors.processBtn).click()
  }

  shouldShowSuccess() {
    cy.get(this.selectors.success).should('be.visible')
  }
}
```

## Plugin with Entities

```typescript
// contents/plugins/my-plugin/entities/my-entity/
├── messages/
│   ├── en.json
│   └── es.json
└── migrations/
    └── 001_my_entity_table.sql
```

```sql
-- contents/plugins/my-plugin/entities/my-entity/migrations/001_my_entity_table.sql
-- ============================================================================
-- Plugin: my-plugin
-- Entity: my-entity
-- Description: Creates the my-entity table for the plugin
-- ============================================================================

CREATE TABLE IF NOT EXISTS "myEntity" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "teamId" UUID NOT NULL REFERENCES "team"("id") ON DELETE CASCADE,
  "name" VARCHAR(255) NOT NULL,
  "data" JSONB DEFAULT '{}',
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for team queries
CREATE INDEX IF NOT EXISTS "idx_myEntity_teamId" ON "myEntity"("teamId");

-- RLS Policy
ALTER TABLE "myEntity" ENABLE ROW LEVEL SECURITY;

CREATE POLICY "myEntity_team_policy" ON "myEntity"
  USING ("teamId" IN (
    SELECT "teamId" FROM "member" WHERE "userId" = auth.uid()
  ));
```

## Plugin Documentation Structure

```
contents/plugins/my-plugin/docs/
├── 01-getting-started/
│   ├── 01-introduction.md
│   ├── 02-installation.md
│   └── 03-configuration.md
├── 02-features/
│   ├── 01-core-functionality.md
│   └── 02-advanced-usage.md
├── 03-api/
│   ├── 01-endpoints.md
│   └── 02-webhooks.md
└── 04-troubleshooting/
    └── 01-common-issues.md
```

## Creating a Plugin Script

```bash
# Use the scaffold script
python .claude/skills/plugins/scripts/scaffold-plugin.py \
  --name "my-plugin" \
  --type "service" \
  --features "components,hooks,api"
```

## Anti-Patterns

```typescript
// NEVER: Hardcode configuration
const badConfig = {
  apiKey: 'hardcoded-key',  // Security risk
  endpoint: 'http://localhost:3000'  // Environment-specific
}

// NEVER: Skip error handling
export async function badProcess(data: any) {
  const result = await externalAPI(data)  // No try/catch
  return result.data  // Assumes success
}

// NEVER: Use any types
export interface BadInterface {
  data: any  // Use specific types
  config: any  // Avoid any
}

// NEVER: Put global variables in plugin .env
// Plugin .env should ONLY have MY_PLUGIN_* variables
// USE_LOCAL_AI=true  // WRONG - This overrides root .env!

// NEVER: Skip lifecycle hooks
export const badPlugin = {
  name: 'bad-plugin',
  // No hooks = no cleanup, no initialization
}

// NEVER: Direct imports in derived projects
import { something } from '@/core/...'  // Only in base project
```

## Checklist

### Antes de crear un plugin (OBLIGATORIO):

- [ ] Verificar si las dependencias que necesito ya están en core
- [ ] Si están en core → declararlas como `peerDependencies`
- [ ] Si NO están en core → declararlas como `dependencies`
- [ ] NUNCA duplicar: zod, react, next, @tanstack/*, lucide-react, etc.
- [ ] Plugin name follows kebab-case convention
- [ ] Plugin directory created in `plugins/`
- [ ] `plugin.config.ts` created with all required fields
- [ ] `README.md` with usage documentation
- [ ] `.env.example` with namespaced variables only
- [ ] Types defined in `types/` directory

### Validación de Dependencias:

```bash
# Verificar que no hay duplicados
pnpm ls zod
# Debe mostrar UNA sola versión

# Verificar estructura de workspace
pnpm ls --depth=0
```

During plugin development:

- [ ] All variables use `MY_PLUGIN_*` namespace
- [ ] Lifecycle hooks implemented (onLoad, onActivate, etc.)
- [ ] Components have `data-cy` selectors
- [ ] API endpoints use Zod validation
- [ ] Error handling is comprehensive

After plugin implementation:

- [ ] Run `node core/scripts/build/registry.mjs` to rebuild registry
- [ ] Unit tests created with 90%+ coverage for critical paths
- [ ] E2E tests with Page Object Model
- [ ] Documentation in `docs/` directory
- [ ] Build passes: `pnpm build`

## Related Skills

- `monorepo-architecture` - **CRITICAL** Package hierarchy and dependency management rules
- `cypress-selectors` - Selector patterns for plugin components
- `tanstack-query` - Data fetching in plugin hooks
- `zod-validation` - Input validation for plugin APIs
- `registry-system` - Plugin registry integration
- `cypress-e2e` - E2E testing patterns
