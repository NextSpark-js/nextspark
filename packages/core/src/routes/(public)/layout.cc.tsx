import type { Metadata } from 'next'
import { DefaultPublicLayout, defaultMetadata } from '../_internal/public-layout'
import { withPublicMessages } from '../_internal/group-layouts.cc'

export const metadata: Metadata = defaultMetadata

export default withPublicMessages(DefaultPublicLayout)
