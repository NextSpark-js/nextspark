// Implementation: @nextsparkjs/core/routes/dashboard/settings/password/loading (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import PasswordLoading from "@nextsparkjs/core/routes/dashboard/settings/password/loading"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/dashboard/settings/password/loading"

export default getTemplateOrDefault("app/dashboard/settings/password/loading.tsx", PasswordLoading)
