import type { Metadata } from 'next'
import { DefaultAuthLayout, defaultMetadata } from '../_internal/auth-layout'
import { withAuthMessages } from '../_internal/group-layouts.cc'

export const metadata: Metadata = defaultMetadata

export default withAuthMessages(DefaultAuthLayout)
