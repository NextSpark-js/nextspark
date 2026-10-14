/**
 * #228: core composes a project's layouts into its own (the root layout and the group layouts). Each wrapper hands every
 * prop to the project's layout, not only `children`, so a parallel route slot it declares (`@modal` -> `modal`) arrives.
 *
 * The wrappers are expanded to the element of the project's layout, and its props are read.
 */
import React from 'react'

const getTypedSession = jest.fn()
let requestHeaders = new Headers()

jest.mock('next/navigation', () => ({ redirect: (url: string) => { throw new Error(`NEXT_REDIRECT:${url}`) }, useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/headers', () => ({ headers: async () => requestHeaders }))
jest.mock('next/server', () => ({ connection: async () => undefined }))
jest.mock('@nextsparkjs/core/lib/auth', () => ({
  getTypedSession: (h: Headers) => getTypedSession(h),
  auth: { api: { getSession: ({ headers }: { headers: Headers }) => getTypedSession(headers) } },
}))
jest.mock('next-intl/server', () => ({ getMessages: async () => ({}) }))
jest.mock('next-intl', () => ({ NextIntlClientProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/lib/i18n/client-messages', () => ({ selectMessages: () => ({}), getConfiguredClientNamespaces: () => ({ superadmin: [], dashboard: [] }) }))
jest.mock('@nextsparkjs/core/lib/config/config-client', () => ({ APP_CONFIG_MERGED: {} }))
jest.mock('@nextsparkjs/core/components/app/guards/SuperAdminGuard', () => ({ SuperAdminGuard: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/components/app/guards/DeveloperGuard', () => ({ DeveloperGuard: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/providers/DashboardProviders', () => ({ DashboardProviders: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('@nextsparkjs/core/components/superadmin/layouts/SuperadminSidebar', () => ({ SuperadminSidebar: () => null }))
jest.mock('@nextsparkjs/core/components/devtools/DevtoolsSidebar', () => ({ DevtoolsSidebar: () => null }))
jest.mock('@nextsparkjs/core/components/devtools/DevtoolsMobileHeader', () => ({ DevtoolsMobileHeader: () => null }))
jest.mock('@nextsparkjs/core/lib/plugins/nav-items', () => ({ getAllPluginNavItems: () => [] }))
jest.mock('@nextsparkjs/core/providers/static-intl-provider', () => ({ StaticIntlProvider: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('../../../src/routes/layout', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }))
jest.mock('../../../src/routes/layout.ppr', () => ({ __esModule: true, default: ({ children }: { children: React.ReactNode }) => children }))

import { withRootLayout } from '../../../src/routes/_internal/root-layout'
import { withRootLayout as withRootLayoutPpr } from '../../../src/routes/_internal/root-layout.ppr'
import { withAuthMessages } from '../../../src/routes/_internal/auth-layout'
import { withPublicMessages } from '../../../src/routes/_internal/public-layout'
import { withSuperadminGuard } from '../../../src/routes/_internal/superadmin-layout'
import { withDevtoolsGuard } from '../../../src/routes/_internal/devtools-layout'
import * as cc from '../../../src/routes/_internal/group-layouts.cc'
import { withSuperadminGuard as withSuperadminGuardCc } from '../../../src/routes/_internal/superadmin-layout.cc'
import { withDevtoolsGuard as withDevtoolsGuardCc } from '../../../src/routes/_internal/devtools-layout.cc'

type Slots = { children: React.ReactNode; modal: React.ReactNode; params?: Promise<{ id: string }> }

/** The project's layout: renders its children and the slot it declares. */
function ProjectLayout({ children, modal }: Slots) {
  return <>{children}<aside>{modal}</aside></>
}

/** Expand `node` (calling the components, awaiting the async ones) down to the element of `target`; its props. */
async function propsOf(node: unknown, target: unknown): Promise<Record<string, unknown> | null> {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = await propsOf(child, target)
      if (found) return found
    }
    return null
  }
  if (!React.isValidElement(node)) return null
  const { type, props } = node as React.ReactElement<Record<string, unknown>>
  if (type === target) return props
  if (typeof type === 'function') return propsOf(await (type as (props: unknown) => unknown)(props), target)
  return propsOf(props.children, target)
}

const props = (): Slots => ({ children: 'page', modal: 'slot-content', params: Promise.resolve({ id: '1' }) })

const SESSION = { session: { id: 's' }, user: { id: 'u', role: 'developer' } }

beforeEach(() => {
  requestHeaders = new Headers()
  getTypedSession.mockResolvedValue(SESSION)
})

// every wrapper: [name, wrapper]
const WRAPPERS: [string, (layout: React.ComponentType<Slots>) => (props: Slots) => unknown][] = [
  ['withRootLayout (ISR)', withRootLayout],
  ['withRootLayout (Cache Components)', withRootLayoutPpr],
  ['withAuthMessages (ISR)', withAuthMessages],
  ['withPublicMessages (ISR)', withPublicMessages],
  ['withSuperadminGuard (ISR)', withSuperadminGuard],
  ['withDevtoolsGuard (ISR)', withDevtoolsGuard],
  ['withAuthMessages (Cache Components)', cc.withAuthMessages],
  ['withPublicMessages (Cache Components)', cc.withPublicMessages],
  ['withDevtoolsMessages (Cache Components)', cc.withDevtoolsMessages],
  ['withSuperadminMessages (Cache Components)', cc.withSuperadminMessages],
  ['withDashboardMessages (Cache Components)', cc.withDashboardMessages],
  ['withSuperadminGuard (Cache Components)', withSuperadminGuardCc],
  ['withDevtoolsGuard (Cache Components)', withDevtoolsGuardCc],
]

describe('core layouts hand every prop to a project layout, parallel route slots included', () => {
  it.each(WRAPPERS)('%s', async (_name, wrapper) => {
    const Composed = wrapper(ProjectLayout) as unknown as (props: Slots) => unknown
    const given = props()
    const received = await propsOf(await Composed(given), ProjectLayout)

    expect(received).not.toBeNull()
    expect(received?.modal).toBe('slot-content')
    expect(received?.params).toBe(given.params)
    expect(received?.children).toBeDefined()
  })

  it('a layout that declares no slot still gets its children', async () => {
    const Plain = ({ children }: { children: React.ReactNode }) => <main>{children}</main>
    const received = await propsOf(await (withRootLayout(Plain) as (p: { children: React.ReactNode }) => unknown)({ children: 'page' }), Plain)

    expect(received).toEqual({ children: 'page' })
  })
})
