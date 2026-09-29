import type { Metadata } from 'next'
import { DevLayout, defaultMetadata, withDevtoolsMessages } from '../_internal/devtools-layout'

export const metadata: Metadata = defaultMetadata

export default withDevtoolsMessages(DevLayout)
