/**
 * ROOT_PROVIDERS follows the generated registry's scope (#341), and in development a merged config that says otherwise warns.
 */
let mockOverrides: Record<string, unknown> = {}
let mockScope: 'root' | 'groups' = 'root'
jest.mock('@nextsparkjs/registries/app-config.client', () => ({ get APP_CONFIG_OVERRIDES() { return mockOverrides } }))
jest.mock('@nextsparkjs/registries/providers-scope', () => ({ get PROVIDERS_SCOPE() { return mockScope } }))

function load() {
  let module: typeof import('@/core/lib/config/public-config-client') | undefined
  jest.isolateModules(() => {
    module = require('@/core/lib/config/public-config-client')
  })
  return module!
}

let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  mockOverrides = {}
  mockScope = 'root'
})
afterEach(() => warn.mockRestore())

describe('public-config-client providers scope', () => {
  it('takes ROOT_PROVIDERS from the generated scope, without a warning when the merged config agrees', () => {
    mockScope = 'groups'
    mockOverrides = { providers: { scope: 'groups' } }
    expect(load().ROOT_PROVIDERS).toBe(false)
    mockScope = 'root'
    mockOverrides = {}
    expect(load().ROOT_PROVIDERS).toBe(true)
    expect(warn).not.toHaveBeenCalled()
  })

  it('warns when the merged config says groups and the registry has root (a scope the generator could not read)', () => {
    mockOverrides = { providers: { scope: 'groups' } }
    expect(load().ROOT_PROVIDERS).toBe(true)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining("providers.scope is 'groups'"))
  })
})
