import { Button } from '../ui/button'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface InvoicesPaginationProps {
  currentPage: number
  totalPages: number
  totalInvoices: number
  limit: number
  offset: number
  onPageChange: (page: number) => void
  isLoading?: boolean
}

export function InvoicesPagination({
  currentPage,
  totalPages,
  totalInvoices,
  limit,
  offset,
  onPageChange,
  isLoading = false,
}: InvoicesPaginationProps) {
  const t = useTranslations('settings.billing.invoices.pagination')

  const showingFrom = Math.min(offset + 1, totalInvoices)
  const showingTo = Math.min(offset + limit, totalInvoices)

  const handlePrevious = () => {
    if (currentPage > 1) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNext = () => {
    if (currentPage < totalPages) {
      onPageChange(currentPage + 1)
    }
  }

  if (totalInvoices === 0) {
    return null
  }

  return (
    <div
      className="flex items-center justify-between pt-4 border-t"
      data-cy="invoices-pagination"
      aria-label={t('showing', { from: showingFrom, to: showingTo, total: totalInvoices })}
    >
      {/* Showing X to Y of Z invoices */}
      <p className="text-sm text-muted-foreground">
        {t('showing', { from: showingFrom, to: showingTo, total: totalInvoices })}
      </p>

      {/* Page navigation */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-muted-foreground">
          {t('page', { current: currentPage, total: totalPages })}
        </span>

        <div className="flex gap-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrevious}
            disabled={currentPage <= 1 || isLoading}
            aria-label={t('previous')}
            data-cy="pagination-previous"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            <span className="ml-1">{t('previous')}</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleNext}
            disabled={currentPage >= totalPages || isLoading}
            aria-label={t('next')}
            data-cy="pagination-next"
          >
            <span className="mr-1">{t('next')}</span>
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  )
}
