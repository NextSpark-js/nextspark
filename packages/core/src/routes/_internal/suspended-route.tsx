import { Suspense, type ReactNode } from 'react'

/**
 * A route component behind its own Suspense boundary, for a host with `cacheComponents` on.
 *
 * A page that awaits `params` (or `searchParams`), redirects or answers notFound() is request-time work. The
 * layouts of the Cache Components host already stream the page after their shell, but Next.js's instant-navigation
 * check (the dev server runs it on every page, and logs "Could not validate ..." when it fails) wants a boundary
 * between the segment it validates and that work, so a navigation to the segment finishes at once and the page
 * streams in. The status a visitor gets is the one the host already gives: a redirect or a 404 thrown after the
 * shell is sent reaches the browser as a 200 with a redirect or a not-found page.
 *
 * Only the Cache Components modules (`*.cc`) use it. An ISR host's pages are rendered before anything is sent, and
 * keep a real 307 and 404.
 */
export function behindSuspense<Props extends object>(Route: (props: Props) => ReactNode | Promise<ReactNode>) {
  return function RouteBehindSuspense(props: Props) {
    return (
      <Suspense fallback={null}>
        <Route {...props} />
      </Suspense>
    )
  }
}
