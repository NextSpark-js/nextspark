// Implementation: @nextsparkjs/core/routes/dashboard/settings/teams/loading (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import TeamsLoading from "@nextsparkjs/core/routes/dashboard/settings/teams/loading"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/dashboard/settings/teams/loading"

export default getTemplateOrDefault("app/dashboard/settings/teams/loading.tsx", TeamsLoading)
