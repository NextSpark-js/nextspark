# /how-to:create-plugin

Interactive guide to create plugins for NextSpark.

---

## Required Skills

Before executing, these skills provide deeper context:
- `.claude/skills/plugins/SKILL.md` - Plugin development patterns
- `.claude/skills/create-plugin/SKILL.md` - Plugin scaffolding guide

---

## Syntax

```
/how-to:create-plugin
/how-to:create-plugin [plugin-name]
```

---

## Behavior

Guides the user through creating a plugin from scratch with proper structure, configuration, and NPM distribution rules.

---

## Tutorial Structure

```
STEPS OVERVIEW (6 steps)

Step 1: Understanding Plugins
        └── Plugin types and architecture

Step 2: Scaffold the Plugin
        └── Create directory structure

Step 3: Configure plugin.config.ts
        └── Define metadata and hooks

Step 4: Add Components and Hooks
        └── React components and hooks

Step 5: Manage Dependencies (CRITICAL)
        └── NPM distribution rules

Step 6: Test and Register
        └── Verify plugin works
```

---

## Step 1: Understanding Plugins

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📚 HOW TO: CREATE A PLUGIN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

STEP 1 OF 6: Understanding Plugins

Plugins extend NextSpark with reusable functionality:

┌─────────────────────────────────────────────┐
│  PLUGIN TYPES                               │
│  ─────────────────────────────────────────  │
│                                             │
│  utility       Simple utilities and helpers │
│  service       Full-stack with API, UI      │
│  configuration Settings management          │
│                                             │
└─────────────────────────────────────────────┘

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📂 Plugin Structure:

plugins/{plugin-name}/
├── package.json           # NPM package config
├── plugin.config.ts       # Plugin configuration
├── README.md              # Documentation
├── .env.example           # Environment template
├── types/
│   └── {plugin}.types.ts  # TypeScript types
├── lib/
│   ├── core.ts            # Core logic
│   └── utils.ts           # Utilities
├── hooks/
│   └── use{Plugin}.ts     # React hooks
├── components/
│   └── {Component}.tsx    # React components
├── providers/
│   └── {Plugin}Provider.tsx
├── api/                   # API routes (optional)
│   └── {endpoint}/route.ts
└── docs/                  # Documentation
    └── 01-getting-started/

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 Example Plugins:

• plugin-ai - AI assistant integration
• plugin-analytics - Usage analytics
• plugin-email - Email sending
• plugin-storage - File storage
• plugin-payments - Payment processing

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 2 (Scaffold)
[2] Show me plugin type examples
[3] Where do plugins live?
```

---

## Step 2: Scaffold the Plugin

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 2 OF 6: Scaffold the Plugin
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Create the plugin directory structure:
```

**📋 Create Directory Structure:**

```bash
# Create plugin directory
mkdir -p plugins/my-plugin/{types,lib,hooks,components,providers,docs}

# Create initial files
touch plugins/my-plugin/{package.json,plugin.config.ts,README.md,.env.example}
touch plugins/my-plugin/types/my-plugin.types.ts
touch plugins/my-plugin/lib/{core.ts,utils.ts,plugin-env.ts}
touch plugins/my-plugin/hooks/useMyPlugin.ts
touch plugins/my-plugin/components/MyPluginWidget.tsx
```

**📋 package.json Template:**

```json
{
  "name": "@nextsparkjs/plugin-my-plugin",
  "version": "1.0.0",
  "private": false,
  "main": "./plugin.config.ts",
  "types": "./types/index.ts",
  "dependencies": {},
  "peerDependencies": {
    "@nextsparkjs/core": "workspace:*",
    "next": "^15.0.0 || ^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
  }
}
```

**📋 .env.example Template:**

```env
# ============================================
# MY PLUGIN ENVIRONMENT VARIABLES
# ============================================
#
# ONLY put MY_PLUGIN_* namespaced variables here
# Global variables belong in root .env ONLY
#
# ============================================

MY_PLUGIN_ENABLED=true
MY_PLUGIN_API_KEY=your-api-key-here
MY_PLUGIN_DEBUG=false
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 3 (Configuration)
[2] Use the scaffold script instead
[3] What's the naming convention?
```

---

## Step 3: Configure plugin.config.ts

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 3 OF 6: Configure plugin.config.ts
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Define your plugin's configuration:
```

**📋 plugin.config.ts Example:**

```typescript
// plugins/my-plugin/plugin.config.ts
import type { PluginConfig } from '@/core/types/plugin'
import * as z from 'zod'

// Configuration schema
const MyPluginConfigSchema = z.object({
  apiKey: z.string().min(1).describe('API Key'),
  debug: z.boolean().default(false),
  timeout: z.number().min(1000).max(30000).default(5000),
})

export const myPluginConfig: PluginConfig = {
  // Required: Identity
  name: 'my-plugin',
  version: '1.0.0',
  displayName: 'My Custom Plugin',
  description: 'Add amazing functionality to your app',
  enabled: true,

  // Optional: Dependencies on other plugins
  dependencies: [],  // e.g., ['plugin-storage']

  // Optional: Components exposed to the app
  components: {
    MyPluginWidget: undefined,  // Lazy loaded
    MyPluginSettings: undefined,
  },

  // Optional: Hooks and services
  services: {
    useMyPlugin: undefined,
    useMyPluginMutation: undefined,
  },

  // Lifecycle hooks
  hooks: {
    // Called when plugin is first loaded
    async onLoad() {
      console.log('[My Plugin] Loading...')

      // Validate environment variables
      const apiKey = process.env.MY_PLUGIN_API_KEY
      if (!apiKey) {
        throw new Error('MY_PLUGIN_API_KEY is required')
      }
    },

    // Called when plugin is activated
    async onActivate() {
      console.log('[My Plugin] Activated')
    },

    // Called when plugin is deactivated
    async onDeactivate() {
      console.log('[My Plugin] Deactivated')
    },

    // Called when plugin is unloaded
    async onUnload() {
      console.log('[My Plugin] Cleanup...')
    },
  },

  // Configuration schema for validation
  configSchema: MyPluginConfigSchema,
}

export default myPluginConfig
```

**📋 Lifecycle Hooks:**

- `onLoad` - Initialize resources, validate config
- `onActivate` - Start background tasks
- `onDeactivate` - Pause/stop tasks
- `onUnload` - Cleanup resources

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 4 (Components)
[2] What config options are available?
[3] How do I validate environment vars?
```

---

## Step 4: Add Components and Hooks

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 4 OF 6: Add Components and Hooks
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**📋 Create a React Hook:**

```typescript
// plugins/my-plugin/hooks/useMyPlugin.ts
'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { MyPluginData, MyPluginInput } from '../types/my-plugin.types'

const QUERY_KEY = ['my-plugin'] as const

export function useMyPlugin() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<MyPluginData> => {
      const response = await fetch('/api/plugin/my-plugin/data')
      if (!response.ok) {
        throw new Error('Failed to fetch plugin data')
      }
      return response.json()
    },
  })
}

export function useMyPluginMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: MyPluginInput) => {
      const response = await fetch('/api/plugin/my-plugin/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })
      if (!response.ok) {
        throw new Error('Failed to process')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEY })
    },
  })
}
```

**📋 Create a React Component:**

```typescript
// plugins/my-plugin/components/MyPluginWidget.tsx
'use client'

import { useMyPlugin, useMyPluginMutation } from '../hooks/useMyPlugin'
import { Card, CardHeader, CardContent } from '@/core/components/ui/card'
import { Button } from '@/core/components/ui/button'
import { Loader2 } from 'lucide-react'

interface MyPluginWidgetProps {
  readonly title?: string
}

export function MyPluginWidget({ title = 'My Plugin' }: MyPluginWidgetProps) {
  const { data, isLoading, error } = useMyPlugin()
  const mutation = useMyPluginMutation()

  const handleAction = () => {
    mutation.mutate({ action: 'process' })
  }

  return (
    <Card data-cy="my-plugin-widget">
      <CardHeader>
        <h3 className="text-lg font-semibold">{title}</h3>
      </CardHeader>
      <CardContent>
        {isLoading && (
          <div data-cy="my-plugin-loading" className="flex items-center gap-2">
            <Loader2 className="animate-spin" />
            <span>Loading...</span>
          </div>
        )}

        {error && (
          <div data-cy="my-plugin-error" className="text-destructive">
            {error.message}
          </div>
        )}

        {data && (
          <div data-cy="my-plugin-content">
            <p>{data.message}</p>
            <Button
              data-cy="my-plugin-action-btn"
              onClick={handleAction}
              disabled={mutation.isPending}
            >
              {mutation.isPending ? 'Processing...' : 'Run Action'}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export default MyPluginWidget
```

**📋 Types Definition:**

```typescript
// plugins/my-plugin/types/my-plugin.types.ts
export interface MyPluginData {
  readonly id: string
  readonly message: string
  readonly status: 'active' | 'inactive'
  readonly lastUpdated: string
}

export interface MyPluginInput {
  readonly action: 'process' | 'reset'
  readonly options?: MyPluginOptions
}

export interface MyPluginOptions {
  readonly timeout?: number
  readonly force?: boolean
}
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 5 (Dependencies - CRITICAL)
[2] How do I add API endpoints?
[3] Show me provider pattern
```

---

## Step 5: Manage Dependencies (CRITICAL)

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 5 OF 6: Manage Dependencies (CRITICAL)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️  THIS IS MANDATORY FOR NPM DISTRIBUTION
```

**📋 The Golden Rule:**

If @nextsparkjs/core has a dependency,
plugins MUST declare it as peerDependency,
NEVER as dependency.

**❌ WRONG - Duplicated Dependencies:**

```
node_modules/
├── @nextsparkjs/core/
│   └── node_modules/zod@4.1.5  ← Instance 1
├── @nextsparkjs/plugin-ai/
│   └── node_modules/zod@4.1.5  ← Instance 2
└── @nextsparkjs/plugin-email/
    └── node_modules/zod@3.23.0 ← Instance 3!
```

Result: Type conflicts, instanceof failures, bloated bundle

**✅ CORRECT - Single Instance:**

```
node_modules/
├── zod@4.1.5  ← ONE instance (hoisted)
├── @nextsparkjs/core/     (provides zod)
├── @nextsparkjs/plugin-ai/  (uses host's zod)
└── @nextsparkjs/plugin-email/ (uses host's zod)
```

Result: No conflicts, optimized bundle

**📋 Dependencies Core Already Provides (NEVER duplicate):**

```json
{
  "zod": "^4.1.5",
  "@tanstack/react-query": "^5.85.0",
  "lucide-react": "^0.539.0",
  "class-variance-authority": "^0.7.1",
  "clsx": "^2.1.1",
  "tailwind-merge": "^3.3.1",
  "date-fns": "^4.1.0",
  "react-hook-form": "^7.62.0",
  "sonner": "^2.0.7",
  "next-intl": "^4.3.4",
  "next-themes": "^0.4.6",
  "uuid": "^13.0.0",
  "better-auth": "^1.3.5"
}
```

**📋 Correct package.json:**

```json
{
  "name": "@nextsparkjs/plugin-my-plugin",
  "dependencies": {
    "@some-external-lib/sdk": "^1.0.0"
  },
  "peerDependencies": {
    "@nextsparkjs/core": "workspace:*",
    "next": "^15.0.0 || ^16.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zod": "^4.0.0"
  }
}
```

**📋 Verify No Duplicates:**

```bash
# Check for duplicate packages
pnpm ls zod
# Should show ONE version only

# Check workspace structure
pnpm ls --depth=0
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

What would you like to do?

[1] Continue to Step 6 (Test & Register)
[2] How do I check if core has a dependency?
[3] My plugin needs a new dependency
```

---

## Step 6: Test and Register

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STEP 6 OF 6: Test and Register
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

**1️⃣ Add Plugin to Workspace:**

```yaml
# pnpm-workspace.yaml
packages:
  - 'core'
  - 'plugins/*'
  - 'contents/themes/*'
```

**2️⃣ Install Dependencies:**

```bash
pnpm install
```

**3️⃣ Rebuild Plugin Registry:**

```bash
node core/scripts/build/registry.mjs
```

**4️⃣ Test in Development:**

```bash
pnpm dev
```

Use your plugin components:

```typescript
// In your theme or app
import { MyPluginWidget } from '@nextsparkjs/plugin-my-plugin'

export function Dashboard() {
  return (
    <div>
      <MyPluginWidget title="My Plugin" />
    </div>
  )
}
```

**5️⃣ Write Tests:**

```typescript
// plugins/my-plugin/__tests__/my-plugin.test.ts
import { myPluginConfig } from '../plugin.config'

describe('My Plugin', () => {
  it('should have valid configuration', () => {
    expect(myPluginConfig.name).toBe('my-plugin')
    expect(myPluginConfig.version).toBeDefined()
  })

  it('should validate environment on load', async () => {
    process.env.MY_PLUGIN_API_KEY = 'test-key'
    await expect(myPluginConfig.hooks?.onLoad?.()).resolves.not.toThrow()
  })
})
```

**6️⃣ Build and Verify:**

```bash
pnpm build
# Should complete without errors
```

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ TUTORIAL STORY!

You've created a plugin with:
• Proper directory structure
• Configuration with lifecycle hooks
• React components and hooks
• Correct NPM dependencies
• Registry integration

📚 Related tutorials:
   • /how-to:install-plugins - Install existing plugins
   • /how-to:create-api - Add API to your plugin

🔙 Back to menu: /how-to:start
```

---

## Related Commands

| Command | Action |
|---------|--------|
| `/how-to:install-plugins` | Install plugins |
| `/session:block:create` | Create blocks (similar pattern) |
