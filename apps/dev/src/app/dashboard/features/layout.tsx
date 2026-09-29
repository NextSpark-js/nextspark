// Implementation: @nextsparkjs/core/routes/dashboard/features/layout (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import FeaturesLayout from "@nextsparkjs/core/routes/dashboard/features/layout"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/dashboard/features/layout"

export default getTemplateOrDefault("app/dashboard/features/layout.tsx", FeaturesLayout)
