/**
 * Unit Tests - Plugin Environment Loader
 *
 * Tests the centralized plugin environment loading system.
 * Uses integration-style testing to verify actual behavior.
 *
 * Test Coverage:
 * - getPluginEnv(): Plugin-specific and fallback to root .env
 * - hasPluginEnv(): Check if plugin has environment loaded
 * - getLoadedPlugins(): List all loaded plugins
 * - reloadPluginEnvs(): Force reload all environments
 * - initializePluginEnvs(): Initialize plugin environments
 */

import * as fs from 'fs'
import * as path from 'path'
import { tmpdir } from 'os'

// Store original functions
const originalExistsSync = fs.existsSync
const originalReaddirSync = fs.readdirSync
const originalStatSync = fs.statSync
const originalCwd = process.cwd

describe('PluginEnvLoader', () => {
  let testDir: string
  let pluginsDir: string

  // Create test directory structure before each test
  beforeEach(() => {
    // Create unique test directory
    testDir = path.join(tmpdir(), `nextspark-test-${Date.now()}-${Math.random().toString(36).slice(2)}`)
    pluginsDir = path.join(testDir, 'contents', 'plugins')

    // Create directory structure
    fs.mkdirSync(pluginsDir, { recursive: true })

    // Mock process.cwd to return test directory
    jest.spyOn(process, 'cwd').mockReturnValue(testDir)

    // Clear module cache to get fresh singleton
    jest.resetModules()
  })

  // Clean up after each test
  afterEach(() => {
    // Restore mocks
    jest.restoreAllMocks()

    // Clean up test directory
    try {
      fs.rmSync(testDir, { recursive: true, force: true })
    } catch {
      // Ignore cleanup errors
    }
  })

  describe('getPluginEnv() - Basic Functionality', () => {
    it('should return plugin-specific .env variables when plugin .env exists', async () => {
      // Create ai plugin directory with .env
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(aiPluginDir, '.env'),
        'AI_PLUGIN_API_KEY=plugin-secret-key\nAI_PLUGIN_ENABLED=true'
      )

      // Set root .env variable
      process.env.AI_PLUGIN_API_KEY = 'root-key'
      process.env.DATABASE_URL = 'postgres://localhost'

      // Import fresh module
      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      // Plugin .env should override root .env
      expect(env.AI_PLUGIN_API_KEY).toBe('plugin-secret-key')
      expect(env.AI_PLUGIN_ENABLED).toBe('true')
      // Root .env should still be accessible for non-overridden vars
      expect(env.DATABASE_URL).toBe('postgres://localhost')

      // Cleanup
      delete process.env.AI_PLUGIN_API_KEY
      delete process.env.DATABASE_URL
    })

    it('should fallback to root .env when plugin .env does not exist', async () => {
      // Create ai plugin directory WITHOUT .env
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      // No .env file created

      // Set root .env variables
      process.env.ANTHROPIC_API_KEY = 'root-anthropic-key'
      process.env.NODE_ENV = 'development'

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      // Should use process.env (root .env values)
      expect(env.ANTHROPIC_API_KEY).toBe('root-anthropic-key')
      expect(env.NODE_ENV).toBe('development')

      // Cleanup
      delete process.env.ANTHROPIC_API_KEY
    })

    it('should fallback to process.env for non-existent plugin', async () => {
      // Create different plugin, not the one we're looking for
      const otherPluginDir = path.join(pluginsDir, 'other-plugin')
      fs.mkdirSync(otherPluginDir, { recursive: true })

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('non-existent-plugin')

      // Unknown plugins get process.env as fallback (design decision for consistency)
      // Verify it returns a non-empty object containing system env vars
      expect(Object.keys(env).length).toBeGreaterThan(0)
      expect(env).toHaveProperty('PATH')
    })

    it('should fallback to process.env when plugins directory does not exist', async () => {
      // Remove plugins directory
      fs.rmSync(pluginsDir, { recursive: true, force: true })

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('any-plugin')

      // Falls back to process.env when plugins dir doesn't exist
      expect(Object.keys(env).length).toBeGreaterThan(0)
      expect(env).toHaveProperty('PATH')
    })
  })

  describe('getPluginEnv() - Priority System', () => {
    it('should prioritize plugin .env over root .env for same variable', async () => {
      // Create ai plugin with .env
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'USE_LOCAL_AI=true')

      // Set different value in root
      process.env.USE_LOCAL_AI = 'false'

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      // Plugin .env takes priority
      expect(env.USE_LOCAL_AI).toBe('true')

      // Cleanup
      delete process.env.USE_LOCAL_AI
    })

    it('should include root .env variables not in plugin .env', async () => {
      // Create ai plugin with .env
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'AI_PLUGIN_DEBUG=true')

      // Set root vars
      process.env.DATABASE_URL = 'postgres://root'
      process.env.BETTER_AUTH_SECRET = 'secret'

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      // Plugin-specific
      expect(env.AI_PLUGIN_DEBUG).toBe('true')
      // Root vars
      expect(env.DATABASE_URL).toBe('postgres://root')
      expect(env.BETTER_AUTH_SECRET).toBe('secret')

      // Cleanup
      delete process.env.DATABASE_URL
      delete process.env.BETTER_AUTH_SECRET
    })
  })

  describe('getPluginEnv() - Multiple Plugins', () => {
    it('should load independent .env for each plugin', async () => {
      // Create multiple plugins
      const plugins = [
        { name: 'ai', env: 'PLUGIN_NAME=ai-plugin' },
        { name: 'langchain', env: 'PLUGIN_NAME=langchain-plugin' },
        { name: 'social-media-publisher', env: 'PLUGIN_NAME=smp-plugin' },
      ]

      for (const plugin of plugins) {
        const dir = path.join(pluginsDir, plugin.name)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, '.env'), plugin.env)
      }

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const aiEnv = getPluginEnv('ai')
      const langchainEnv = getPluginEnv('langchain')
      const smpEnv = getPluginEnv('social-media-publisher')

      expect(aiEnv.PLUGIN_NAME).toBe('ai-plugin')
      expect(langchainEnv.PLUGIN_NAME).toBe('langchain-plugin')
      expect(smpEnv.PLUGIN_NAME).toBe('smp-plugin')
    })
  })

  describe('hasPluginEnv()', () => {
    it('should return true for plugin with loaded environment', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'TEST=true')

      const { hasPluginEnv, getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      // Trigger loading
      getPluginEnv('ai')

      expect(hasPluginEnv('ai')).toBe(true)
    })

    it('should return false for non-existent plugin', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })

      const { hasPluginEnv } = await import('@/core/lib/plugins/env-loader')

      expect(hasPluginEnv('non-existent')).toBe(false)
    })
  })

  describe('getLoadedPlugins()', () => {
    it('should return array of loaded plugin names', async () => {
      // Create multiple plugins
      for (const name of ['ai', 'langchain', 'social-media-publisher']) {
        const dir = path.join(pluginsDir, name)
        fs.mkdirSync(dir, { recursive: true })
      }

      const { getLoadedPlugins } = await import('@/core/lib/plugins/env-loader')

      const plugins = getLoadedPlugins()

      expect(Array.isArray(plugins)).toBe(true)
      expect(plugins).toContain('ai')
      expect(plugins).toContain('langchain')
      expect(plugins).toContain('social-media-publisher')
    })

    it('should return empty array when no plugins exist', async () => {
      // Remove plugins directory
      fs.rmSync(pluginsDir, { recursive: true, force: true })

      const { getLoadedPlugins } = await import('@/core/lib/plugins/env-loader')

      const plugins = getLoadedPlugins()

      expect(Array.isArray(plugins)).toBe(true)
      expect(plugins.length).toBe(0)
    })

    it('should skip non-directory entries', async () => {
      // Create plugins
      for (const name of ['ai', 'langchain']) {
        const dir = path.join(pluginsDir, name)
        fs.mkdirSync(dir, { recursive: true })
      }
      // Create a file (not directory)
      fs.writeFileSync(path.join(pluginsDir, 'README.md'), '# Plugins')

      const { getLoadedPlugins } = await import('@/core/lib/plugins/env-loader')

      const plugins = getLoadedPlugins()

      expect(plugins).toContain('ai')
      expect(plugins).toContain('langchain')
      expect(plugins).not.toContain('README.md')
    })
  })

  describe('reloadPluginEnvs()', () => {
    it('should clear and reload all plugin environments', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'VALUE=original')

      const { getPluginEnv, reloadPluginEnvs } = await import('@/core/lib/plugins/env-loader')

      // First load
      let env = getPluginEnv('ai')
      expect(env.VALUE).toBe('original')

      // Update the .env file
      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'VALUE=updated')

      // Reload
      reloadPluginEnvs()

      // Should have new value
      env = getPluginEnv('ai')
      expect(env.VALUE).toBe('updated')
    })
  })

  describe('initializePluginEnvs()', () => {
    it('should trigger loading of all plugins', async () => {
      // Create plugins
      for (const name of ['ai', 'langchain']) {
        const dir = path.join(pluginsDir, name)
        fs.mkdirSync(dir, { recursive: true })
      }

      const { initializePluginEnvs, getLoadedPlugins } = await import('@/core/lib/plugins/env-loader')

      initializePluginEnvs()

      const plugins = getLoadedPlugins()
      expect(plugins).toContain('ai')
      expect(plugins).toContain('langchain')
    })
  })

  describe('Singleton Pattern', () => {
    it('should return same environment for multiple calls', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'API_KEY=test-key')

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env1 = getPluginEnv('ai')
      const env2 = getPluginEnv('ai')

      expect(env1).toEqual(env2)
    })
  })

  describe('Edge Cases', () => {
    it('should handle plugin name with special characters', async () => {
      const pluginName = 'my-special-plugin-123'
      const pluginDir = path.join(pluginsDir, pluginName)
      fs.mkdirSync(pluginDir, { recursive: true })
      fs.writeFileSync(path.join(pluginDir, '.env'), 'SPECIAL=value')

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv(pluginName)

      expect(env.SPECIAL).toBe('value')
    })

    it('should fallback to process.env for empty plugin name', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('')

      // Empty plugin name treated as non-existent, falls back to process.env
      expect(Object.keys(env).length).toBeGreaterThan(0)
      expect(env).toHaveProperty('PATH')
    })

    it('should handle .env with comments and empty lines', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(aiPluginDir, '.env'),
        `# This is a comment
API_KEY=my-key

# Another comment
DEBUG=true

`
      )

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      expect(env.API_KEY).toBe('my-key')
      expect(env.DEBUG).toBe('true')
    })

    it('should handle .env with quoted values', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(aiPluginDir, '.env'),
        `SINGLE_QUOTED='single quoted value'
DOUBLE_QUOTED="double quoted value"
UNQUOTED=unquoted value`
      )

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      expect(env.SINGLE_QUOTED).toBe('single quoted value')
      expect(env.DOUBLE_QUOTED).toBe('double quoted value')
      expect(env.UNQUOTED).toBe('unquoted value')
    })
  })

  describe('Integration Scenarios', () => {
    it('should work with typical AI plugin setup', async () => {
      const aiPluginDir = path.join(pluginsDir, 'ai')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.writeFileSync(
        path.join(aiPluginDir, '.env'),
        `AI_PLUGIN_ENABLED=true
AI_PLUGIN_DEBUG=false
USE_LOCAL_AI=true
OLLAMA_BASE_URL=http://localhost:11434`
      )

      // Root .env provides API keys
      process.env.ANTHROPIC_API_KEY = 'sk-ant-xxx'
      process.env.OPENAI_API_KEY = 'sk-xxx'

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const env = getPluginEnv('ai')

      // Plugin-specific settings
      expect(env.AI_PLUGIN_ENABLED).toBe('true')
      expect(env.AI_PLUGIN_DEBUG).toBe('false')
      expect(env.USE_LOCAL_AI).toBe('true')
      expect(env.OLLAMA_BASE_URL).toBe('http://localhost:11434')

      // Root API keys still accessible
      expect(env.ANTHROPIC_API_KEY).toBe('sk-ant-xxx')
      expect(env.OPENAI_API_KEY).toBe('sk-xxx')

      // Cleanup
      delete process.env.ANTHROPIC_API_KEY
      delete process.env.OPENAI_API_KEY
    })

    it('should work with multiple plugins sharing root credentials', async () => {
      // Create plugins
      const aiPluginDir = path.join(pluginsDir, 'ai')
      const langchainPluginDir = path.join(pluginsDir, 'langchain')
      fs.mkdirSync(aiPluginDir, { recursive: true })
      fs.mkdirSync(langchainPluginDir, { recursive: true })

      fs.writeFileSync(path.join(aiPluginDir, '.env'), 'AI_MAX_TOKENS=4000')
      fs.writeFileSync(path.join(langchainPluginDir, '.env'), 'LANGCHAIN_VERBOSE=true')

      // Shared credentials in root .env
      process.env.ANTHROPIC_API_KEY = 'shared-key'

      const { getPluginEnv } = await import('@/core/lib/plugins/env-loader')

      const aiEnv = getPluginEnv('ai')
      const langchainEnv = getPluginEnv('langchain')

      // Plugin-specific
      expect(aiEnv.AI_MAX_TOKENS).toBe('4000')
      expect(langchainEnv.LANGCHAIN_VERBOSE).toBe('true')

      // Both can access shared credentials
      expect(aiEnv.ANTHROPIC_API_KEY).toBe('shared-key')
      expect(langchainEnv.ANTHROPIC_API_KEY).toBe('shared-key')

      // Cleanup
      delete process.env.ANTHROPIC_API_KEY
    })
  })
})
