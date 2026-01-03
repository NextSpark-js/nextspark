/**
 * Centralized Plugin Environment Loader
 *
 * Automatically loads .env files from all plugins in contents/plugins/
 * No need to duplicate env loading code in each plugin
 *
 * Usage:
 *   import { getPluginEnv } from './env-loader'
 *   const env = getPluginEnv('ai')
 *   const apiKey = env.ANTHROPIC_API_KEY
 */

import { config } from 'dotenv'
import { join } from 'path'
import { readdirSync, existsSync, statSync } from 'fs'

/**
 * Plugin environment configuration
 */
type PluginEnvConfig = Record<string, string | undefined>

/**
 * Centralized plugin environment loader
 * Singleton pattern to ensure environments are loaded only once
 */
class PluginEnvLoader {
  private static instance: PluginEnvLoader | null = null
  private pluginEnvs: Map<string, PluginEnvConfig>
  private loaded: boolean = false

  private constructor() {
    this.pluginEnvs = new Map()
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PluginEnvLoader {
    if (!PluginEnvLoader.instance) {
      PluginEnvLoader.instance = new PluginEnvLoader()
    }
    return PluginEnvLoader.instance
  }

  /**
   * Load all plugin .env files
   */
  private loadAllPlugins(): void {
    if (this.loaded) return

    try {
      const pluginsDir = join(process.cwd(), 'contents/plugins')

      if (!existsSync(pluginsDir)) {
        console.warn('[Plugin Env Loader] No plugins directory found')
        this.loaded = true
        return
      }

      const entries = readdirSync(pluginsDir)

      for (const entry of entries) {
        const pluginPath = join(pluginsDir, entry)

        // Skip non-directories
        if (!statSync(pluginPath).isDirectory()) continue

        const envPath = join(pluginPath, '.env')
        let pluginEnv: PluginEnvConfig

        // Priority: plugin .env first, fallback to process.env
        if (existsSync(envPath)) {
          // Load plugin-specific .env without overriding global process.env
          const result = config({ path: envPath, override: false })

          if (result.error) {
            console.error(`[Plugin Env Loader] Error loading ${entry}/.env:`, result.error)
            // Fallback to process.env on error
            pluginEnv = { ...process.env }
          } else if (result.parsed) {
            // Use plugin .env exclusively (with fallback to process.env for missing keys)
            pluginEnv = { ...process.env, ...result.parsed }
            if (process.env.NODE_ENV === 'development') {
              console.log(`[Plugin Env Loader] ✓ Loaded ${entry}/.env (plugin-specific configuration)`)
            }
          } else {
            // Empty .env file, use process.env
            pluginEnv = { ...process.env }
          }
        } else {
          // No plugin .env found, use process.env (includes root .env)
          pluginEnv = { ...process.env }
          if (process.env.NODE_ENV === 'development') {
            console.log(`[Plugin Env Loader] ℹ️  ${entry}: Using process.env (no plugin .env file found)`)
          }
        }

        // Store plugin environment configuration
        this.pluginEnvs.set(entry, pluginEnv)
      }

      this.loaded = true
    } catch (error) {
      console.error('[Plugin Env Loader] Failed to load plugin environments:', error)
      this.loaded = true
    }
  }

  /**
   * Get environment configuration for a specific plugin
   */
  public getPluginEnv(pluginName: string): PluginEnvConfig {
    if (!this.loaded) {
      this.loadAllPlugins()
    }

    const pluginEnv = this.pluginEnvs.get(pluginName)

    if (!pluginEnv) {
      if (process.env.NODE_ENV === 'development') {
        console.warn(`[Plugin Env Loader] No .env found for plugin: ${pluginName}`)
      }
      return {}
    }

    return pluginEnv
  }

  /**
   * Check if a plugin has a .env file loaded
   */
  public hasPluginEnv(pluginName: string): boolean {
    if (!this.loaded) {
      this.loadAllPlugins()
    }
    return this.pluginEnvs.has(pluginName)
  }

  /**
   * Get list of all loaded plugins
   */
  public getLoadedPlugins(): string[] {
    if (!this.loaded) {
      this.loadAllPlugins()
    }
    return Array.from(this.pluginEnvs.keys())
  }

  /**
   * Force reload all plugin environments
   */
  public reload(): void {
    this.loaded = false
    this.pluginEnvs.clear()
    this.loadAllPlugins()
  }
}

/**
 * Get environment configuration for a specific plugin
 *
 * @param pluginName - Name of the plugin (e.g., 'ai', 'amplitude', 'billing')
 * @returns Plugin environment configuration
 *
 * @example
 * ```typescript
 * const env = getPluginEnv('ai')
 * const apiKey = env.ANTHROPIC_API_KEY
 * const useLocal = env.USE_LOCAL_AI === 'true'
 * ```
 */
export function getPluginEnv(pluginName: string): PluginEnvConfig {
  return PluginEnvLoader.getInstance().getPluginEnv(pluginName)
}

/**
 * Check if a plugin has environment configuration loaded
 */
export function hasPluginEnv(pluginName: string): boolean {
  return PluginEnvLoader.getInstance().hasPluginEnv(pluginName)
}

/**
 * Get list of all loaded plugin names
 */
export function getLoadedPlugins(): string[] {
  return PluginEnvLoader.getInstance().getLoadedPlugins()
}

/**
 * Force reload all plugin environments
 */
export function reloadPluginEnvs(): void {
  PluginEnvLoader.getInstance().reload()
}

/**
 * Initialize plugin environments (auto-loads on first access)
 */
export function initializePluginEnvs(): void {
  PluginEnvLoader.getInstance().getLoadedPlugins()
}
