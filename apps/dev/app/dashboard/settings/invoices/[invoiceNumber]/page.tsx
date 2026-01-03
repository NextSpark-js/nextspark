'use client'

import { use, useCallback } from 'react'
import Link from 'next/link'
import { Card, CardContent } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Separator } from '@nextsparkjs/core/components/ui/separator'
import { ArrowLeft, Printer, Loader2 } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { useInvoice } from '@nextsparkjs/core/hooks/useInvoice'
import { useTeam } from '@nextsparkjs/core/hooks/useTeam'
import { InvoiceStatusBadge } from '@nextsparkjs/core/components/billing/InvoiceStatusBadge'

interface InvoicePageProps {
  params: Promise<{ invoiceNumber: string }>
}

function InvoicePage({ params }: InvoicePageProps) {
  const { invoiceNumber } = use(params)
  const t = useTranslations('settings.billing')
  const { team } = useTeam()

  const {
    data: invoiceData,
    isLoading,
    error,
  } = useInvoice({
    invoiceNumber: decodeURIComponent(invoiceNumber),
  })

  const invoice = invoiceData?.data

  const handlePrint = useCallback(() => {
    window.print()
  }, [])

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }).format(date)
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency,
    }).format(amount)
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="max-w-3xl">
        <div className="space-y-6">
          <Link
            href="/dashboard/settings/billing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground print:hidden"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('title')}
          </Link>
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground">
                {t('invoices.empty.title')}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-3xl">
      <div className="space-y-6">
        {/* Navigation - hidden when printing */}
        <div className="flex items-center justify-between print:hidden">
          <Link
            href="/dashboard/settings/billing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            {t('title')}
          </Link>
          <Button onClick={handlePrint} variant="outline" size="sm">
            <Printer className="h-4 w-4 mr-2" />
            {t('invoices.download.tooltip')}
          </Button>
        </div>

        {/* Invoice Document */}
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-8 print:p-0">
            {/* Invoice Header */}
            <div className="flex justify-between items-start mb-8">
              <div>
                <h1 className="text-3xl font-bold text-foreground">
                  {t('invoices.table.invoiceNumber').replace('#', '')}
                </h1>
                <p className="text-2xl font-mono mt-1">{invoice.invoiceNumber}</p>
              </div>
              <div className="text-right">
                <InvoiceStatusBadge status={invoice.status} />
              </div>
            </div>

            <Separator className="my-6" />

            {/* Bill To / From */}
            <div className="grid grid-cols-2 gap-8 mb-8">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Bill To
                </h3>
                <p className="font-medium text-lg">{team?.name || 'Team'}</p>
              </div>
              <div className="text-right">
                <h3 className="text-sm font-medium text-muted-foreground mb-2">
                  Invoice Date
                </h3>
                <p className="font-medium">{formatDate(invoice.date)}</p>
              </div>
            </div>

            <Separator className="my-6" />

            {/* Invoice Details */}
            <div className="mb-8">
              <h3 className="text-sm font-medium text-muted-foreground mb-4">
                Description
              </h3>
              <div className="rounded-lg border">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left p-4 font-medium">Item</th>
                      <th className="text-right p-4 font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td className="p-4">
                        {invoice.description || 'Monthly subscription'}
                      </td>
                      <td className="p-4 text-right font-mono">
                        {formatCurrency(invoice.amount, invoice.currency)}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Total */}
            <div className="flex justify-end">
              <div className="w-64">
                <div className="flex justify-between items-center py-2">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>
                </div>
                <Separator />
                <div className="flex justify-between items-center py-3">
                  <span className="text-lg font-medium">Total</span>
                  <span className="text-xl font-bold font-mono">
                    {formatCurrency(invoice.amount, invoice.currency)}
                  </span>
                </div>
              </div>
            </div>

            {/* Footer - Payment Info */}
            <Separator className="my-8" />
            <div className="text-center text-sm text-muted-foreground">
              <p>Thank you for your business</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Print Styles */}
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .max-w-3xl,
          .max-w-3xl * {
            visibility: visible;
          }
          .max-w-3xl {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 20mm;
          }
          .print\\:hidden {
            display: none !important;
          }
        }
      `}</style>
    </div>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/invoices/[invoiceNumber]/page.tsx', InvoicePage)
