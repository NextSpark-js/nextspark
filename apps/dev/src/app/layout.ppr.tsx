// PPR (Cache Components) variant of layout.tsx: copied over it when a project enables
// cacheComponents. Implementation: @nextsparkjs/core/routes/layout.ppr (#203).
import RootLayout, { metadata as defaultMetadata } from '@nextsparkjs/core/routes/layout.ppr'
import "./globals.css"
import { getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/layout'

export const metadata = getMetadataOrDefault('app/layout.tsx', defaultMetadata)
export default RootLayout
