// Implementation: @nextsparkjs/core/routes/devtools/layout (#203). The project's template override for
// this layout is still resolved here at runtime, until the generated host replaces this file.
import { metadata as defaultMetadata } from '@nextsparkjs/core/routes/devtools/layout'
import { DevLayout, withDevtoolsMessages } from '@nextsparkjs/core/routes/_internal/devtools-layout'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/devtools/layout'

export const metadata = getMetadataOrDefault('app/devtools/layout.tsx', defaultMetadata)
export default withDevtoolsMessages(getTemplateOrDefault('app/devtools/layout.tsx', DevLayout))
