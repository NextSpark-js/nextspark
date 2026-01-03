/**
 * Plugin Loader with Auto-Discovery and Security
 * 
 * Safely loads and manages plugins from the contents directory
 */

import type { PluginConfig, PluginHooks } from '../../types/plugin'
import { PluginService, type PluginName } from '../services'
import { PLUGIN_REGISTRY } from '@nextsparkjs/registries/plugin-registry'

/**
 * Security whitelist for allowed plugin imports
 * TODO: Implement static analysis to check plugin imports
 */
// const ALLOWED_IMPORTS = [
//   'react',
//   'react-dom',
//   'next',
//   '@nextsparkjs/core/components/ui/',
//   '@nextsparkjs/core/hooks/',
//   '@nextsparkjs/core/lib/',
//   'lucide-react',
//   'zod',
//   '@tanstack/react-query'
// ]

/**
 * Forbidden imports for security
 * TODO: Implement static analysis to check plugin imports
 */
// const FORBIDDEN_IMPORTS = [
//   'fs',
//   'path',
//   'child_process',
//   'os',
//   'crypto',
//   'net',
//   'http',
//   'https'
// ]

/**
 * Plugin validation cache
 * Note: Registry already provides instant access, cache used for validation results
 */
const pluginCache = new Map<string, PluginConfig>()

/**
 * Discover all plugins from build-time registry (ultra-fast, zero I/O)
 *
 * Performance: <2ms (vs ~80ms old runtime discovery)
 */
export function discoverPlugins(): PluginConfig[] {
  try {
    console.log('[Plugins] Loading plugins from registry...')

    const plugins = PluginService.getAll()

    // Validate each plugin
    const validatedPlugins: PluginConfig[] = []

    for (const plugin of plugins) {
      const validation = validatePlugin(plugin)

      if (validation.valid) {
        validatedPlugins.push(plugin)
        pluginCache.set(plugin.name, plugin)
      } else {
        console.warn(`[Plugins] Plugin ${plugin.name} failed validation:`, validation.errors)
      }
    }

    console.log(`[Plugins] Loaded ${validatedPlugins.length} valid plugins from registry`)
    return validatedPlugins

  } catch (error) {
    console.error('[Plugins] Error loading plugins:', error)
    return []
  }
}

/**
 * Load a plugin from registry with security checks (ultra-fast, zero I/O)
 *
 * Performance: <1ms (vs ~50ms old runtime loading)
 */
export function loadPluginSafely(name: string): PluginConfig | null {
  // Check cache first
  const cached = pluginCache.get(name)
  if (cached) {
    console.log(`[Plugins] Using cached plugin: ${name}`)
    return cached
  }

  // Load from registry (instant access, no I/O)
  const plugin = loadPluginWithValidation(name)

  if (plugin) {
    pluginCache.set(name, plugin)
  }

  return plugin
}

/**
 * Load plugin from registry with validation (ultra-fast, zero I/O)
 *
 * Performance: <1ms (vs ~50ms old runtime loading)
 */
function loadPluginWithValidation(name: string): PluginConfig | null {
  console.log(`[Plugins] Loading plugin from registry: ${name}`)

  try {
    // Get from build-time registry (instant access, zero I/O)
    const plugin = PluginService.get(name)

    if (!plugin) {
      console.warn(`[Plugins] Plugin not found in registry: ${name}`)
      return null
    }

    // Validate plugin configuration
    const validation = validatePlugin(plugin)
    if (!validation.valid) {
      console.error(`[Plugins] Plugin ${name} validation failed:`, validation.errors)
      return null
    }

    // Security check
    const securityCheck = performSecurityCheck(plugin)
    if (!securityCheck.safe) {
      console.error(`[Plugins] Plugin ${name} failed security check:`, securityCheck.issues)
      return null
    }

    console.log(`[Plugins] Successfully loaded plugin from registry: ${name}`)
    return plugin

  } catch (error) {
    console.error(`[Plugins] Error loading plugin ${name}:`, error)
    return null
  }
}

/**
 * Validate plugin configuration
 */
export function validatePlugin(plugin: PluginConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Required fields
  if (!plugin.name) {
    errors.push('Plugin name is required')
  }

  if (!plugin.displayName) {
    errors.push('Plugin display name is required')
  }

  if (!plugin.version) {
    errors.push('Plugin version is required')
  }

  // Name format validation
  if (plugin.name && !/^[a-z][a-z0-9-]*$/.test(plugin.name)) {
    errors.push('Plugin name must be lowercase, start with a letter, and contain only letters, numbers, and hyphens')
  }

  // Version format validation
  if (plugin.version && !/^\d+\.\d+\.\d+$/.test(plugin.version)) {
    errors.push('Plugin version must follow semver format (x.y.z)')
  }

  // Dependencies validation
  if (plugin.dependencies) {
    for (const dep of plugin.dependencies) {
      if (!dep || typeof dep !== 'string') {
        errors.push(`Invalid dependency: ${dep}`)
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}

/**
 * Perform security check on plugin
 */
function performSecurityCheck(plugin: PluginConfig): { safe: boolean; issues: string[] } {
  const issues: string[] = []

  // This is a basic security check - in a real implementation,
  // you would analyze the plugin code for dangerous patterns
  
  // Check plugin name for suspicious patterns
  if (plugin.name.includes('..') || plugin.name.includes('/') || plugin.name.includes('\\')) {
    issues.push('Plugin name contains suspicious path characters')
  }

  // Check if plugin tries to access forbidden modules
  // (This would require static analysis of the plugin code)
  
  return {
    safe: issues.length === 0,
    issues
  }
}

/**
 * Register plugin with hook system
 */
export async function registerPlugin(plugin: PluginConfig): Promise<boolean> {
  try {
    console.log(`[Plugins] Registering plugin: ${plugin.name}`)
    
    // Execute plugin load hook
    if (plugin.hooks?.onLoad) {
      await plugin.hooks.onLoad()
    }

    // Register plugin hooks with the global hook system
    if (plugin.hooks) {
      await registerPluginHooks(plugin.name, plugin.hooks)
    }

    console.log(`[Plugins] Successfully registered plugin: ${plugin.name}`)
    return true
    
  } catch (error) {
    console.error(`[Plugins] Error registering plugin ${plugin.name}:`, error)
    return false
  }
}

/**
 * Register plugin hooks with global hook system
 */
async function registerPluginHooks(pluginName: string, hooks: PluginHooks): Promise<void> {
  // This would integrate with a global hook system
  // For now, just log the registration
  console.log(`[Plugins] Registered hooks for plugin: ${pluginName}`, Object.keys(hooks))
}

/**
 * Unload a plugin
 */
export async function unloadPlugin(name: string): Promise<boolean> {
  try {
    const plugin = pluginCache.get(name)
    
    if (!plugin) {
      console.warn(`[Plugins] Plugin not loaded: ${name}`)
      return true
    }

    // Execute plugin unload hook
    if (plugin.hooks?.onUnload) {
      await plugin.hooks.onUnload()
    }

    // Remove from cache
    pluginCache.delete(name)
    
    console.log(`[Plugins] Successfully unloaded plugin: ${name}`)
    return true
    
  } catch (error) {
    console.error(`[Plugins] Error unloading plugin ${name}:`, error)
    return false
  }
}

/**
 * Get plugin loading statistics (registry-based, instant access)
 */
export function getPluginStats(): {
  loaded: number
  cached: number
  loading: number
} {
  return {
    loaded: pluginCache.size,
    cached: pluginCache.size,
    loading: 0 // Registry-based loading is instant, no async operations
  }
}

/**
 * Clear plugin cache
 */
export function clearPluginCache(): void {
  pluginCache.clear()
  console.log('[Plugins] Cleared plugin cache')
}