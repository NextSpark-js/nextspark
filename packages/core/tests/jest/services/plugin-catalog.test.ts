/**
 * PluginService catalog (#203, stage 7a): the executable server registry lists only the plugins that declare
 * 'server'; listings read the capability-neutral catalog, which lists every enabled plugin.
 */

jest.mock('@nextsparkjs/registries/plugin-registry', () => ({
  PLUGIN_REGISTRY: {
    langchain: { name: 'langchain', config: { name: 'langchain', displayName: 'LangChain', version: '2.0.0', enabled: true }, hasAPI: true, apiPath: '/api/plugins/langchain', routeFiles: [], entities: [] },
    ai: { name: 'ai', config: { name: 'ai', displayName: 'AI', version: '1.0.0', enabled: false }, hasAPI: true, apiPath: null, routeFiles: [], entities: [] },
  },
  ROUTE_METADATA: {},
  PLUGIN_METADATA: { totalPlugins: 2 },
}))

jest.mock('@nextsparkjs/registries/plugin-catalog', () => {
  const entry = (name: string, capabilities: string[], enabled: boolean | null = true) => ({ name, displayName: name, version: '1.0.0', description: null, enabled, capabilities, hasAPI: false, apiPath: null, entities: [], hasMessages: false, hasAssets: false })
  return {
    PLUGIN_CATALOG: {
      walkme: entry('walkme', ['web']),
      langchain: entry('langchain', ['server', 'web']),
      amplitude: entry('amplitude', ['web'], false),
      ai: entry('ai', ['server']),
      tooling: entry('tooling', ['build'], null),
    },
  }
})

import { PluginService } from '@/core/lib/services/plugin.service'

describe('PluginService catalog', () => {
  it('lists every enabled plugin, sorted, whatever it declares', () => {
    expect(PluginService.getCatalog().map((plugin) => [plugin.name, plugin.capabilities])).toEqual([
      ['ai', ['server']],
      ['amplitude', ['web']],
      ['langchain', ['server', 'web']],
      ['tooling', ['build']],
      ['walkme', ['web']],
    ])
  })

  it('keeps the executable registry to the server plugins', () => {
    expect(PluginService.getAll().map((plugin) => plugin.name)).toEqual(['langchain', 'ai'])
    expect(PluginService.get('walkme')).toBeUndefined()
    expect(PluginService.getEntry('amplitude')).toBeUndefined()
  })

  it('counts, names and existence cover the web-only plugins too', () => {
    expect(PluginService.getNames()).toEqual(['ai', 'amplitude', 'langchain', 'tooling', 'walkme'])
    expect(PluginService.getCount()).toBe(5)
    expect(PluginService.exists('walkme')).toBe(true)
    expect(PluginService.exists('amplitude')).toBe(true)
    expect(PluginService.exists('missing')).toBe(false)
  })

  it('finds one catalog entry by name', () => {
    expect(PluginService.getCatalogEntry('walkme')?.capabilities).toEqual(['web'])
    expect(PluginService.getCatalogEntry('missing')).toBeUndefined()
  })
})
