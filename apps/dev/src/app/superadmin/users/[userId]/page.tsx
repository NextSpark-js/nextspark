// Implementation: @nextsparkjs/core/routes/superadmin/users/[userId]/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import UserDetailPage from "@nextsparkjs/core/routes/superadmin/users/[userId]/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/superadmin/users/[userId]/page"

export default getTemplateOrDefaultClient("app/superadmin/users/[userId]/page.tsx", UserDetailPage)
