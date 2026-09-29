// Implementation: @nextsparkjs/core/routes/dashboard/settings/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import SettingsPage from "@nextsparkjs/core/routes/dashboard/settings/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/dashboard/settings/page"

export default getTemplateOrDefaultClient("app/dashboard/settings/page.tsx", SettingsPage)
