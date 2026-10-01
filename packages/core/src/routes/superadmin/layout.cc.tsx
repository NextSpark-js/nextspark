import type { Metadata } from 'next'
import { SuperadminLayout, defaultMetadata } from '../_internal/superadmin-layout'
import { withSuperadminAreaMessages } from '../_internal/superadmin-layout.cc'

export const metadata: Metadata = defaultMetadata

export default withSuperadminAreaMessages(SuperadminLayout)
