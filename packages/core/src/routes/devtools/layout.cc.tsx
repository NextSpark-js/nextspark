import type { Metadata } from 'next'
import { DevLayout, defaultMetadata } from '../_internal/devtools-layout'
import { withDevtoolsMessages } from '../_internal/group-layouts.cc'

export const metadata: Metadata = defaultMetadata

export default withDevtoolsMessages(DevLayout)
