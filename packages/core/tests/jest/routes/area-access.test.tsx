/**
 * Server-side access to /superadmin and /devtools (#203, S21): the role check runs on the server whatever the
 * project's proxy does, in the group layout's message wrapper (both rendering modes) and in every page and layout
 * under the area (`withSuperadminAccess` / `withDevtoolsAccess`). Nothing of the area renders before it passes.
 * Same rules as core's proxy template.
 */
import React from 'react'

const redirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const getTypedSession = jest.fn()
const getMessages = jest.fn(async () => ({}))
let requestHeaders = new Headers()

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url), useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next/headers', () => ({ headers: async () => requestHeaders }))
jest.mock('@nextsparkjs/core/lib/auth', () => ({ getTypedSession: (h: Headers) => getTypedSession(h) }))
jest.mock('next-intl/server', () => ({ getMessages: () => getMessages() }))
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

import {
  canEnterArea,
  loginPathFor,
  requireAreaAccess,
  withDevtoolsAccess,
  withDevtoolsMetadata,
  withDevtoolsRouteAccess,
  withSuperadminAccess,
  withSuperadminMetadata,
  withSuperadminRouteAccess,
  type AccessArea,
} from '../../../src/routes/_internal/area-access'
import { withSuperadminMessages } from '../../../src/routes/_internal/superadmin-layout'
import { withDevtoolsMessages } from '../../../src/routes/_internal/devtools-layout'
import * as cc from '../../../src/routes/_internal/group-layouts.cc'
import * as superadminCc from '../../../src/routes/_internal/superadmin-layout.cc'
import * as devtoolsCc from '../../../src/routes/_internal/devtools-layout.cc'
import * as accessCc from '../../../src/routes/_internal/area-access.cc'
import * as superadminIsr from '../../../src/routes/_internal/superadmin-layout'
import * as devtoolsIsr from '../../../src/routes/_internal/devtools-layout'
import SuperadminLayoutCc from '../../../src/routes/superadmin/layout.cc'
import DevtoolsLayoutCc from '../../../src/routes/devtools/layout.cc'

const session = (role: string) => ({ session: { id: 's' }, user: { id: 'u', role } })
const LOGIN = (path: string) => `NEXT_REDIRECT:/login?callbackUrl=${encodeURIComponent(path)}`
const DENIED = 'NEXT_REDIRECT:/dashboard?error=access_denied'

beforeEach(() => {
  redirect.mockClear()
  getTypedSession.mockReset()
  getMessages.mockClear()
  requestHeaders = new Headers()
})

describe("the rules of core's proxy template", () => {
  it.each<[AccessArea, string, boolean]>([
    ['superadmin', 'superadmin', true],
    ['superadmin', 'developer', true],
    ['superadmin', 'member', false],
    ['superadmin', 'admin', false],
    ['devtools', 'developer', true],
    ['devtools', 'superadmin', false],
    ['devtools', 'member', false],
  ])('%s with role %s: %s', (area, role, allowed) => {
    expect(canEnterArea(area, role)).toBe(allowed)
  })

  it('no role enters no area', () => {
    expect(canEnterArea('superadmin', undefined)).toBe(false)
    expect(canEnterArea('devtools', null)).toBe(false)
  })

  it('login returns to the page asked for only when it is in the area; anything else goes back to the area home', () => {
    expect(loginPathFor('superadmin', '/superadmin/docs/setup/configuration')).toBe('/login?callbackUrl=%2Fsuperadmin%2Fdocs%2Fsetup%2Fconfiguration')
    expect(loginPathFor('devtools', '/devtools')).toBe('/login?callbackUrl=%2Fdevtools')
    expect(loginPathFor('superadmin', null)).toBe('/login?callbackUrl=%2Fsuperadmin')
    expect(loginPathFor('superadmin', '/superadmin-evil')).toBe('/login?callbackUrl=%2Fsuperadmin')
    expect(loginPathFor('superadmin', 'https://evil.example/superadmin')).toBe('/login?callbackUrl=%2Fsuperadmin')
    expect(loginPathFor('devtools', '/devtools//evil.example')).toBe('/login?callbackUrl=%2Fdevtools')
  })
})

describe('requireAreaAccess', () => {
  it('sends a request without a session to login, with the page it asked for', async () => {
    getTypedSession.mockResolvedValue(null)
    requestHeaders = new Headers({ 'x-pathname': '/devtools/api' })
    await expect(requireAreaAccess('devtools')).rejects.toThrow(LOGIN('/devtools/api'))
    expect(getTypedSession).toHaveBeenCalledWith(requestHeaders)
  })

  it('sends a session without the role to the dashboard', async () => {
    getTypedSession.mockResolvedValue(session('member'))
    await expect(requireAreaAccess('superadmin')).rejects.toThrow(DENIED)
    getTypedSession.mockResolvedValue(session('superadmin'))
    await expect(requireAreaAccess('devtools')).rejects.toThrow(DENIED)
  })

  it('lets the roles of the area in', async () => {
    getTypedSession.mockResolvedValue(session('developer'))
    await expect(requireAreaAccess('superadmin')).resolves.toBeUndefined()
    await expect(requireAreaAccess('devtools')).resolves.toBeUndefined()
    expect(redirect).not.toHaveBeenCalled()
  })
})

describe('withSuperadminAccess / withDevtoolsAccess (every page and layout under the area)', () => {
  const Segment = jest.fn((_props: { params: Promise<{ x: string }> }) => null)
  const params = Promise.resolve({ x: '1' })

  beforeEach(() => Segment.mockClear())

  it.each([
    ['superadmin', 'no', withSuperadminAccess, null, LOGIN('/superadmin')],
    ['superadmin', 'a member', withSuperadminAccess, 'member', DENIED],
    ['devtools', 'a superadmin', withDevtoolsAccess, 'superadmin', DENIED],
  ] as const)('%s, %s session: redirects before the segment is rendered', async (_area, _label, wrap, role, thrown) => {
    getTypedSession.mockResolvedValue(role ? session(role) : null)
    const Guarded = wrap(Segment) as unknown as (props: { params: typeof params }) => Promise<React.ReactElement>
    await expect(Guarded({ params })).rejects.toThrow(thrown)
    expect(Segment).not.toHaveBeenCalled()
  })

  it('renders the segment with its props once the check passes', async () => {
    getTypedSession.mockResolvedValue(session('developer'))
    const Guarded = withDevtoolsAccess(Segment) as unknown as (props: { params: typeof params }) => Promise<React.ReactElement<{ params: typeof params }>>
    const element = await Guarded({ params })
    expect(element.type).toBe(Segment)
    expect(element.props.params).toBe(params)
  })
})

describe('withSuperadminMetadata / withDevtoolsMetadata (the generateMetadata of a segment under the area)', () => {
  const generateMetadata = jest.fn(async ({ params }: { params: Promise<{ page: string }> }) => ({ title: `${(await params).page} | Admin Docs` }))
  const params = Promise.resolve({ page: 'Configuration' })

  beforeEach(() => generateMetadata.mockClear())

  it('resolves nothing for a session without the role', async () => {
    getTypedSession.mockResolvedValue(null)
    await expect(withSuperadminMetadata(generateMetadata)({ params })).rejects.toThrow(LOGIN('/superadmin'))
    getTypedSession.mockResolvedValue(session('superadmin'))
    await expect(withDevtoolsMetadata(generateMetadata)({ params })).rejects.toThrow(DENIED)
    expect(generateMetadata).not.toHaveBeenCalled()
  })

  it("returns the segment's metadata for a role of the area", async () => {
    getTypedSession.mockResolvedValue(session('developer'))
    await expect(withSuperadminMetadata(generateMetadata)({ params })).resolves.toEqual({ title: 'Configuration | Admin Docs' })
  })
})

describe('withSuperadminRouteAccess / withDevtoolsRouteAccess (a Route Handler method under the area)', () => {
  const handler = jest.fn(async (_request: Request) => Response.json({ secret: true }))
  const request = new Request('http://localhost/devtools/export')

  beforeEach(() => handler.mockClear())

  it('answers 401 JSON without a session and 403 JSON without the role, never calling the handler or redirecting', async () => {
    getTypedSession.mockResolvedValue(null)
    const anonymous = await withDevtoolsRouteAccess(handler)(request)
    expect(anonymous.status).toBe(401)
    expect(await anonymous.json()).toMatchObject({ success: false, error: { code: 'AREA_UNAUTHORIZED' } })
    getTypedSession.mockResolvedValue(session('superadmin'))
    const superadmin = await withDevtoolsRouteAccess(handler)(request)
    expect(superadmin.status).toBe(403)
    expect(await superadmin.json()).toMatchObject({ error: { code: 'AREA_ACCESS_DENIED' } })
    getTypedSession.mockResolvedValue(session('member'))
    expect((await withSuperadminRouteAccess(handler)(request)).status).toBe(403)
    expect(handler).not.toHaveBeenCalled()
    expect(redirect).not.toHaveBeenCalled()
  })

  it("returns the handler's own response for a role of the area, with the arguments it got", async () => {
    getTypedSession.mockResolvedValue(session('superadmin'))
    const response = await withSuperadminRouteAccess(handler)(request)
    expect(await response.json()).toEqual({ secret: true })
    expect(handler).toHaveBeenCalledWith(request)
  })
})

describe('the group message wrappers of the legacy ISR host check before anything renders (a 307 on a page load)', () => {
  const Layout = jest.fn(({ children }: { children: React.ReactNode }) => <>{children}</>)

  it.each([
    ['superadmin', 'no', withSuperadminMessages, null, LOGIN('/superadmin')],
    ['superadmin', 'a member', withSuperadminMessages, 'member', DENIED],
    ['devtools', 'a superadmin', withDevtoolsMessages, 'superadmin', DENIED],
  ] as const)('%s, %s session: redirects, without loading messages or rendering the layout', async (_area, _label, wrap, role, thrown) => {
    getTypedSession.mockResolvedValue(role ? session(role) : null)
    const Wrapped = wrap(Layout) as unknown as (props: { children: React.ReactNode }) => Promise<React.ReactElement>
    await expect(Wrapped({ children: 'secret' })).rejects.toThrow(thrown)
    expect(getMessages).not.toHaveBeenCalled()
  })

  it('renders the layout for a role of the area', async () => {
    getTypedSession.mockResolvedValue(session('superadmin'))
    const Wrapped = withSuperadminMessages(Layout) as unknown as (props: { children: React.ReactNode }) => Promise<React.ReactElement>
    await expect(Wrapped({ children: 'ok' })).resolves.toBeTruthy()
    expect(getMessages).toHaveBeenCalledTimes(1)
  })
})

/** The elements of a tree whose type is the named function component. */
function findByName(node: React.ReactNode, name: string): React.ReactElement[] {
  if (!React.isValidElement(node)) return []
  const element = node as React.ReactElement<{ children?: React.ReactNode }>
  const own = typeof element.type === 'function' && element.type.name === name ? [element] : []
  return [...own, ...React.Children.toArray(element.props.children).flatMap(child => findByName(child, name))]
}

describe('the Cache Components modules of the two areas check inside their own Suspense boundary', () => {
  const Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>
  type Renders = (props: { children: React.ReactNode }) => React.ReactElement

  it.each([
    ['superadmin', superadminCc.withSuperadminAreaMessages, superadminCc.withSuperadminGuard],
    ['devtools', devtoolsCc.withDevtoolsAreaMessages, devtoolsCc.withDevtoolsGuard],
  ] as const)('%s: the default layout and a composed override render only behind the role check', async (area, areaMessages, guard) => {
    for (const wrap of [areaMessages, guard]) {
      const tree = (wrap(Layout) as unknown as Renders)({ children: 'secret' })
      const [gated] = findByName(tree, 'GatedAreaLayout')
      expect(gated).toBeDefined()
      const suspense = (gated.type as Renders)(gated.props as { children: React.ReactNode })
      expect(suspense.type).toBe(React.Suspense)
      const [gate] = findByName(suspense, 'AreaGate') as Array<React.ReactElement<{ area: string; children: React.ReactNode }>>
      expect(gate.props.area).toBe(area)
      const gateType = gate.type as (props: { area: string; children: React.ReactNode }) => Promise<React.ReactNode>
      getTypedSession.mockResolvedValue(null)
      await expect(gateType(gate.props)).rejects.toThrow(LOGIN(`/${area}`))
      getTypedSession.mockResolvedValue(session('developer'))
      await expect(gateType(gate.props)).resolves.toBe(gate.props.children)
    }
  })

  it('the shared message module (imported by public and auth layouts) carries no area check', () => {
    for (const wrap of [cc.withPublicMessages, cc.withAuthMessages, cc.withSuperadminMessages, cc.withDevtoolsMessages]) {
      const tree = (wrap(Layout) as unknown as Renders)({ children: 'x' })
      expect(findByName(tree, 'GatedAreaLayout')).toEqual([])
    }
  })
})

/**
 * #213: in a Cache Components host every page and layout under an area is composed with area-access.cc. The check is
 * the same; it runs inside the segment's own Suspense boundary, so a navigation into the segment is instant and the
 * dev server stops reporting it. The segment still renders only once the check has passed.
 */
describe('area-access.cc (every page and layout under an area, Cache Components host)', () => {
  const Segment = jest.fn((_props: { params: Promise<{ x: string }> }) => null)
  const params = Promise.resolve({ x: '1' })
  type Gate = (props: { params: typeof params }) => Promise<React.ReactElement<{ params: typeof params }>>

  beforeEach(() => Segment.mockClear())

  /** The segment's element: a Suspense boundary (no fallback content) whose only child is the gate. */
  function gateOf(wrap: typeof accessCc.withSuperadminAccess) {
    const element = (wrap(Segment) as unknown as (props: { params: typeof params }) => React.ReactElement<{ fallback: unknown; children: React.ReactElement }>)({ params })
    expect(element.type).toBe(React.Suspense)
    expect(element.props.fallback).toBeNull()
    const gate = element.props.children as React.ReactElement<{ params: typeof params }>
    expect(gate.props.params).toBe(params)
    return { run: () => (gate.type as Gate)(gate.props) }
  }

  it.each([
    ['superadmin', 'no', accessCc.withSuperadminAccess, null, LOGIN('/superadmin')],
    ['superadmin', 'a member', accessCc.withSuperadminAccess, 'member', DENIED],
    ['devtools', 'no', accessCc.withDevtoolsAccess, null, LOGIN('/devtools')],
    ['devtools', 'a superadmin', accessCc.withDevtoolsAccess, 'superadmin', DENIED],
  ] as const)('%s, %s session: the boundary redirects before the segment is rendered', async (_area, _label, wrap, role, thrown) => {
    getTypedSession.mockResolvedValue(role ? session(role) : null)
    await expect(gateOf(wrap).run()).rejects.toThrow(thrown)
    expect(Segment).not.toHaveBeenCalled()
  })

  it('renders the segment with its props inside the boundary once the check passes', async () => {
    getTypedSession.mockResolvedValue(session('developer'))
    for (const wrap of [accessCc.withSuperadminAccess, accessCc.withDevtoolsAccess]) {
      const element = await gateOf(wrap).run()
      expect(element.type).toBe(Segment)
      expect(element.props.params).toBe(params)
    }
  })

  it("metadata and Route Handlers keep area-access's own checks", () => {
    expect(accessCc.withSuperadminMetadata).toBe(withSuperadminMetadata)
    expect(accessCc.withDevtoolsMetadata).toBe(withDevtoolsMetadata)
    expect(accessCc.withSuperadminRouteAccess).toBe(withSuperadminRouteAccess)
    expect(accessCc.withDevtoolsRouteAccess).toBe(withDevtoolsRouteAccess)
  })
})

/**
 * Every element of a tree, rendering the function components that are not async (what the server would render);
 * `stopAt` names a component whose subtree is left out.
 */
function expand(node: React.ReactNode, stopAt?: string, depth = 0): React.ReactElement[] {
  if (!React.isValidElement(node) || depth > 20) return []
  const element = node as React.ReactElement<{ children?: React.ReactNode }>
  if (stopAt && typeof element.type === 'function' && element.type.name === stopAt) return [element]
  const inner =
    typeof element.type === 'function' && element.type.constructor.name !== 'AsyncFunction' && !/Guard$|Providers$|Sidebar|Header$/.test(element.type.name)
      ? expand((element.type as (props: unknown) => React.ReactNode)(element.props), stopAt, depth + 1)
      : React.Children.toArray(element.props.children).flatMap(child => expand(child, stopAt, depth + 1))
  return [element, ...inner]
}

describe("the area guards are told the server checked the role only behind that check (#213)", () => {
  const Layout = ({ children }: { children: React.ReactNode }) => <>{children}</>
  const guardProps = (tree: React.ReactNode, guard: string, stopAt?: string) =>
    expand(tree, stopAt).filter(element => typeof element.type === 'function' && element.type.name === guard).map(element => (element.props as { serverChecked?: boolean }).serverChecked)

  it.each([
    ['superadmin', 'SuperAdminGuard', superadminCc.withSuperadminGuard, superadminIsr.withSuperadminGuard, SuperadminLayoutCc],
    ['devtools', 'DeveloperGuard', devtoolsCc.withDevtoolsGuard, devtoolsIsr.withDevtoolsGuard, DevtoolsLayoutCc],
  ] as const)('%s: Cache Components layouts pass serverChecked inside the gate; the ISR composition does not', async (_area, guard, ccGuard, isrGuard, ccLayout) => {
    // Cache Components: core's layout and a composed override, behind the gate (the gate itself is async: open it)
    for (const tree of [(ccGuard(Layout) as unknown as (p: { children: React.ReactNode }) => React.ReactElement)({ children: 'x' }), (ccLayout as unknown as (p: { children: React.ReactNode }) => React.ReactElement)({ children: 'x' })]) {
      const [gate] = expand(tree).filter(element => typeof element.type === 'function' && element.type.name === 'AreaGate') as Array<React.ReactElement<{ children: React.ReactNode }>>
      expect(gate).toBeDefined()
      expect(guardProps(tree, guard, 'AreaGate')).toEqual([]) // nothing of the guard outside the gate
      expect(guardProps(gate.props.children, guard)).toEqual([true])
    }
    // ISR: the composition's guard keeps its loading state on the server (the message wrapper is async: render the layout it wraps)
    getTypedSession.mockResolvedValue(session('developer'))
    const isr = await (isrGuard(Layout) as unknown as (p: { children: React.ReactNode }) => Promise<React.ReactElement>)({ children: 'x' })
    expect(guardProps(isr, guard)).toEqual([false])
  })
})
