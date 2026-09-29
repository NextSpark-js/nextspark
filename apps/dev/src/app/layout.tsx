// Implementation: @nextsparkjs/core/routes/layout (#203). The project's globals.css and its
// metadata override are applied here until the generated host replaces this file.
import RootLayout, { metadata as defaultMetadata } from '@nextsparkjs/core/routes/layout'
import "./globals.css"
import { getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/layout'

export const metadata = getMetadataOrDefault('app/layout.tsx', defaultMetadata)
export default RootLayout
