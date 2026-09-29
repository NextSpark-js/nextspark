// Implementation: @nextsparkjs/core/routes/superadmin/users/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import UsersPage from "@nextsparkjs/core/routes/superadmin/users/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/superadmin/users/page"

export default getTemplateOrDefaultClient("app/superadmin/users/page.tsx", UsersPage)
