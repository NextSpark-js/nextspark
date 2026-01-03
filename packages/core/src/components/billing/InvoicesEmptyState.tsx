import { FileText } from 'lucide-react'
import { useTranslations } from 'next-intl'

export function InvoicesEmptyState() {
  const t = useTranslations('settings.billing.invoices.empty')

  return (
    <div
      className="text-center py-12"
      data-cy="invoices-empty-state"
      role="status"
      aria-live="polite"
    >
      <FileText
        className="h-12 w-12 text-muted-foreground mx-auto mb-4"
        aria-hidden="true"
      />
      <h3 className="text-sm font-medium text-foreground mb-1">
        {t('title')}
      </h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        {t('description')}
      </p>
    </div>
  )
}
