# Plugin Configuration

## Introduction

The `plugin.config.ts` file is the heart of every plugin. It defines plugin metadata, capabilities, dependencies, lifecycle hooks, and exported APIs. This comprehensive reference covers all configuration options and best practices for creating robust plugin configurations.

**Key Principles:**
- **Type-Safe** - Full TypeScript support with `PluginConfig` interface
- **Declarative** - Configuration-driven plugin behavior
- **Discoverable** - Build script automatically finds and validates configs
- **Flexible** - Support for simple utilities to complex feature plugins
- **Isolated** - Plugin-specific settings without affecting core or other plugins

---

## PluginConfig Interface

### Complete Type Definition

```typescript
// core/types/plugin.ts
export interface PluginConfig {
  // Required metadata
  name: string
  displayName: string
  version: string

  // Optional metadata
  description?: string
  author?: string
  license?: string
  homepage?: string
  repository?: string

  // Plugin state
  enabled: boolean

  // Dependencies
  dependencies?: string[]

  // Lifecycle hooks
  hooks?: PluginHooks

  // Exported functionality
  components?: Record<string, any>
  services?: Record<string, any>
  api?: Record<string, any>
}

export interface PluginHooks {
  onRegister?: () => Promise<void>
  onLoad?: () => Promise<void>
  onActivate?: () => Promise<void>
  onDeactivate?: () => Promise<void>
  onUnload?: () => Promise<void>
}
```

---

## Required Properties

### `name` (string) ✅ REQUIRED

**Purpose**: Unique identifier for the plugin. Used in registry, imports, and API routes.

**Rules**:
- Must be unique across all plugins
- Use kebab-case (lowercase with hyphens)
- Should be descriptive and concise
- Cannot contain spaces or special characters (except hyphens)

**Examples**:
```typescript
// ✅ Good plugin names
name: 'ai'
name: 'billing'
name: 'social-media-publisher'
name: 'analytics-tracker'

// ❌ Bad plugin names
name: 'AI Plugin'          // ❌ Contains spaces
name: 'my_plugin'          // ❌ Use kebab-case, not snake_case
name: 'plugin123'          // ❌ Too generic
name: 'ai@helper'          // ❌ Special characters not allowed
```

**Usage in URLs**:
```text
/api/v1/plugin/[name]/[endpoint]
/api/v1/plugin/ai/generate
/api/v1/plugin/billing/subscriptions
```

---

### `displayName` (string) ✅ REQUIRED

**Purpose**: Human-readable name shown in UI, documentation, and admin panels.

**Rules**:
- Can contain spaces and proper capitalization
- Should be clear and professional
- Typically 1-5 words

**Examples**:
```typescript
// ✅ Good display names
displayName: 'AI Assistant'
displayName: 'Billing Management'
displayName: 'Social Media Publisher'
displayName: 'Analytics Tracker'

// ❌ Bad display names
displayName: 'ai'                    // ❌ Not capitalized
displayName: 'The Best AI Plugin'    // ❌ Too promotional
displayName: 'AI'                    // ❌ Too generic
```

---

### `version` (string) ✅ REQUIRED

**Purpose**: Plugin version following semantic versioning (semver).

**Format**: `MAJOR.MINOR.PATCH`
- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

**Examples**:
```typescript
// ✅ Good versions
version: '1.0.0'      // Initial release
version: '1.1.0'      // Added new feature
version: '1.1.1'      // Bug fix
version: '2.0.0'      // Breaking changes

// ❌ Bad versions
version: '1'          // ❌ Missing MINOR and PATCH
version: 'v1.0.0'     // ❌ Don't include 'v' prefix
version: '1.0'        // ❌ Missing PATCH
version: 'latest'     // ❌ Not a semver version
```

**Version Management**:
```typescript
// package.json and plugin.config.ts should match
{
  "version": "1.2.3"
}

export const myPluginConfig: PluginConfig = {
  version: '1.2.3'  // ✅ Same version
}
```

---

### `enabled` (boolean) ✅ REQUIRED

**Purpose**: Controls whether plugin is active and loaded by the system.

**Values**:
- `true` - Plugin is active and will be loaded
- `false` - Plugin is disabled and will not be loaded

**Examples**:
```typescript
// ✅ Production plugin - enabled
export const aiPluginConfig: PluginConfig = {
  name: 'ai',
  enabled: true  // ✅ Active in production
}

// ⚠️ Development plugin - disabled in production
export const experimentalPluginConfig: PluginConfig = {
  name: 'experimental-feature',
  enabled: process.env.NODE_ENV === 'development'  // ✅ Dev only
}

// ⚠️ Deprecated plugin - disabled
export const deprecatedPluginConfig: PluginConfig = {
  name: 'old-feature',
  enabled: false  // ⚠️ Disabled, will be removed
}
```

**Environment-Based Activation**:
```typescript
// Enable based on environment variable
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  enabled: process.env.MY_PLUGIN_ENABLED === 'true',

  hooks: {
    onLoad() {
      if (!this.enabled) {
        console.log('[My Plugin] Disabled via environment variable')
      }
    }
  }
}
```

---

## Optional Metadata Properties

### `description` (string) ⚠️ OPTIONAL

**Purpose**: Brief description of plugin functionality for documentation and UI.

**Best Practices**:
- Keep it concise (1-2 sentences)
- Focus on what the plugin does
- Avoid marketing language

**Examples**:
```typescript
// ✅ Good descriptions
description: 'Core AI utilities for custom endpoints and integrations'
description: 'Subscription and payment management with Stripe integration'
description: 'Multi-platform social media posting and scheduling'

// ❌ Bad descriptions
description: 'AI'  // ❌ Too vague
description: 'The best, most amazing plugin ever created...'  // ❌ Too promotional
description: 'This plugin provides comprehensive AI-powered content generation capabilities with support for multiple models including OpenAI, Anthropic, and Ollama, featuring cost tracking, PII detection, and advanced template systems...'  // ❌ Too long
```

---

### `author` (string) ⚠️ OPTIONAL

**Purpose**: Plugin author or organization name.

**Examples**:
```typescript
author: 'John Doe'
author: 'The Money Team'
author: 'Acme Corporation'
```

---

### `license` (string) ⚠️ OPTIONAL

**Purpose**: Plugin license (MIT, Apache-2.0, etc.).

**Examples**:
```typescript
license: 'MIT'
license: 'Apache-2.0'
license: 'GPL-3.0'
license: 'Proprietary'
```

---

### `homepage` (string) ⚠️ OPTIONAL

**Purpose**: URL to plugin documentation or homepage.

**Examples**:
```typescript
homepage: 'https://docs.example.com/plugins/ai'
homepage: 'https://github.com/company/plugin-ai'
```

---

### `repository` (string) ⚠️ OPTIONAL

**Purpose**: URL to plugin source code repository.

**Examples**:
```typescript
repository: 'https://github.com/company/plugin-ai'
repository: 'https://gitlab.com/company/plugin-ai'
```

---

## Dependencies

### `dependencies` (string[]) ⚠️ OPTIONAL

**Purpose**: List of other plugins this plugin depends on.

**Rules**:
- Dependencies must be loaded before this plugin
- Circular dependencies are not allowed
- Dependency plugins must be enabled

**Examples**:
```typescript
// ✅ Plugin with dependencies
export const advancedAIConfig: PluginConfig = {
  name: 'advanced-ai',
  displayName: 'Advanced AI Features',
  version: '1.0.0',
  enabled: true,
  dependencies: ['ai', 'billing'],  // Requires ai and billing plugins

  hooks: {
    onLoad() {
      // ai and billing plugins are guaranteed to be loaded first
      console.log('[Advanced AI] Dependencies loaded')
    }
  }
}

// ✅ Plugin without dependencies
export const standalonePluginConfig: PluginConfig = {
  name: 'standalone',
  displayName: 'Standalone Plugin',
  version: '1.0.0',
  enabled: true,
  dependencies: []  // ✅ No dependencies
}
```

**Dependency Resolution**:
```typescript
// Build script validates dependencies
// 1. Check all dependencies exist
// 2. Check all dependencies are enabled
// 3. Check no circular dependencies
// 4. Load plugins in dependency order

// Example dependency tree:
// ai (no deps) → loaded first
// billing (no deps) → loaded first
// advanced-ai (deps: ai, billing) → loaded after dependencies
```

**Error Handling**:
```typescript
// ❌ Missing dependency error
export const brokenPluginConfig: PluginConfig = {
  name: 'broken',
  dependencies: ['non-existent-plugin']  // ❌ Error: Dependency not found
}

// ❌ Circular dependency error
// Plugin A depends on Plugin B
// Plugin B depends on Plugin A
// ❌ Error: Circular dependency detected
```

---

## Lifecycle Hooks

### `hooks` (PluginHooks) ⚠️ OPTIONAL

**Purpose**: Define plugin behavior at different lifecycle stages.

**Available Hooks**:
```typescript
export interface PluginHooks {
  onRegister?: () => Promise<void>    // Build-time: Plugin discovered
  onLoad?: () => Promise<void>         // Runtime: Server starts
  onActivate?: () => Promise<void>     // Plugin enabled
  onDeactivate?: () => Promise<void>   // Plugin disabled
  onUnload?: () => Promise<void>       // Server shutdown
}
```

---

### `onRegister` Hook

**When**: Build-time, when plugin is discovered by `core/scripts/build/registry.mjs`

**Use Cases**:
- Validate plugin structure
- Check for required files
- Generate build-time assets
- Log plugin registration

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onRegister() {
      console.log('[My Plugin] Registered at build-time')

      // Validate required files exist
      const requiredFiles = [
        './lib/core-utils.ts',
        './types/my-plugin.types.ts'
      ]

      for (const file of requiredFiles) {
        if (!existsSync(join(__dirname, file))) {
          throw new Error(`[My Plugin] Required file missing: ${file}`)
        }
      }
    }
  }
}
```

---

### `onLoad` Hook

**When**: Runtime, when server starts and plugin is initialized

**Use Cases**:
- Load configuration from environment
- Initialize connections (database, external APIs)
- Validate API keys
- Set up plugin state
- Register event listeners

**Example**:
```typescript
export const aiPluginConfig: PluginConfig = {
  name: 'ai',
  displayName: 'AI Assistant',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onLoad() {
      console.log('[AI Plugin] Loading core utilities')

      // Load environment configuration
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        console.warn('[AI Plugin] Warning: ANTHROPIC_API_KEY not set')
      }

      // Initialize providers
      await this.initializeProviders()

      // Validate configuration
      await this.validateConfiguration()

      console.log('[AI Plugin] Loaded successfully')
    }
  },

  // Custom methods
  initializeProviders: async () => {
    // Initialize OpenAI, Anthropic, Ollama clients
  },

  validateConfiguration: async () => {
    // Validate API keys and settings
  }
}
```

---

### `onActivate` Hook

**When**: Plugin is enabled (enabled: true)

**Use Cases**:
- Start background jobs
- Enable features
- Initialize services
- Log activation

**Example**:
```typescript
export const analyticsPluginConfig: PluginConfig = {
  name: 'analytics',
  displayName: 'Analytics Tracker',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onActivate() {
      console.log('[Analytics] Activated - starting tracking')

      // Start background job for data aggregation
      await this.startBackgroundJob()

      // Initialize analytics client
      await this.initializeAnalyticsClient()

      console.log('[Analytics] Tracking enabled')
    }
  },

  startBackgroundJob: async () => {
    // Start periodic data aggregation
  },

  initializeAnalyticsClient: async () => {
    // Initialize Amplitude, Google Analytics, etc.
  }
}
```

---

### `onDeactivate` Hook

**When**: Plugin is disabled (enabled: false)

**Use Cases**:
- Stop background jobs
- Clean up resources
- Close connections
- Log deactivation

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onDeactivate() {
      console.log('[My Plugin] Deactivating - cleaning up')

      // Stop background jobs
      await this.stopBackgroundJobs()

      // Close database connections
      await this.closeConnections()

      // Clear caches
      await this.clearCaches()

      console.log('[My Plugin] Deactivated successfully')
    }
  },

  stopBackgroundJobs: async () => {
    // Stop all background processes
  },

  closeConnections: async () => {
    // Close database and API connections
  },

  clearCaches: async () => {
    // Clear plugin caches
  }
}
```

---

### `onUnload` Hook

**When**: Server shutdown or plugin removal

**Use Cases**:
- Final cleanup
- Save state to disk
- Close all connections
- Release resources

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onUnload() {
      console.log('[My Plugin] Unloading - final cleanup')

      // Save plugin state
      await this.saveState()

      // Close all connections
      await this.finalCleanup()

      console.log('[My Plugin] Unloaded successfully')
    }
  },

  saveState: async () => {
    // Save plugin state to disk or database
  },

  finalCleanup: async () => {
    // Final cleanup before shutdown
  }
}
```

---

### Complete Lifecycle Example

```typescript
export const fullLifecyclePluginConfig: PluginConfig = {
  name: 'full-lifecycle',
  displayName: 'Full Lifecycle Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onRegister() {
      console.log('[Plugin] 1. onRegister - Build-time validation')
      // Validate plugin structure
    },

    async onLoad() {
      console.log('[Plugin] 2. onLoad - Server startup initialization')
      // Initialize connections, load config
    },

    async onActivate() {
      console.log('[Plugin] 3. onActivate - Plugin enabled')
      // Start background jobs, enable features
    },

    async onDeactivate() {
      console.log('[Plugin] 4. onDeactivate - Plugin disabled')
      // Stop background jobs, cleanup
    },

    async onUnload() {
      console.log('[Plugin] 5. onUnload - Server shutdown')
      // Final cleanup, save state
    }
  }
}
```

---

## Exported Functionality

### `api` (Record<string, any>) ⚠️ OPTIONAL

**Purpose**: Export functions that can be called from server components, API routes, or other plugins.

**Rules**:
- Functions must be server-side only (not exposed to client)
- Use lazy imports for better performance
- Functions accessed via `usePlugin(name)` or `getPluginFunction(name, func)`

**Examples**:

**Direct Function Export**:
```typescript
// contents/plugins/ai/plugin.config.ts
import {
  selectModel,
  calculateCost,
  validatePlugin,
  extractTokens,
  handleAIError
} from './lib/core-utils'

export const aiPluginConfig: PluginConfig = {
  name: 'ai',
  displayName: 'AI Core Utilities',
  version: '1.0.0',
  enabled: true,

  // Direct function exports
  api: {
    selectModel,
    calculateCost,
    validatePlugin,
    extractTokens,
    handleAIError
  }
}
```

**Lazy Import Export** (Better Performance):
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  // Lazy import exports - only loaded when needed
  api: {
    processData: () => import('./lib/core-utils').then(m => m.processData),
    validateInput: () => import('./lib/core-utils').then(m => m.validateInput),
    transformData: () => import('./lib/core-utils').then(m => m.transformData)
  }
}
```

**Usage in Server Components**:
```typescript
// app/page.tsx (Server Component)
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export default async function Page() {
  // Get all plugin functions
  const { processData, validateInput } = usePlugin('my-plugin')

  // Call functions
  const isValid = validateInput('test input')
  if (isValid) {
    const result = await processData('test input')
    return <div>{result}</div>
  }
}
```

**Usage in API Routes**:
```typescript
// app/api/process/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { usePlugin } from '@/core/lib/registries/plugin-registry'

export async function POST(request: NextRequest) {
  const { processData } = usePlugin('my-plugin')

  const { input } = await request.json()
  const result = await processData(input)

  return NextResponse.json(result)
}
```

---

### `components` (Record<string, any>) ⚠️ OPTIONAL

**Purpose**: Export React components that can be used in the application.

**Rules**:
- Components must be client-side (`'use client'`)
- Use lazy imports for code-splitting
- Components accessed via registry or direct imports

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  // Component exports with lazy loading
  components: {
    MyWidget: () => import('./components/MyWidget').then(m => m.MyWidget),
    MyButton: () => import('./components/MyButton').then(m => m.MyButton),
    MyForm: () => import('./components/MyForm').then(m => m.MyForm)
  }
}
```

**Usage**:
```typescript
// Import component directly
import { MyWidget } from '@/contents/plugins/my-plugin/components/MyWidget'

export function Page() {
  return <MyWidget />
}

// Or use lazy loading
import { lazy } from 'react'

const MyWidget = lazy(() => import('@/contents/plugins/my-plugin/components/MyWidget'))

export function Page() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <MyWidget />
    </Suspense>
  )
}
```

---

### `services` (Record<string, any>) ⚠️ OPTIONAL

**Purpose**: Export custom hooks or service classes.

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  // Service exports
  services: {
    useMyPlugin: () => import('./hooks/useMyPlugin').then(m => m.useMyPlugin),
    MyService: () => import('./lib/my-service').then(m => m.MyService)
  }
}
```

---

## Environment Variable Patterns

### Namespace-Based Configuration

**CRITICAL**: Always use plugin-namespaced environment variables to prevent conflicts.

**Global Variables (Root `.env` ONLY)**:
```bash
# Root .env - System-wide configuration
USE_LOCAL_AI=false
DEFAULT_CLOUD_MODEL=claude-3-5-sonnet-20241022
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-proj-...
DATABASE_URL=postgresql://...
```

**Plugin Variables (Plugin `.env` with Namespacing)**:
```bash
# contents/plugins/my-plugin/.env
# ⚠️ ONLY MY_PLUGIN_* variables allowed here

MY_PLUGIN_ENABLED=true
MY_PLUGIN_DEBUG=false
MY_PLUGIN_API_KEY=...
MY_PLUGIN_MAX_REQUESTS=100
MY_PLUGIN_TIMEOUT=5000
```

**Loading Environment in Plugin Config**:
```typescript
// contents/plugins/my-plugin/lib/server-env.ts
import { config } from 'dotenv'
import { join } from 'path'

// Load plugin-level .env file
config({ path: join(__dirname, '../.env') })

export const pluginEnv = {
  enabled: process.env.MY_PLUGIN_ENABLED === 'true',
  debug: process.env.MY_PLUGIN_DEBUG === 'true',
  apiKey: process.env.MY_PLUGIN_API_KEY || '',
  maxRequests: parseInt(process.env.MY_PLUGIN_MAX_REQUESTS || '100', 10),
  timeout: parseInt(process.env.MY_PLUGIN_TIMEOUT || '5000', 10)
}

// Validate environment
export function validateEnvironment(): void {
  if (!pluginEnv.apiKey) {
    throw new Error('[My Plugin] API key is required')
  }
}
```

**Using Environment in Plugin Config**:
```typescript
// contents/plugins/my-plugin/plugin.config.ts
import { pluginEnv, validateEnvironment } from './lib/server-env'

export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: pluginEnv.enabled,  // ✅ From environment

  hooks: {
    async onLoad() {
      validateEnvironment()  // ✅ Validate on load
      console.log('[My Plugin] Loaded with config:', pluginEnv)
    }
  }
}
```

---

## Complete Configuration Examples

### Minimal Plugin Configuration

```typescript
// contents/plugins/minimal/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'

export const minimalPluginConfig: PluginConfig = {
  name: 'minimal',
  displayName: 'Minimal Plugin',
  version: '1.0.0',
  enabled: true
}

export default minimalPluginConfig
```

---

### Utility Plugin Configuration

```typescript
// contents/plugins/utils/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'
import {
  formatDate,
  parseJSON,
  sanitizeHTML
} from './lib/core-utils'

export const utilsPluginConfig: PluginConfig = {
  name: 'utils',
  displayName: 'Utility Functions',
  version: '1.0.0',
  description: 'Common utility functions for the application',
  enabled: true,

  api: {
    formatDate,
    parseJSON,
    sanitizeHTML
  },

  hooks: {
    async onLoad() {
      console.log('[Utils Plugin] Utility functions loaded')
    }
  }
}

export default utilsPluginConfig
```

---

### Service Plugin Configuration

```typescript
// contents/plugins/billing/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'

export const billingPluginConfig: PluginConfig = {
  name: 'billing',
  displayName: 'Billing Management',
  version: '2.1.0',
  description: 'Subscription and payment management with Stripe integration',
  author: 'The Money Team',
  license: 'MIT',
  enabled: true,
  dependencies: [],

  api: {
    createSubscription: () => import('./lib/subscription-service').then(m => m.createSubscription),
    cancelSubscription: () => import('./lib/subscription-service').then(m => m.cancelSubscription),
    getInvoices: () => import('./lib/invoice-service').then(m => m.getInvoices)
  },

  components: {
    SubscriptionCard: () => import('./components/SubscriptionCard').then(m => m.SubscriptionCard),
    PaymentForm: () => import('./components/PaymentForm').then(m => m.PaymentForm)
  },

  services: {
    useSubscription: () => import('./hooks/useSubscription').then(m => m.useSubscription),
    useBilling: () => import('./hooks/useBilling').then(m => m.useBilling)
  },

  hooks: {
    async onLoad() {
      console.log('[Billing] Loading Stripe integration')
      await this.validateStripeConfig()
    },

    async onActivate() {
      console.log('[Billing] Activated - webhooks listening')
      await this.registerWebhooks()
    },

    async onDeactivate() {
      console.log('[Billing] Deactivated - cleaning up')
      await this.unregisterWebhooks()
    }
  },

  validateStripeConfig: async () => {
    const apiKey = process.env.STRIPE_API_KEY
    if (!apiKey) {
      throw new Error('[Billing] STRIPE_API_KEY required')
    }
  },

  registerWebhooks: async () => {
    // Register Stripe webhooks
  },

  unregisterWebhooks: async () => {
    // Unregister Stripe webhooks
  }
}

export default billingPluginConfig
```

---

### Complex Plugin with Dependencies

```typescript
// contents/plugins/advanced-ai/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'

export const advancedAIConfig: PluginConfig = {
  name: 'advanced-ai',
  displayName: 'Advanced AI Features',
  version: '1.0.0',
  description: 'Advanced AI features building on core AI utilities',
  author: 'AI Team',
  license: 'Proprietary',
  enabled: true,
  dependencies: ['ai', 'billing'],  // Requires ai and billing plugins

  api: {
    generateAdvanced: () => import('./lib/advanced-generation').then(m => m.generateAdvanced),
    analyzeContent: () => import('./lib/content-analysis').then(m => m.analyzeContent),
    optimizePrompt: () => import('./lib/prompt-optimizer').then(m => m.optimizePrompt)
  },

  hooks: {
    async onLoad() {
      console.log('[Advanced AI] Loading advanced features')

      // Dependencies are guaranteed to be loaded
      const { selectModel } = usePlugin('ai')
      const { getSubscription } = usePlugin('billing')

      // Validate user has required subscription
      const subscription = await getSubscription()
      if (subscription.plan !== 'premium') {
        console.warn('[Advanced AI] Premium subscription required')
      }
    }
  }
}

export default advancedAIConfig
```

---

## Best Practices

### 1. Use Type-Safe Configuration

**✅ Good:**
```typescript
import type { PluginConfig } from '@/core/types/plugin'

export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true
}
```

**❌ Bad:**
```typescript
// ❌ No type annotation
export const myPluginConfig = {
  name: 'my-plugin'
  // Missing required fields
}
```

---

### 2. Validate Configuration Early

**✅ Good:**
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onLoad() {
      // ✅ Validate on load
      await this.validateConfiguration()
    }
  },

  validateConfiguration: async () => {
    const apiKey = process.env.MY_PLUGIN_API_KEY
    if (!apiKey) {
      throw new Error('[My Plugin] API key is required')
    }
  }
}
```

---

### 3. Use Lazy Imports for Performance

**✅ Good:**
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  api: {
    // ✅ Lazy imports - only loaded when used
    processData: () => import('./lib/core-utils').then(m => m.processData),
    validateInput: () => import('./lib/core-utils').then(m => m.validateInput)
  }
}
```

**❌ Bad:**
```typescript
import { processData, validateInput } from './lib/core-utils'

export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  api: {
    // ❌ Eager imports - loaded even if not used
    processData,
    validateInput
  }
}
```

---

### 4. Document Custom Methods

**✅ Good:**
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true,

  /**
   * Validate plugin configuration
   * @throws {Error} If configuration is invalid
   */
  validateConfiguration: async (): Promise<void> => {
    // Validation logic
  },

  /**
   * Initialize external providers
   * @returns {Promise<void>}
   */
  initializeProviders: async (): Promise<void> => {
    // Initialization logic
  }
}
```

---

### 5. Export Default for Compatibility

**✅ Good:**
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  displayName: 'My Plugin',
  version: '1.0.0',
  enabled: true
}

// ✅ Export as default
export default myPluginConfig
```

---

## Summary

**Required Properties:**
- ✅ `name` - Unique plugin identifier (kebab-case)
- ✅ `displayName` - Human-readable name
- ✅ `version` - Semver version (MAJOR.MINOR.PATCH)
- ✅ `enabled` - Plugin activation state

**Optional Metadata:**
- ⚠️ `description` - Brief plugin description
- ⚠️ `author` - Plugin author
- ⚠️ `license` - License type
- ⚠️ `homepage` - Documentation URL
- ⚠️ `repository` - Source code URL

**Configuration:**
- ⚠️ `dependencies` - Required plugins
- ⚠️ `hooks` - Lifecycle hooks (onRegister, onLoad, onActivate, onDeactivate, onUnload)
- ⚠️ `api` - Exported functions (server-side only)
- ⚠️ `components` - Exported React components
- ⚠️ `services` - Exported hooks and services

**Best Practices:**
- Use TypeScript with `PluginConfig` type
- Validate configuration in `onLoad` hook
- Use lazy imports for better performance
- Document custom methods with JSDoc
- Export default for compatibility
- Use namespaced environment variables

**Next:** [Plugin Lifecycle](./04-plugin-lifecycle.md) - Understand lifecycle hooks and states

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
