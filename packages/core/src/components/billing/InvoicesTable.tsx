'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useTranslations, useLocale } from 'next-intl'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/table'
import { InvoiceStatusBadge, type InvoiceStatus } from './InvoiceStatusBadge'
import { InvoicesEmptyState } from './InvoicesEmptyState'
import { InvoicesPagination } from './InvoicesPagination'
import { FEATURES } from '../../lib/config/build-features'

export interface Invoice {
  id: string
  invoiceNumber: string
  date: string
  amount: number
  currency: string
  status: InvoiceStatus
  pdfUrl: string | null
}

/** A row's link to the invoice page; with `features.billing: false` that page is left out (#425), so the row shows plain text. */
function InvoiceLink({ invoiceNumber, children, ...props }: { invoiceNumber: string; children: ReactNode; className: string; 'aria-label'?: string }) {
  if (!FEATURES.billing) return <span {...props}>{children}</span>
  return <Link href={`/dashboard/settings/invoices/${encodeURIComponent(invoiceNumber)}`} {...props}>{children}</Link>
}

interface InvoicesTableProps {
  invoices: Invoice[]
  isLoading?: boolean
  total: number
  limit: number
  offset: number
  onPageChange: (page: number) => void
}

export function InvoicesTable({
  invoices,
  isLoading = false,
  total,
  limit,
  offset,
  onPageChange,
}: InvoicesTableProps) {
  const t = useTranslations('settings.billing.invoices')
  // Active next-intl locale so dates/amounts follow the app language (see #85)
  const locale = useLocale()

  const currentPage = Math.floor(offset / limit) + 1
  const totalPages = Math.ceil(total / limit)

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat(locale, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  if (!isLoading && invoices.length === 0) {
    return <InvoicesEmptyState />
  }

  return (
    <div className="space-y-4" data-cy="invoices-table">
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[140px]">
                {t('table.date')}
              </TableHead>
              <TableHead className="w-[120px]">
                {t('table.amount')}
              </TableHead>
              <TableHead>
                {t('table.invoiceNumber')}
              </TableHead>
              <TableHead className="w-[120px]">
                {t('table.status')}
              </TableHead>
              <TableHead className="w-[50px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <div className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <span className="text-sm text-muted-foreground">
                      {t('loading')}
                    </span>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              invoices.map((invoice) => (
                <TableRow
                  key={invoice.id}
                  data-cy="invoices-row"
                  className="cursor-pointer hover:bg-muted/50"
                >
                  <TableCell className="font-medium">
                    <InvoiceLink
                      invoiceNumber={invoice.invoiceNumber}
                      className="block"
                    >
                      {formatDate(invoice.date)}
                    </InvoiceLink>
                  </TableCell>
                  <TableCell>
                    <InvoiceLink
                      invoiceNumber={invoice.invoiceNumber}
                      className="block"
                    >
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </InvoiceLink>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    <InvoiceLink
                      invoiceNumber={invoice.invoiceNumber}
                      className="block"
                    >
                      {invoice.invoiceNumber}
                    </InvoiceLink>
                  </TableCell>
                  <TableCell>
                    <InvoiceLink
                      invoiceNumber={invoice.invoiceNumber}
                      className="block"
                    >
                      <InvoiceStatusBadge status={invoice.status} />
                    </InvoiceLink>
                  </TableCell>
                  <TableCell className="text-right">
                    <InvoiceLink
                      invoiceNumber={invoice.invoiceNumber}
                      className="inline-flex items-center text-muted-foreground hover:text-foreground"
                      aria-label={t('download.tooltip')}
                    >
                      <ExternalLink className="h-4 w-4" aria-hidden="true" />
                    </InvoiceLink>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {!isLoading && total > limit && (
        <InvoicesPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalInvoices={total}
          limit={limit}
          offset={offset}
          onPageChange={onPageChange}
          isLoading={isLoading}
        />
      )}
    </div>
  )
}
