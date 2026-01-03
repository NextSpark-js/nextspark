# Plugin Lifecycle

## Introduction

Plugin lifecycle management ensures proper initialization, activation, and cleanup of plugins throughout their operational lifetime. This document covers all lifecycle hooks, states, and best practices for managing plugin behavior.

**Lifecycle Stages:**
1. **onRegister** - Build-time discovery and validation
2. **onLoad** - Runtime initialization (server startup)
3. **onActivate** - Plugin enabled and ready
4. **onDeactivate** - Plugin disabled, cleanup started
5. **onUnload** - Final cleanup (server shutdown)

---

## Lifecycle Hooks Reference

### `onRegister` - Build-Time Hook

**When**: During build process when `core/scripts/build/registry.mjs` discovers plugin

**Purpose**: Validate plugin structure, check dependencies, generate assets

**Context**: Node.js build environment (NOT server runtime)

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onRegister() {
      console.log('[My Plugin] Discovered at build-time')

      // Validate required files exist
      const requiredFiles = ['./lib/core-utils.ts', './types/index.ts']
      for (const file of requiredFiles) {
        if (!existsSync(join(__dirname, file))) {
          throw new Error(`Missing required file: ${file}`)
        }
      }

      // Check dependencies
      if (!existsSync('./node_modules/some-package')) {
        console.warn('[My Plugin] Missing optional dependency: some-package')
      }
    }
  }
}
```

---

### `onLoad` - Server Initialization Hook

**When**: Server startup, before handling requests

**Purpose**: Initialize connections, load config, validate environment

**Context**: Server runtime (Node.js/Next.js)

**Example**:
```typescript
export const aiPluginConfig: PluginConfig = {
  name: 'ai',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onLoad() {
      console.log('[AI Plugin] Initializing...')

      // Load environment configuration
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) {
        throw new Error('[AI Plugin] ANTHROPIC_API_KEY required')
      }

      // Initialize external connections
      await this.initializeProviders()

      // Validate configuration
      await this.validateSetup()

      console.log('[AI Plugin] Ready')
    }
  },

  initializeProviders: async () => {
    // Initialize OpenAI, Anthropic, Ollama clients
  },

  validateSetup: async () => {
    // Validate API keys and configuration
  }
}
```

---

### `onActivate` - Activation Hook

**When**: Plugin enabled (enabled: true in config)

**Purpose**: Start services, enable features, begin operations

**Example**:
```typescript
export const analyticsPluginConfig: PluginConfig = {
  name: 'analytics',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onActivate() {
      console.log('[Analytics] Activating...')

      // Start background jobs
      await this.startEventProcessing()

      // Register webhooks
      await this.registerWebhooks()

      // Enable tracking
      this.tracking = true

      console.log('[Analytics] Active')
    }
  },

  startEventProcessing: async () => {
    // Start periodic event aggregation
  },

  registerWebhooks: async () => {
    // Register analytics webhooks
  }
}
```

---

### `onDeactivate` - Deactivation Hook

**When**: Plugin disabled (enabled: false in config)

**Purpose**: Stop services, cleanup resources, disable features

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onDeactivate() {
      console.log('[My Plugin] Deactivating...')

      // Stop background jobs
      await this.stopBackgroundTasks()

      // Close connections
      await this.closeConnections()

      // Clear caches
      this.cache.clear()

      console.log('[My Plugin] Deactivated')
    }
  },

  stopBackgroundTasks: async () => {
    // Stop all background processing
  },

  closeConnections: async () => {
    // Close database and API connections
  }
}
```

---

### `onUnload` - Shutdown Hook

**When**: Server shutdown or plugin removal

**Purpose**: Final cleanup, save state, release resources

**Example**:
```typescript
export const myPluginConfig: PluginConfig = {
  name: 'my-plugin',
  version: '1.0.0',
  enabled: true,

  hooks: {
    async onUnload() {
      console.log('[My Plugin] Unloading...')

      // Save current state
      await this.saveState()

      // Close all connections
      await this.cleanup()

      // Release resources
      this.resources.forEach(r => r.release())

      console.log('[My Plugin] Unloaded')
    }
  },

  saveState: async () => {
    // Persist plugin state to database
  },

  cleanup: async () => {
    // Final cleanup before shutdown
  }
}
```

---

## Complete Lifecycle Example

```typescript
export const fullLifecyclePlugin: PluginConfig = {
  name: 'full-lifecycle',
  version: '1.0.0',
  enabled: true,
  dependencies: ['ai'],

  hooks: {
    async onRegister() {
      console.log('[Plugin] 1. onRegister - Build-time validation')
      // Validate plugin structure
      // Check dependencies exist
      // Generate build-time assets
    },

    async onLoad() {
      console.log('[Plugin] 2. onLoad - Server startup')
      // Load environment config
      // Initialize connections
      // Validate API keys
      // Set up plugin state
    },

    async onActivate() {
      console.log('[Plugin] 3. onActivate - Plugin enabled')
      // Start background jobs
      // Enable features
      // Register webhooks
      // Begin operations
    },

    async onDeactivate() {
      console.log('[Plugin] 4. onDeactivate - Plugin disabled')
      // Stop background jobs
      // Disable features
      // Cleanup resources
      // Close connections
    },

    async onUnload() {
      console.log('[Plugin] 5. onUnload - Server shutdown')
      // Save state to disk
      // Final cleanup
      // Release all resources
      // Close all connections
    }
  }
}
```

---

## Best Practices

### 1. Error Handling in Hooks

**✅ Good:**
```typescript
hooks: {
  async onLoad() {
    try {
      await this.initialize()
    } catch (error) {
      console.error('[My Plugin] Initialization failed:', error)
      // Gracefully handle error - don't crash server
      this.enabled = false
    }
  }
}
```

**❌ Bad:**
```typescript
hooks: {
  async onLoad() {
    await this.initialize() // ❌ Unhandled errors crash server
  }
}
```

---

### 2. Cleanup in onUnload

**✅ Good:**
```typescript
hooks: {
  async onUnload() {
    // Save state first
    await this.saveState()

    // Then cleanup
    await this.cleanup()

    // Finally release resources
    this.resources.forEach(r => r.release())
  }
}
```

---

### 3. Dependency Initialization

**✅ Good:**
```typescript
dependencies: ['ai', 'billing'],

hooks: {
  async onLoad() {
    // Dependencies guaranteed to be loaded
    const { selectModel } = usePlugin('ai')
    const { getSubscription } = usePlugin('billing')

    await this.initialize({ selectModel, getSubscription })
  }
}
```

---

## Troubleshooting

### Issue 1: Hook Not Called

**Symptom**: Lifecycle hook doesn't execute

**Solution**: Check plugin is enabled and hook is defined correctly
```typescript
// ✅ Correct
hooks: {
  async onLoad() {
    console.log('Hook called')
  }
}

// ❌ Wrong
hooks: {
  onLoad() {  // ❌ Missing async
    console.log('Hook not called')
  }
}
```

---

### Issue 2: Initialization Timeout

**Symptom**: Plugin takes too long to initialize

**Solution**: Use parallel initialization
```typescript
hooks: {
  async onLoad() {
    // ✅ Parallel initialization
    await Promise.all([
      this.initDatabase(),
      this.initCache(),
      this.initAPI()
    ])
  }
}
```

---

## Summary

**Lifecycle Hooks:**
- ✅ `onRegister` - Build-time validation
- ✅ `onLoad` - Server startup initialization
- ✅ `onActivate` - Plugin activation
- ✅ `onDeactivate` - Plugin deactivation
- ✅ `onUnload` - Server shutdown cleanup

**Best Practices:**
- Handle errors gracefully in all hooks
- Clean up resources in onUnload
- Use parallel initialization when possible
- Validate dependencies in onLoad
- Save state before shutdown

**Next:** [Plugin API Routes](./05-plugin-api-routes.md) - Create plugin API endpoints

---

**Last Updated**: 2025-11-19
**Version**: 1.0.0
**Status**: Complete
