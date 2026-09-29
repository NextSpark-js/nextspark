// Implementation: @nextsparkjs/core/routes/public/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import DefaultPublicPage from "@nextsparkjs/core/routes/public/page"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/public/page"

export default getTemplateOrDefault("app/public/page.tsx", DefaultPublicPage)
