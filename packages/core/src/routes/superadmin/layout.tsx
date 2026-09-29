import type { Metadata } from 'next'
import { SuperadminLayout, defaultMetadata, withSuperadminMessages } from '../_internal/superadmin-layout'

export const metadata: Metadata = defaultMetadata

export default withSuperadminMessages(SuperadminLayout)
