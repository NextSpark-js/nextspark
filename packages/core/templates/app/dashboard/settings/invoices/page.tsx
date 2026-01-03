'use client'

import { useState, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Calendar } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { useInvoices } from '@nextsparkjs/core/hooks/useInvoices'
import { InvoicesTable } from '@nextsparkjs/core/components/billing'

function InvoicesPage() {
  const [invoicesLimit, setInvoicesLimit] = useState(10)
  const t = useTranslations('settings')

  const {
    data: invoicesData,
    isLoading: invoicesLoading,
  } = useInvoices({
    limit: invoicesLimit,
    offset: 0,
  })

  const totalInvoices = invoicesData?.info?.total ?? 0
  const hasMoreInvoices = (invoicesData?.data?.length ?? 0) < totalInvoices

  const handleLoadMoreInvoices = useCallback(() => {
    setInvoicesLimit(prev => prev + 10)
  }, [])

  return (
    <div className="max-w-4xl">
      <div className="space-y-6">
        {/* Header */}
        <header>
          <h1 className="text-2xl font-bold" id="invoices-heading">
            {t('billing.billingHistory.title')}
          </h1>
          <p className="text-muted-foreground mt-1">
            {t('billing.billingHistory.description')}
          </p>
        </header>

        {/* Invoices Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              {t('billing.billingHistory.title')}
            </CardTitle>
            <CardDescription>
              {t('billing.billingHistory.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <InvoicesTable
              invoices={invoicesData?.data ?? []}
              isLoading={invoicesLoading}
              total={totalInvoices}
              limit={totalInvoices}
              offset={0}
              onPageChange={() => {}}
            />
            {hasMoreInvoices && !invoicesLoading && (
              <div className="flex justify-center mt-4">
                <Button
                  variant="outline"
                  onClick={handleLoadMoreInvoices}
                  data-cy="invoices-load-more"
                >
                  {t('billing.invoices.loadMore')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/invoices/page.tsx', InvoicesPage)
