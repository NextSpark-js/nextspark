// Implementation: @nextsparkjs/core/routes/(auth)/auth-error/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import AuthErrorPageWrapper, { metadata as defaultMetadata } from "@nextsparkjs/core/routes/(auth)/auth-error/page"
import { getTemplateOrDefault, getMetadataOrDefault } from "@nextsparkjs/registries/template-scopes/server/(auth)/auth-error/page"

export const metadata = getMetadataOrDefault("app/(auth)/auth-error/page.tsx", defaultMetadata)
export default getTemplateOrDefault("app/(auth)/auth-error/page.tsx", AuthErrorPageWrapper)
