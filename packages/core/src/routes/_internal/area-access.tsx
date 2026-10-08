/**
 * Server-side access to the /superadmin and /devtools areas.
 *
 * The role check must not depend on the project's proxy (a project may own one that never heard of
 * these areas) nor on the client guards (SuperAdminGuard / DeveloperGuard decide in the browser,
 * after the page has been served). And a layout cannot protect its pages on its own: Next renders
 * every segment of a route separately, so a page's RSC is in the response even when its layout
 * redirects. So the check runs in the group layout's message wrapper AND in every page and layout
 * under the area (the generated host composes them with `withSuperadminAccess` / `withDevtoolsAccess`,
 * see the manifest's `access`): the segment renders only after the check has passed. A segment's
 * `generateMetadata` is resolved apart from it too (a doc page's title), so the host wraps it with
 * `withSuperadminMetadata` / `withDevtoolsMetadata`, and a Route Handler's methods with
 * `withSuperadminRouteAccess` / `withDevtoolsRouteAccess` (a 401 or 403 JSON answer instead of a redirect); an `OPTIONS`
 * handler is forwarded unchecked (a CORS preflight carries no credentials) and must not return data.
 *
 * Not covered, by design: metadata files (icon, opengraph-image, sitemap, ...) under an area (prepare warns about
 * each one), `loading` / `error` / `not-found` (they must not render area data), and Server Actions (dispatched by
 * id, whatever page they are posted to: an action checks the role itself).
 *
 * Same rules as core's proxy template: no session -> /login?callbackUrl=..., a session without the
 * area's role -> /dashboard?error=access_denied. /superadmin lets in superadmin and developer,
 * /devtools only developer.
 *
 * Status: in a legacy ISR host the group wrapper runs before anything is sent, so a document request gets a 307 (an
 * RSC request, a 200 carrying Next's redirect). In a Cache Components host Next 16.3 prerenders a shell for every page
 * of the nodejs runtime (no segment config opts a page out; `dynamic` is refused) and sends it with a 200 before it
 * resumes the render, so the answer is a 200 whose redirect is client-side (a meta refresh in the document, Next's
 * redirect in the RSC payload) and nothing of the area is in the body. Only the proxy answers 307 there.
 */
import type { ComponentType, ReactNode } from 'react'
import { Suspense } from 'react'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getAuthorizationRequestSession } from '@nextsparkjs/core/lib/auth/request-session'

export type AccessArea = 'superadmin' | 'devtools'

const AREA_ROLES: Record<AccessArea, readonly string[]> = {
  superadmin: ['superadmin', 'developer'],
  devtools: ['developer'],
}

export function canEnterArea(area: AccessArea, role: string | null | undefined): boolean {
  return typeof role === 'string' && AREA_ROLES[area].includes(role)
}

/**
 * Where login sends the user back: the page they asked for when the proxy told us (`x-pathname`)
 * and it is in this area, else the area's home. A pass-through proxy sets no `x-pathname` and may
 * forward a forged one, so nothing outside the area is ever used.
 */
export function loginPathFor(area: AccessArea, pathname: string | null | undefined): string {
  const home = `/${area}`
  const back = pathname && (pathname === home || pathname.startsWith(`${home}/`)) && !pathname.includes('//') ? pathname : home
  return `/login?callbackUrl=${encodeURIComponent(back)}`
}

/** The verified session, from the database (one lookup per request), and the proxy's pathname hint. */
async function requestSession() {
  return { session: await getAuthorizationRequestSession(), pathname: (await headers()).get('x-pathname') }
}

/** Redirects unless the request's session may enter `area`. */
export async function requireAreaAccess(area: AccessArea): Promise<void> {
  const { session, pathname } = await requestSession()
  if (!session) redirect(loginPathFor(area, pathname))
  if (!canEnterArea(area, session.user?.role)) redirect('/dashboard?error=access_denied')
}

function withAreaAccess<P extends object>(area: AccessArea, Segment: ComponentType<P>) {
  return async function AreaSegment(props: P) {
    await requireAreaAccess(area)
    return <Segment {...props} />
  }
}

/** A page or layout under /superadmin, rendered only for superadmin and developer sessions. */
export function withSuperadminAccess<P extends object>(Segment: ComponentType<P>) {
  return withAreaAccess('superadmin', Segment)
}

/** A page or layout under /devtools, rendered only for developer sessions. */
export function withDevtoolsAccess<P extends object>(Segment: ComponentType<P>) {
  return withAreaAccess('devtools', Segment)
}

async function AreaGate({ area, children }: { area: AccessArea; children: ReactNode }) {
  await requireAreaAccess(area)
  return children
}

/**
 * The area's layout for a Cache Components host: rendered only after the check, inside its own Suspense boundary (a
 * request read outside one fails the prerender), so neither the layout nor the pages under it are part of the
 * prerendered shell. The group's message wrapper goes around it (`superadmin-layout.cc`, `devtools-layout.cc`).
 */
export function withAreaGate<P extends { children: ReactNode }>(area: AccessArea, Layout: ComponentType<P>) {
  return function GatedAreaLayout(props: P) {
    return (
      <Suspense fallback={null}>
        <AreaGate area={area}>
          <Layout {...props} />
        </AreaGate>
      </Suspense>
    )
  }
}

/** The JSON refusal a Route Handler under `area` answers with, or null when the session may enter. */
async function areaRouteRefusal(area: AccessArea): Promise<Response | null> {
  const { session } = await requestSession()
  if (!session) {
    return Response.json({ success: false, error: { message: 'Authentication required', code: 'AREA_UNAUTHORIZED' } }, { status: 401 })
  }
  if (!canEnterArea(area, session.user?.role)) {
    return Response.json(
      { success: false, error: { message: `Access denied: /${area} requires the ${AREA_ROLES[area].join(' or ')} role`, code: 'AREA_ACCESS_DENIED' } },
      { status: 403 }
    )
  }
  return null
}

function withAreaRoute<A extends unknown[], R>(area: AccessArea, handler: (...args: A) => R) {
  return async function areaRoute(...args: A): Promise<Awaited<R> | Response> {
    return (await areaRouteRefusal(area)) ?? (await handler(...args))
  }
}

/** A Route Handler method under /superadmin: superadmin and developer sessions only, else 401 / 403 JSON. */
export function withSuperadminRouteAccess<A extends unknown[], R>(handler: (...args: A) => R) {
  return withAreaRoute('superadmin', handler)
}

/** A Route Handler method under /devtools: developer sessions only, else 401 / 403 JSON. */
export function withDevtoolsRouteAccess<A extends unknown[], R>(handler: (...args: A) => R) {
  return withAreaRoute('devtools', handler)
}

function withAreaMetadata<A extends unknown[], R>(area: AccessArea, generateMetadata: (...args: A) => R) {
  return async function areaMetadata(...args: A): Promise<Awaited<R>> {
    await requireAreaAccess(area)
    return await generateMetadata(...args)
  }
}

/** The `generateMetadata` of a page or layout under /superadmin, resolved only for superadmin and developer sessions. */
export function withSuperadminMetadata<A extends unknown[], R>(generateMetadata: (...args: A) => R) {
  return withAreaMetadata('superadmin', generateMetadata)
}

/** The `generateMetadata` of a page or layout under /devtools, resolved only for developer sessions. */
export function withDevtoolsMetadata<A extends unknown[], R>(generateMetadata: (...args: A) => R) {
  return withAreaMetadata('devtools', generateMetadata)
}
