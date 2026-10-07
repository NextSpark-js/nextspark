/**
 * The per-segment role check of /superadmin and /devtools for a host with `cacheComponents` on (the `access` of the
 * area layouts' variants in ../variants.json). Same rules and same check as `area-access`; only where it runs moves.
 *
 * `withSuperadminAccess(Page)` in `area-access` awaits the session before it returns the page, so the segment has no
 * Suspense boundary between it and request-time work: a navigation into it would wait, and the dev server reports it
 * ("Could not validate that a segment in your UI has instant navigation ... dropped segment"). Here the segment is a
 * Suspense boundary (fallback: nothing) around the check, and the page or layout renders inside it only once the
 * check has passed: no session -> /login, a session without the role -> /dashboard?error=access_denied, and the
 * segment's content is never rendered for either. What the prerendered shell holds of the segment is the empty
 * fallback.
 *
 * `generateMetadata` and Route Handlers keep the checks of `area-access` (nothing to prerender there).
 */
import { Suspense, type ComponentType } from 'react'
import { requireAreaAccess, type AccessArea } from './area-access'

export { withSuperadminMetadata, withDevtoolsMetadata, withSuperadminRouteAccess, withDevtoolsRouteAccess } from './area-access'

function withAreaAccess<P extends object>(area: AccessArea, Segment: ComponentType<P>) {
  async function AreaSegmentGate(props: P) {
    await requireAreaAccess(area)
    return <Segment {...props} />
  }
  return function AreaSegment(props: P) {
    return (
      <Suspense fallback={null}>
        <AreaSegmentGate {...props} />
      </Suspense>
    )
  }
}

/** A page or layout under /superadmin, rendered only for superadmin and developer sessions, inside its own boundary. */
export function withSuperadminAccess<P extends object>(Segment: ComponentType<P>) {
  return withAreaAccess('superadmin', Segment)
}

/** A page or layout under /devtools, rendered only for developer sessions, inside its own boundary. */
export function withDevtoolsAccess<P extends object>(Segment: ComponentType<P>) {
  return withAreaAccess('devtools', Segment)
}
