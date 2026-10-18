/**
 * @jest-environment node
 *
 * PluginService.initializeAll() on the server: there is no window here, so the onLoad hooks run. The jsdom suite
 * (plugin.service.test.ts) only reaches the client-side early return, because jsdom 26 does not let a test hide window.
 */
type Hooks = { onLoad?: jest.Mock }

const FLAG = '__nextspark_plugins_initialized'
const flags = globalThis as unknown as Record<string, boolean | undefined>

function load(plugins: Record<string, Hooks | undefined>) {
  const PLUGIN_REGISTRY = Object.fromEntries(
    Object.entries(plugins).map(([name, hooks]) => [name, { name, config: { name, hooks } }])
  )
  let service: typeof import('@/core/lib/services/plugin.service')
  jest.isolateModules(() => {
    jest.doMock('@/core/lib/registries/plugin-registry', () => ({ PLUGIN_REGISTRY }))
    service = require('@/core/lib/services/plugin.service')
  })
  return service!.PluginService
}

let errorSpy: jest.SpyInstance

beforeEach(() => {
  delete flags[FLAG]
  jest.resetModules()
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  delete flags[FLAG]
  jest.dontMock('@/core/lib/registries/plugin-registry')
  jest.restoreAllMocks()
})

describe('PluginService.initializeAll() without a window', () => {
  it('has no window, and runs each plugin onLoad once', async () => {
    expect(typeof window).toBe('undefined')
    const a = jest.fn().mockResolvedValue(undefined)
    const b = jest.fn().mockResolvedValue(undefined)
    const service = load({ a: { onLoad: a }, b: { onLoad: b }, none: undefined })

    await service.initializeAll()

    expect(a).toHaveBeenCalledTimes(1)
    expect(b).toHaveBeenCalledTimes(1)
    expect(flags[FLAG]).toBe(true)
  })

  it('skips a second call: the init-once flag is set', async () => {
    const a = jest.fn().mockResolvedValue(undefined)
    const service = load({ a: { onLoad: a } })

    await service.initializeAll()
    await service.initializeAll()

    expect(a).toHaveBeenCalledTimes(1)
  })

  it('keeps going when one onLoad rejects, and logs the error', async () => {
    const first = jest.fn().mockResolvedValue(undefined)
    const failing = jest.fn().mockRejectedValue(new Error('Load failed'))
    const last = jest.fn().mockResolvedValue(undefined)
    const service = load({ first: { onLoad: first }, failing: { onLoad: failing }, last: { onLoad: last } })

    await expect(service.initializeAll()).resolves.toBeUndefined()

    expect(first).toHaveBeenCalledTimes(1)
    expect(failing).toHaveBeenCalledTimes(1)
    expect(last).toHaveBeenCalledTimes(1)
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('Error loading plugin failing'), expect.any(Error))
    expect(flags[FLAG]).toBe(true)
  })
})
