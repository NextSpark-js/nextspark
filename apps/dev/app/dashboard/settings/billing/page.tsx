'use client'

import Link from 'next/link'
import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Separator } from '@nextsparkjs/core/components/ui/separator'
import {
  CreditCard,
  Calendar,
  AlertCircle,
  Check,
  Crown
} from 'lucide-react'
import { createTestId, createCyId } from '@nextsparkjs/testing'
import { useTranslations } from 'next-intl'
import { getTemplateOrDefaultClient } from '@nextsparkjs/registries/template-registry.client'
import { useInvoices } from '@nextsparkjs/core/hooks/useInvoices'
import { InvoicesTable } from '@nextsparkjs/core/components/billing'
import { usePermission } from '@nextsparkjs/core/lib/permissions/hooks'
import type { Permission } from '@nextsparkjs/core/lib/permissions/types'

function BillingPage() {
  const router = useRouter()
  const canAccessBilling = usePermission('settings.billing' as Permission)
  const [statusMessage, setStatusMessage] = useState('')
  const [invoicesLimit, setInvoicesLimit] = useState(3) // Start with 3, load 10 more each time
  const t = useTranslations('settings')

  // Fetch invoices for current team (must be before early return)
  const {
    data: invoicesData,
    isLoading: invoicesLoading,
  } = useInvoices({
    limit: invoicesLimit,
    offset: 0,
  })

  const totalInvoices = invoicesData?.info?.total ?? 0
  const hasMoreInvoices = (invoicesData?.data?.length ?? 0) < totalInvoices

  const handleUpgrade = useCallback(() => {
    setStatusMessage(t('billing.messages.upgradeRedirect'))
  }, [t])

  const handleAddPayment = useCallback(() => {
    setStatusMessage(t('billing.messages.addPaymentForm'))
  }, [t])

  const handleLoadMoreInvoices = useCallback(() => {
    setInvoicesLimit(prev => prev + 10)
  }, [])

  // Redirect if user doesn't have billing permission
  useEffect(() => {
    if (canAccessBilling === false) {
      router.replace('/dashboard/settings')
    }
  }, [canAccessBilling, router])

  // Show nothing while checking permissions or redirecting
  if (!canAccessBilling) {
    return null
  }

  return (
    <>
      {/* MANDATORY: Screen reader announcements */}
      <div 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
        {...createTestId('billing', 'status', 'message') && { 'data-testid': createTestId('billing', 'status', 'message') }}
      >
        {statusMessage}
      </div>

      <div 
        className="max-w-4xl"
        {...createTestId('billing', 'container') && { 'data-testid': createTestId('billing', 'container') }}
        {...createCyId('billing', 'main') && { 'data-cy': createCyId('billing', 'main') }}
      >
        <div className="space-y-6">
          {/* Header */}
          <header 
            {...createTestId('billing', 'header') && { 'data-testid': createTestId('billing', 'header') }}
            {...createCyId('billing', 'header') && { 'data-cy': createCyId('billing', 'header') }}
          >
            <h1 
              className="text-2xl font-bold"
              id="billing-heading"
              {...createTestId('billing', 'title') && { 'data-testid': createTestId('billing', 'title') }}
            >
              {t('billing.title')}
            </h1>
            <p 
              className="text-muted-foreground mt-1"
              {...createTestId('billing', 'description') && { 'data-testid': createTestId('billing', 'description') }}
            >
              {t('billing.description')}
            </p>
          </header>

        {/* Current Plan */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Crown className="h-5 w-5 text-yellow-500" />
                  {t('billing.currentPlan.title')}
                </CardTitle>
                <CardDescription>
                  {t('billing.currentPlan.description')}
                </CardDescription>
              </div>
              <Badge variant="secondary">{t('billing.currentPlan.free')}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-primary">0 / 100</div>
                  <div className="text-sm text-muted-foreground">{t('billing.usage.tasks')}</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-primary">1 / 1</div>
                  <div className="text-sm text-muted-foreground">{t('billing.usage.teamMember')}</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-muted/50">
                  <div className="text-2xl font-bold text-primary">0 / 5</div>
                  <div className="text-sm text-muted-foreground">{t('billing.usage.projects')}</div>
                </div>
              </div>

              <Separator />

              <div className="flex justify-between items-center">
                <div>
                  <h4 className="font-medium">{t('billing.upgrade.title')}</h4>
                  <p className="text-sm text-muted-foreground">
                    {t('billing.upgrade.description')}
                  </p>
                </div>
                  <Link href="/pricing">
                    <Button
                      onClick={handleUpgrade}
                      {...createTestId('billing', 'upgrade', 'button') && { 'data-testid': createTestId('billing', 'upgrade', 'button') }}
                      {...createCyId('billing', 'upgrade-plan') && { 'data-cy': createCyId('billing', 'upgrade-plan') }}
                    >
                      {t('billing.upgrade.button')}
                    </Button>
                  </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing History - Full Width */}
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
              limit={totalInvoices} // Pass total to disable internal pagination
              offset={0}
              onPageChange={() => {}} // No-op, we use load more instead
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

        {/* Payment Method - Full Width */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              {t('billing.paymentMethod.title')}
            </CardTitle>
            <CardDescription>
              {t('billing.paymentMethod.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{t('billing.paymentMethod.noMethod')}</p>
                  <p className="text-xs text-muted-foreground">
                    {t('billing.paymentMethod.addCard')}
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleAddPayment}
                {...createTestId('billing', 'payment', 'button') && { 'data-testid': createTestId('billing', 'payment', 'button') }}
                {...createCyId('billing', 'add-payment') && { 'data-cy': createCyId('billing', 'add-payment') }}
              >
                <CreditCard className="mr-2 h-4 w-4" aria-hidden="true" />
                {t('billing.paymentMethod.addButton')}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Plan Features */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>{t('billing.features.title')}</CardTitle>
            <CardDescription>
              {t('billing.features.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t('billing.features.taskLimit')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t('billing.features.teamMember')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t('billing.features.projectLimit')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t('billing.features.basicSupport')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t('billing.features.basicDashboard')}</span>
              </div>
              <div className="flex items-center gap-3">
                <Check className="h-4 w-4 text-green-500" />
                <span className="text-sm">{t('billing.features.profileManagement')}</span>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="flex justify-between items-center">
              <div>
                <h4 className="font-medium">{t('billing.upgrade.ready')}</h4>
                <p className="text-sm text-muted-foreground">
                  {t('billing.upgrade.explore')}
                </p>
              </div>
              <div className="flex gap-3">
                <Link href="/pricing">
                  <Button variant="outline">
                    {t('billing.upgrade.viewPricing')}
                  </Button>
                </Link>
                <Button>
                  {t('billing.upgrade.contactSales')}
                </Button>
              </div>
            </div>
          </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

export default getTemplateOrDefaultClient('app/dashboard/settings/billing/page.tsx', BillingPage)