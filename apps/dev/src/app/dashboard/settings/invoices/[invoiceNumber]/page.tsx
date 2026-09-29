// Implementation: @nextsparkjs/core/routes/dashboard/settings/invoices/[invoiceNumber]/page (#203). The project's template override for this route is
// still resolved here at runtime, until the generated host replaces this file.
'use client'

import InvoicePage from "@nextsparkjs/core/routes/dashboard/settings/invoices/[invoiceNumber]/page"
import { getTemplateOrDefaultClient } from "@nextsparkjs/registries/template-scopes/client/dashboard/settings/invoices/[invoiceNumber]/page"

export default getTemplateOrDefaultClient("app/dashboard/settings/invoices/[invoiceNumber]/page.tsx", InvoicePage)
