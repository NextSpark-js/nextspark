// Implementation: @nextsparkjs/core/routes/dashboard/settings/loading (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import SettingsLoading from "@nextsparkjs/core/routes/dashboard/settings/loading"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/dashboard/settings/loading"

export default getTemplateOrDefault("app/dashboard/settings/loading.tsx", SettingsLoading)
