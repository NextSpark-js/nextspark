// Implementation: @nextsparkjs/core/routes/dashboard/(main)/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import DefaultDashboardPage from "@nextsparkjs/core/routes/dashboard/(main)/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/dashboard/(main)/page"

export default getTemplateOrDefaultClient("app/dashboard/(main)/page.tsx", DefaultDashboardPage)
