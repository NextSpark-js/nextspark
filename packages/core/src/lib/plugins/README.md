# Centralized Plugin Environment Loader

Automatically loads `.env` files from all plugins without duplicating code.

## How It Works

1. **Automatic Discovery**: Scans `contents/plugins/` directory
2. **Auto-Load**: Loads `.env` file from each plugin directory
3. **Zero Config**: Just create `.env` file - it works automatically

## Usage

### For Plugin Developers

**Step 1:** Create your plugin `.env` file

```bash
# contents/plugins/amplitude/.env
AMPLITUDE_API_KEY=your-key-here
AMPLITUDE_SECRET_KEY=your-secret-here
AMPLITUDE_ENABLED=true
```

**Step 2:** Access variables from your plugin code

```typescript
import { getPluginEnv } from '@/core/lib/plugins/env-loader'

const env = getPluginEnv('amplitude')
const apiKey = env.AMPLITUDE_API_KEY
const enabled = env.AMPLITUDE_ENABLED === 'true'
```

### Example: AI Plugin

The AI plugin uses this centralized loader:

```typescript
// contents/plugins/ai/lib/plugin-env.ts
import { getPluginEnv } from '@/core/lib/plugins/env-loader'

const env = getPluginEnv('ai')
const anthropicKey = env.ANTHROPIC_API_KEY
const useLocal = env.USE_LOCAL_AI === 'true'
```

## Benefits

✅ **DRY**: No code duplication across plugins
✅ **Automatic**: Just create `.env` - it works
✅ **Type-safe**: Add your own types per plugin
✅ **Centralized**: Single source of truth for env loading
✅ **Scalable**: Add unlimited plugins without changing core code

## API Reference

### `getPluginEnv(pluginName: string)`

Get environment variables for a specific plugin.

```typescript
const env = getPluginEnv('ai')
```

### `hasPluginEnv(pluginName: string)`

Check if a plugin has a `.env` file loaded.

```typescript
if (hasPluginEnv('amplitude')) {
  // Plugin has .env file
}
```

### `getLoadedPlugins()`

Get list of all plugins with `.env` files.

```typescript
const plugins = getLoadedPlugins()
// ['ai', 'amplitude', 'billing']
```

### `reloadPluginEnvs()`

Force reload all plugin environments (useful for testing).

```typescript
reloadPluginEnvs()
```

## Creating a New Plugin

1. Create plugin directory: `contents/plugins/my-plugin/`
2. Create `.env` file: `contents/plugins/my-plugin/.env`
3. Add your configuration:

```bash
# contents/plugins/my-plugin/.env
MY_PLUGIN_API_KEY=xxx
MY_PLUGIN_ENABLED=true
```

4. Access in your code:

```typescript
import { getPluginEnv } from '@/core/lib/plugins/env-loader'

const env = getPluginEnv('my-plugin')
const apiKey = env.MY_PLUGIN_API_KEY
```

That's it! No additional setup required.

## Migration from Old System

### Before (each plugin had duplicate env loading code)

```typescript
// contents/plugins/ai/lib/plugin-env.ts
import { config } from 'dotenv'
import { join } from 'path'

const pluginEnvPath = join(process.cwd(), 'contents/plugins/ai/.env')
config({ path: pluginEnvPath })
// ... lots of boilerplate
```

### After (use centralized loader)

```typescript
// contents/plugins/ai/lib/plugin-env.ts
import { getPluginEnv } from '@/core/lib/plugins/env-loader'

const env = getPluginEnv('ai')
// Done! No boilerplate needed
```

## Best Practices

1. **Namespace your variables**: Use plugin name prefix
   ```bash
   # Good
   AI_PLUGIN_ENABLED=true
   AMPLITUDE_API_KEY=xxx

   # Avoid
   ENABLED=true
   API_KEY=xxx
   ```

2. **Provide defaults**: Always have sensible defaults
   ```typescript
   const maxTokens = env.AI_PLUGIN_MAX_TOKENS || '4000'
   ```

3. **Type your config**: Create interfaces for type safety
   ```typescript
   interface MyPluginConfig {
     API_KEY?: string
     ENABLED?: string
   }
   ```

4. **Document variables**: Use `.env.example` files
   ```bash
   # contents/plugins/my-plugin/.env.example
   MY_PLUGIN_API_KEY=your-api-key-here
   MY_PLUGIN_ENABLED=true
   ```
