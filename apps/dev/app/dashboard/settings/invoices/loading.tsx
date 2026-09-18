import { SkeletonInvoicesPage } from '@nextsparkjs/core/components/ui/skeleton-settings'
import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/dashboard/settings/invoices/loading'

function InvoicesLoading() {
  return <SkeletonInvoicesPage />
}

export default getTemplateOrDefault('app/dashboard/settings/invoices/loading.tsx', InvoicesLoading)
