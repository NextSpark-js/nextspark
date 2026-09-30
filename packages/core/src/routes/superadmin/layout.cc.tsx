import type { Metadata } from 'next'
import { SuperadminLayout, defaultMetadata } from '../_internal/superadmin-layout'
import { withSuperadminMessages } from '../_internal/group-layouts.cc'

export const metadata: Metadata = defaultMetadata

export default withSuperadminMessages(SuperadminLayout)
