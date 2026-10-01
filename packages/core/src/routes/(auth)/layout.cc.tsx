import type { Metadata } from 'next'
import { defaultMetadata } from '../_internal/auth-layout'
import { DefaultAuthLayout } from '../_internal/default-auth-layout'
import { withAuthMessages } from '../_internal/group-layouts.cc'

export const metadata: Metadata = defaultMetadata

export default withAuthMessages(DefaultAuthLayout)
