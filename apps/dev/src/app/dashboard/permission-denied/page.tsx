// Implementation: @nextsparkjs/core/routes/dashboard/permission-denied/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
import PermissionDeniedPage from "@nextsparkjs/core/routes/dashboard/permission-denied/page"
import { getTemplateOrDefault } from "@nextsparkjs/registries/template-scopes/server/dashboard/permission-denied/page"

export default getTemplateOrDefault("app/dashboard/permission-denied/page.tsx", PermissionDeniedPage)
