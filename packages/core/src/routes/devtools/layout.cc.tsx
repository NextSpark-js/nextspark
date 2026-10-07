import type { Metadata } from 'next'
import { DevLayout, defaultMetadata } from '../_internal/devtools-layout'
import { withDevtoolsAreaMessages } from '../_internal/devtools-layout.cc'

export const metadata: Metadata = defaultMetadata

/**
 * Core's layout behind the role check of `withDevtoolsAreaMessages`: its client guard renders the area while the
 * client session loads (`serverChecked`, see DeveloperGuard) instead of hiding it from the server render.
 */
function ServerCheckedDevLayout({ children }: { children: React.ReactNode }) {
  return <DevLayout serverChecked>{children}</DevLayout>
}

export default withDevtoolsAreaMessages(ServerCheckedDevLayout)
