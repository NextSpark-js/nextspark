// Implementation: @nextsparkjs/core/routes/(auth)/layout (#203). The project's template override for
// this layout is still resolved here at runtime, until the generated host replaces this file.
import { metadata as defaultMetadata } from '@nextsparkjs/core/routes/(auth)/layout'
import { DefaultAuthLayout, withAuthMessages } from '@nextsparkjs/core/routes/_internal/auth-layout'
import { getTemplateOrDefault, getMetadataOrDefault } from '@nextsparkjs/registries/template-scopes/server/(auth)/layout'

export const metadata = getMetadataOrDefault('app/(auth)/layout.tsx', defaultMetadata)
export default withAuthMessages(getTemplateOrDefault('app/(auth)/layout.tsx', DefaultAuthLayout))
