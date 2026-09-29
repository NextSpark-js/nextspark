// Implementation: @nextsparkjs/core/routes/(auth)/signup/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import SignupPage, { metadata as defaultMetadata } from "@nextsparkjs/core/routes/(auth)/signup/page"
import { getTemplateOrDefault, getMetadataOrDefault } from "@nextsparkjs/registries/template-scopes/server/(auth)/signup/page"

export const dynamic = "force-dynamic"
export const metadata = getMetadataOrDefault("app/(auth)/signup/page.tsx", defaultMetadata)
export default getTemplateOrDefault("app/(auth)/signup/page.tsx", SignupPage)
