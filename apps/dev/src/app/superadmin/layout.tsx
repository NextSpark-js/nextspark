// Implementation: @nextsparkjs/core/routes/superadmin/layout (#203). The project's template override for
// this layout is still resolved here at runtime, until the generated host replaces this file.
import { metadata as defaultMetadata } from '@nextsparkjs/core/routes/superadmin/layout'
import { SuperadminLayout, withSuperadminMessages } from '@nextsparkjs/core/routes/_internal/superadmin-layout'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/superadmin/layout'

export const metadata = getMetadataOrDefault('app/superadmin/layout.tsx', defaultMetadata)
export default withSuperadminMessages(getTemplateOrDefault('app/superadmin/layout.tsx', SuperadminLayout))
