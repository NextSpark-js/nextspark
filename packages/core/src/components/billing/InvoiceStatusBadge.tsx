import { Badge } from '../ui/badge'
import { cn } from '../../lib/utils'
import { useTranslations } from 'next-intl'

export type InvoiceStatus = 'pending' | 'paid' | 'failed' | 'refunded'

interface InvoiceStatusBadgeProps {
  status: InvoiceStatus
  className?: string
}

export function InvoiceStatusBadge({ status, className }: InvoiceStatusBadgeProps) {
  const t = useTranslations('settings.billing.invoices.status')

  // Map status to CSS classes using theme variables
  const statusStyles: Record<InvoiceStatus, string> = {
    paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400 border-gray-200 dark:border-gray-800',
  }

  return (
    <Badge
      variant="outline"
      className={cn(
        statusStyles[status],
        className
      )}
      data-cy="invoice-status-badge"
      data-status={status}
    >
      {t(status)}
    </Badge>
  )
}
