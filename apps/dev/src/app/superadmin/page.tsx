// Implementation: @nextsparkjs/core/routes/superadmin/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import SuperadminDashboard from "@nextsparkjs/core/routes/superadmin/page"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/superadmin/page"

export default getTemplateOrDefault("app/superadmin/page.tsx", SuperadminDashboard)
