import type { Metadata } from 'next'
import { DefaultAuthLayout, defaultMetadata, withAuthMessages } from '../_internal/auth-layout'

export const metadata: Metadata = defaultMetadata

export default withAuthMessages(DefaultAuthLayout)
