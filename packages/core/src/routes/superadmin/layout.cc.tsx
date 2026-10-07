import type { Metadata } from 'next'
import { SuperadminLayout, defaultMetadata } from '../_internal/superadmin-layout'
import { withSuperadminAreaMessages } from '../_internal/superadmin-layout.cc'

export const metadata: Metadata = defaultMetadata

/**
 * Core's layout behind the role check of `withSuperadminAreaMessages`: its client guard renders the area while the
 * client session loads (`serverChecked`, see SuperAdminGuard) instead of hiding it from the server render.
 */
function ServerCheckedSuperadminLayout({ children }: { children: React.ReactNode }) {
  return <SuperadminLayout serverChecked>{children}</SuperadminLayout>
}

export default withSuperadminAreaMessages(ServerCheckedSuperadminLayout)
