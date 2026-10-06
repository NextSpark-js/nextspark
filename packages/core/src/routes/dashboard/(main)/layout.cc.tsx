import { Suspense } from 'react'
import { MainDashboardShell, enforceEntityPermission } from '../../_internal/dashboard-main-shared'

/**
 * The main dashboard layout of a host with `cacheComponents` on (the variant in variants.json).
 *
 * The permission check reads the session and the database, which Next refuses in a layout outside Suspense: a
 * navigation into the segment would wait for it, and the dev server reports the route as not instant. Here the
 * shell (sidebar, navbar) renders at once and the check runs inside a boundary around the page: the page still
 * renders only once it has passed, and a denied request still ends at the permission-denied page.
 */
async function EntityPermission({ children }: { children: React.ReactNode }) {
  await enforceEntityPermission()
  return <>{children}</>
}

export default function MainDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <MainDashboardShell>
      <Suspense fallback={null}>
        <EntityPermission>{children}</EntityPermission>
      </Suspense>
    </MainDashboardShell>
  )
}
