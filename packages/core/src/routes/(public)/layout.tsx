import type { Metadata } from 'next'
import { DefaultPublicLayout, defaultMetadata, withPublicMessages } from '../_internal/public-layout'

export const metadata: Metadata = defaultMetadata

export default withPublicMessages(DefaultPublicLayout)
