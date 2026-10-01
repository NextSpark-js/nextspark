import type { Metadata } from 'next'
import { defaultMetadata } from '../_internal/public-layout'
import { DefaultPublicLayout } from '../_internal/default-public-layout'
import { withPublicMessages } from '../_internal/group-layouts.cc'

export const metadata: Metadata = defaultMetadata

export default withPublicMessages(DefaultPublicLayout)
