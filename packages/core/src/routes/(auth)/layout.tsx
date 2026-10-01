import type { Metadata } from 'next'
import { defaultMetadata, withAuthMessages } from '../_internal/auth-layout'
import { DefaultAuthLayout } from '../_internal/default-auth-layout'

export const metadata: Metadata = defaultMetadata

export default withAuthMessages(DefaultAuthLayout)
