import type { Metadata } from 'next'
import { ServerCheckedDevLayout, defaultMetadata } from '../_internal/devtools-layout'
import { withDevtoolsAreaMessages } from '../_internal/devtools-layout.cc'

export const metadata: Metadata = defaultMetadata

export default withDevtoolsAreaMessages(ServerCheckedDevLayout)
