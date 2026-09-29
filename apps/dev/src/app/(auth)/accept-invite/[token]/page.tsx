// Implementation: @nextsparkjs/core/routes/(auth)/accept-invite/[token]/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import AcceptInvitePage from "@nextsparkjs/core/routes/(auth)/accept-invite/[token]/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/(auth)/accept-invite/[token]/page"

export default getTemplateOrDefaultClient("app/(auth)/accept-invite/[token]/page.tsx", AcceptInvitePage)
