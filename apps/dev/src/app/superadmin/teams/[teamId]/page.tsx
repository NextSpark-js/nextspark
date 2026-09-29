// Implementation: @nextsparkjs/core/routes/superadmin/teams/[teamId]/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import TeamDetailPage from "@nextsparkjs/core/routes/superadmin/teams/[teamId]/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/superadmin/teams/[teamId]/page"

export default getTemplateOrDefaultClient("app/superadmin/teams/[teamId]/page.tsx", TeamDetailPage)
