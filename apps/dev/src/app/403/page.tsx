// Implementation: @nextsparkjs/core/routes/403/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import ForbiddenPage from "@nextsparkjs/core/routes/403/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/403/page"

export default getTemplateOrDefaultClient("app/403/page.tsx", ForbiddenPage)
