// Implementation: @nextsparkjs/core/routes/dashboard/settings/layout (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import SettingsLayout from "@nextsparkjs/core/routes/dashboard/settings/layout"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/dashboard/settings/layout"

export default getTemplateOrDefaultClient("app/dashboard/settings/layout.tsx", SettingsLayout)
