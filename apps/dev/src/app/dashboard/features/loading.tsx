// Implementation: @nextsparkjs/core/routes/dashboard/features/loading (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import FeaturesLoading from "@nextsparkjs/core/routes/dashboard/features/loading"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/dashboard/features/loading"

export default getTemplateOrDefault("app/dashboard/features/loading.tsx", FeaturesLoading)
