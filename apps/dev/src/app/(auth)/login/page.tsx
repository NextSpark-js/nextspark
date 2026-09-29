// Implementation: @nextsparkjs/core/routes/(auth)/login/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import LoginPage, { metadata as defaultMetadata } from "@nextsparkjs/core/routes/(auth)/login/page"
import { getTemplateOrDefault, getMetadataOrDefault } from "@nextsparkjs/registries/template-scopes/server/(auth)/login/page"

export const dynamic = "force-dynamic"
export const metadata = getMetadataOrDefault("app/(auth)/login/page.tsx", defaultMetadata)
export default getTemplateOrDefault("app/(auth)/login/page.tsx", LoginPage)
