import type { Metadata } from 'next'
import { defaultMetadata, withPublicMessages } from '../_internal/public-layout'
import { DefaultPublicLayout } from '../_internal/default-public-layout'

export const metadata: Metadata = defaultMetadata

export default withPublicMessages(DefaultPublicLayout)
