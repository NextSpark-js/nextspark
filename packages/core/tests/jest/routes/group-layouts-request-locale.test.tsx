/**
 * #390: with Cache Components, `i18n.requestLocale` turns the `(auth)` and `(public)` wrappers from the static messages of
 * the default locale to the request's, each group on its own; unset, or with a fixed locale, they stay static.
 */
import React from 'react'

let flags = { auth: false, public: false }
let i18n: Record<string, unknown> = {}
const getMessages = jest.fn(async () => ({}))

jest.mock('next/server', () => ({ connection: async () => undefined }))
jest.mock('next-intl/server', () => ({ getMessages: () => getMessages(), getLocale: async () => 'fr' }))
jest.mock('next-intl', () => ({ NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children }))
const selectMessages = jest.fn(() => ({}))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: (...args: unknown[]) => (selectMessages as (...a: unknown[]) => unknown)(...args), getConfiguredClientNamespaces: () => ({ superadmin: ['plugin-s'], dashboard: ['entity-d'], auth: ['project-a'], public: ['project-p'], devtools: [] }) }))
jest.mock('@nextsparkjs/core/providers/area-messages-check', () => ({ AreaMessagesCheck: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ get APP_CONFIG_MERGED() { return { i18n } } }))
jest.mock('@nextsparkjs/core/providers/static-intl-provider', () => ({ StaticIntlProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/registries/request-locale', () => ({
  get REQUEST_LOCALE_AUTH() { return flags.auth },
  get REQUEST_LOCALE_PUBLIC() { return flags.public },
}))

const MULTI = { supportedLocales: ['en', 'es', 'fr'], defaultLocale: 'en' }

type Wrapper = (layout: React.ComponentType<{ children: React.ReactNode }>) => (props: { children: React.ReactNode }) => unknown

function load() {
  let module: { withAuthMessages: Wrapper; withPublicMessages: Wrapper; withDevtoolsMessages: Wrapper; withDashboardMessages: Wrapper; withSuperadminMessages: Wrapper } | undefined
  jest.isolateModules(() => {
    module = require('../../../src/routes/_internal/group-layouts.cc')
  })
  return module!
}

/** Whether the wrapper reads the request's messages, and the `lang` it marks. */
async function render(wrapper: Wrapper) {
  getMessages.mockClear()
  const Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>
  let lang: string | undefined
  const walk = async (value: unknown): Promise<void> => {
    if (Array.isArray(value)) return void (await Promise.all(value.map(walk)))
    if (!React.isValidElement(value)) return
    const { type, props } = value as React.ReactElement<Record<string, unknown>>
    if (typeof type === 'string') {
      if (props.lang) lang = props.lang as string
      return walk(props.children)
    }
    if (typeof type === 'function') return walk(await (type as (props: unknown) => unknown)(props))
    return walk(props.children)
  }
  await walk(wrapper(Layout)({ children: 'page' }))
  return { requested: getMessages.mock.calls.length > 0, lang }
}

let warn: jest.SpyInstance
beforeEach(() => {
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
  flags = { auth: false, public: false }
  i18n = { ...MULTI }
})
afterEach(() => warn.mockRestore())

describe('extra namespaces of the wrappers (#414, #427)', () => {
  it('gives every request wrapper its area\'s configured namespaces: entities, roles and i18n.clientNamespaces', async () => {
    flags = { auth: true, public: true }
    i18n = { ...MULTI, requestLocale: { auth: true, public: true } }
    const layouts = load()
    const extraOf = async (wrapper: Wrapper) => {
      selectMessages.mockClear()
      await render(wrapper)
      return (selectMessages.mock.calls[0] as unknown[])[2]
    }
    expect(await extraOf(layouts.withDashboardMessages)).toEqual(['entity-d'])
    expect(await extraOf(layouts.withSuperadminMessages)).toEqual(['plugin-s'])
    expect(await extraOf(layouts.withAuthMessages)).toEqual(['project-a'])
    expect(await extraOf(layouts.withPublicMessages)).toEqual(['project-p'])
    expect(await extraOf(layouts.withDevtoolsMessages)).toEqual([])
  })

  it('filters the static messages of auth and public the same way, without reading the request', async () => {
    const layouts = load()
    for (const [wrapper, group, extra] of [[layouts.withAuthMessages, 'auth', ['project-a']], [layouts.withPublicMessages, 'public', ['project-p']]] as const) {
      selectMessages.mockClear()
      expect((await render(wrapper)).requested).toBe(false)
      expect((selectMessages.mock.calls[0] as unknown[]).slice(1)).toEqual([group, extra])
    }
  })
})

describe('devtools wrapper (#414)', () => {
  it('reads the request messages whatever the setting, so its client components follow the user language', async () => {
    const layouts = load()
    expect((await render(layouts.withDevtoolsMessages)).requested).toBe(true)
    flags = { auth: true, public: true }
    expect((await render(load().withDevtoolsMessages)).requested).toBe(true)
  })
})

describe('group wrappers with i18n.requestLocale', () => {
  it('keeps both groups static when the setting is off', async () => {
    const layouts = load()
    expect(await render(layouts.withAuthMessages)).toEqual({ requested: false, lang: undefined })
    expect(await render(layouts.withPublicMessages)).toEqual({ requested: false, lang: undefined })
  })

  it('turns only the auth group to the request, and marks its language', async () => {
    flags = { auth: true, public: false }
    i18n = { ...MULTI, requestLocale: { auth: true } }
    const layouts = load()
    expect(await render(layouts.withAuthMessages)).toEqual({ requested: true, lang: 'fr' })
    expect(await render(layouts.withPublicMessages)).toEqual({ requested: false, lang: undefined })
  })

  it('turns only the public group to the request', async () => {
    flags = { auth: false, public: true }
    i18n = { ...MULTI, requestLocale: { public: true } }
    const layouts = load()
    expect(await render(layouts.withAuthMessages)).toEqual({ requested: false, lang: undefined })
    expect(await render(layouts.withPublicMessages)).toEqual({ requested: true, lang: 'fr' })
  })

  it('has no effect when the locale is fixed, and says so', async () => {
    flags = { auth: true, public: true }
    i18n = { ...MULTI, detectionStrategy: ['default'], requestLocale: { auth: true, public: true } }
    const layouts = load()
    expect(await render(layouts.withAuthMessages)).toEqual({ requested: false, lang: undefined })
    expect(await render(layouts.withPublicMessages)).toEqual({ requested: false, lang: undefined })
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requestLocale.auth has no effect'))
  })

  it('warns when the merged config says true and the generated registry has false', () => {
    i18n = { ...MULTI, requestLocale: { public: true } }
    load()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requestLocale.public is true in the merged config'))
  })

  it('warns about a setting that is not an object, an unknown group and a value that is not a boolean', () => {
    i18n = { ...MULTI, requestLocale: true }
    load()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('i18n.requestLocale must be an object'))
  })

  it('warns about an unknown group and a value that is not a boolean', () => {
    i18n = { ...MULTI, requestLocale: { dashboard: true, auth: 'yes' } }
    load()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('unknown group "dashboard"'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('requestLocale.auth must be true or false'))
  })
})
