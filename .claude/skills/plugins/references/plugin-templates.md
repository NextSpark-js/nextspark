# Plugin Templates Reference

Copy-paste templates for plugin components, hooks, and API endpoints.

---

## ⭐ Plugin Environment Loader (REQUIRED)

Every plugin MUST have a `lib/plugin-env.ts` using core's centralized env-loader:

```typescript
// contents/plugins/my-plugin/lib/plugin-env.ts
import { getPluginEnv } from '@nextsparkjs/core/lib/plugins/env-loader'

interface MyPluginEnvConfig {
  MY_PLUGIN_ENABLED?: string
  MY_PLUGIN_DEBUG?: string
  MY_PLUGIN_API_KEY?: string
  MY_PLUGIN_TIMEOUT?: string
}

class PluginEnvironment {
  private static instance: PluginEnvironment
  private config: MyPluginEnvConfig = {}
  private loaded = false

  private constructor() {
    this.loadEnvironment()
  }

  public static getInstance(): PluginEnvironment {
    if (!PluginEnvironment.instance) {
      PluginEnvironment.instance = new PluginEnvironment()
    }
    return PluginEnvironment.instance
  }

  private loadEnvironment(forceReload: boolean = false): void {
    if (this.loaded && !forceReload) return

    try {
      // Use centralized plugin env loader
      // Priority: Plugin .env > Root .env > Defaults
      const env = getPluginEnv('my-plugin')

      this.config = {
        MY_PLUGIN_ENABLED: env.MY_PLUGIN_ENABLED || 'true',
        MY_PLUGIN_DEBUG: env.MY_PLUGIN_DEBUG || 'false',
        MY_PLUGIN_API_KEY: env.MY_PLUGIN_API_KEY,
        MY_PLUGIN_TIMEOUT: env.MY_PLUGIN_TIMEOUT || '5000',
      }

      this.loaded = true
    } catch (error) {
      console.error('[My Plugin] Failed to load environment:', error)
      this.loaded = true
    }
  }

  public getConfig(): MyPluginEnvConfig {
    if (!this.loaded) this.loadEnvironment()
    return this.config
  }

  // Type-safe helper methods
  public isPluginEnabled(): boolean {
    return this.getConfig().MY_PLUGIN_ENABLED !== 'false'
  }

  public isDebugEnabled(): boolean {
    return this.getConfig().MY_PLUGIN_DEBUG === 'true'
  }

  public getApiKey(): string | undefined {
    return this.getConfig().MY_PLUGIN_API_KEY
  }

  public getTimeout(): number {
    return parseInt(this.getConfig().MY_PLUGIN_TIMEOUT || '5000', 10)
  }

  public reload(): void {
    this.loaded = false
    this.loadEnvironment(true)
  }
}

export const pluginEnv = PluginEnvironment.getInstance()

// Convenience exports
export const isPluginEnabled = () => pluginEnv.isPluginEnabled()
export const isDebugEnabled = () => pluginEnv.isDebugEnabled()
export const getApiKey = () => pluginEnv.getApiKey()
export const getTimeout = () => pluginEnv.getTimeout()
```

**Benefits:**
- ✅ Plugin `.env` takes priority over root `.env`
- ✅ Automatic fallback to root `.env` for shared variables (API keys, etc.)
- ✅ Type-safe configuration access
- ✅ Singleton pattern for performance
- ✅ Reload support for testing

---

## Type Definitions

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

---

## Component Template

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

---

## Hook Templates

### Query Hook

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
```

### Mutation Hook

```typescript
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

---

## API Endpoint Templates

### POST Endpoint with Validation

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

### GET Endpoint with Query Params

```typescript
// contents/plugins/my-plugin/api/data/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/auth/authenticateRequest'

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateRequest(request)
    if (!auth.isAuthenticated) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse query params
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1', 10)
    const limit = parseInt(searchParams.get('limit') || '10', 10)

    // Fetch data
    const data = await fetchPluginData({ page, limit })

    return NextResponse.json({
      success: true,
      data,
      pagination: {
        page,
        limit,
        total: data.total
      }
    })
  } catch (error) {
    console.error('[My Plugin] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

---

## Provider Template

```typescript
// contents/plugins/my-plugin/providers/MyPluginProvider.tsx
'use client'

import { createContext, useContext, useState, ReactNode } from 'react'
import type { MyPluginConfig } from '../types/my-plugin.types'

interface MyPluginContextValue {
  config: MyPluginConfig | null
  isInitialized: boolean
  setConfig: (config: MyPluginConfig) => void
}

const MyPluginContext = createContext<MyPluginContextValue | null>(null)

interface MyPluginProviderProps {
  children: ReactNode
  initialConfig?: MyPluginConfig
}

export function MyPluginProvider({
  children,
  initialConfig
}: MyPluginProviderProps) {
  const [config, setConfig] = useState<MyPluginConfig | null>(initialConfig || null)
  const [isInitialized, setIsInitialized] = useState(!!initialConfig)

  const value: MyPluginContextValue = {
    config,
    isInitialized,
    setConfig: (newConfig) => {
      setConfig(newConfig)
      setIsInitialized(true)
    }
  }

  return (
    <MyPluginContext.Provider value={value}>
      {children}
    </MyPluginContext.Provider>
  )
}

export function useMyPluginContext() {
  const context = useContext(MyPluginContext)
  if (!context) {
    throw new Error('useMyPluginContext must be used within MyPluginProvider')
  }
  return context
}
```

---

## data-cy Selector Conventions

All plugin components MUST use data-cy selectors:

```typescript
// Naming convention: {plugin}-{component}-{element}
data-cy="my-plugin-widget"          // Container
data-cy="my-plugin-input"           // Input field
data-cy="my-plugin-action-btn"      // Button
data-cy="my-plugin-loading"         // Loading state
data-cy="my-plugin-error"           // Error state
data-cy="my-plugin-success"         // Success state
data-cy="my-plugin-content"         // Content area
```
