import { PLUGIN_CAPABILITIES, definePlugin, type PluginConfig } from '@/core/types/plugin'

describe('definePlugin (#203)', () => {
  it('returns a regular PluginConfig with defaults for the descriptive fields', () => {
    const plugin: PluginConfig = definePlugin({ name: 'example', capabilities: ['server', 'web'] })
    expect(plugin).toEqual({
      name: 'example',
      displayName: 'example',
      version: '0.0.0',
      enabled: true,
      capabilities: ['server', 'web'],
    })
  })

  it('keeps every PluginConfig field a plugin sets', () => {
    const onLoad = async () => {}
    const plugin = definePlugin({
      name: 'full',
      displayName: 'Full',
      version: '2.1.0',
      description: 'd',
      enabled: false,
      dependencies: ['other'],
      hooks: { onLoad },
      api: { helper: 1 },
      capabilities: ['server', 'build'],
    })
    expect(plugin).toMatchObject({ displayName: 'Full', version: '2.1.0', enabled: false, dependencies: ['other'], api: { helper: 1 } })
    expect(plugin.hooks?.onLoad).toBe(onLoad)
  })

  it('accepts all four capabilities and drops duplicates', () => {
    expect(PLUGIN_CAPABILITIES).toEqual(['server', 'web', 'build', 'mobile'])
    expect(definePlugin({ name: 'all', capabilities: ['server', 'web', 'build', 'mobile', 'web'] }).capabilities).toEqual(['server', 'web', 'build', 'mobile'])
  })

  it('rejects an empty or unknown capability list', () => {
    expect(() => definePlugin({ name: 'none', capabilities: [] })).toThrow(/at least one of server, web, build, mobile/)
    expect(() => definePlugin({ name: 'edge', capabilities: ['edge' as never] })).toThrow(/unknown capability "edge"/)
  })

  it('is assignable to the legacy PluginConfig shape, and a legacy config needs no capabilities', () => {
    const legacy: PluginConfig = { name: 'legacy', displayName: 'Legacy', version: '1.0.0', enabled: true }
    expect(legacy.capabilities).toBeUndefined()
  })
})
