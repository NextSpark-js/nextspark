'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Alert, AlertDescription } from '@nextsparkjs/core/components/ui/alert'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nextsparkjs/core/components/ui/table'
import { apiCall, formatDate, formatMoney, useMarketplaceTranslations } from './shared'

type Provider = 'stripe' | 'mercadopago'

interface Account {
  id: string
  provider: Provider
  status: 'pending' | 'active' | 'restricted' | 'disconnected'
  chargesEnabled: boolean
  payoutsEnabled: boolean
}

interface Payment {
  id: string
  provider: Provider
  amountCents: number
  commissionCents: number
  refundedCents: number
  currency: string
  description: string
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'partially_refunded' | 'refunded' | 'disputed'
  createdAt: string
}

const PROVIDERS: Provider[] = ['stripe', 'mercadopago']
const PAYMENT_STATUSES: Payment['status'][] = ['pending', 'succeeded', 'failed', 'cancelled', 'partially_refunded', 'refunded', 'disputed']
const RESULTS = ['connected', 'invalid_state', 'forbidden', 'already_connected', 'error'] as const
const ACCOUNT_KEY = ['marketplace-payments', 'account']

function ProviderCard({ provider, account, configured }: { provider: Provider; account?: Account; configured: boolean }) {
  const t = useMarketplaceTranslations()
  const queryClient = useQueryClient()

  const connect = useMutation({
    mutationFn: () =>
      apiCall<{ redirectUrl: string }>('/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      }),
    onSuccess: ({ redirectUrl }) => window.location.assign(redirectUrl),
  })

  const disconnect = useMutation({
    mutationFn: () =>
      apiCall('/account', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ACCOUNT_KEY }),
  })

  const connected = account && account.status !== 'disconnected'
  const connectLabel = account?.status === 'disconnected' ? 'account.reconnect' : connected && account.status !== 'active' ? 'account.continueSetup' : 'account.connect'

  return (
    <Card data-cy={`marketplace-provider-${provider}`}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between gap-2">
          {t(`provider.${provider}`)}
          {account && <Badge variant={account.status === 'active' ? 'default' : 'secondary'}>{t(`status.${account.status}`)}</Badge>}
        </CardTitle>
        {!account && <CardDescription>{configured ? t('account.notConnected') : t('account.notConfigured')}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">
        {connected && (
          <dl className="grid grid-cols-2 gap-2 text-sm">
            <dt className="text-muted-foreground">{t('account.charges')}</dt>
            <dd>{account.chargesEnabled ? t('account.enabled') : t('account.disabled')}</dd>
            <dt className="text-muted-foreground">{t('account.payouts')}</dt>
            <dd>{account.payoutsEnabled ? t('account.enabled') : t('account.disabled')}</dd>
          </dl>
        )}
        {(connect.isError || disconnect.isError) && (
          <Alert variant="destructive" role="alert">
            <AlertDescription>{t('account.actionFailed')}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap gap-2">
          {configured && account?.status !== 'active' && (
            <Button onClick={() => connect.mutate()} disabled={connect.isPending} data-cy={`marketplace-connect-${provider}`}>
              {t(connectLabel)}
            </Button>
          )}
          {connected && (
            <Button
              variant="outline"
              disabled={disconnect.isPending}
              onClick={() => window.confirm(t('account.disconnectConfirm')) && disconnect.mutate()}
              data-cy={`marketplace-disconnect-${provider}`}
            >
              {t('account.disconnect')}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function PaymentHistory() {
  const t = useMarketplaceTranslations()
  const locale = useLocale()
  const [page, setPage] = useState(1)
  const [status, setStatus] = useState('')
  const limit = 20

  const { data, isLoading, isError } = useQuery({
    queryKey: ['marketplace-payments', 'payments', page, status],
    queryFn: () => apiCall<{ payments: Payment[]; pagination: { total: number } }>(`/payments?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`),
  })
  const pages = Math.max(1, Math.ceil((data?.pagination.total ?? 0) / limit))

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('payments.title')}</CardTitle>
        <CardDescription>{t('payments.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <select
          aria-label={t('payments.status')}
          className="rounded-md border border-input bg-background px-3 py-2 text-sm"
          value={status}
          onChange={event => {
            setStatus(event.target.value)
            setPage(1)
          }}
          data-cy="marketplace-payments-status"
        >
          <option value="">{t('payments.allStatuses')}</option>
          {PAYMENT_STATUSES.map(value => (
            <option key={value} value={value}>
              {t(`paymentStatus.${value}`)}
            </option>
          ))}
        </select>

        {isError && <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>}
        {!isLoading && !isError && data?.payments.length === 0 && <p className="text-sm text-muted-foreground">{t('payments.empty')}</p>}
        {data && data.payments.length > 0 && (
          <div className="overflow-x-auto">
            <Table data-cy="marketplace-payments-table">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('payments.date')}</TableHead>
                  <TableHead>{t('payments.item')}</TableHead>
                  <TableHead>{t('payments.provider')}</TableHead>
                  <TableHead>{t('payments.amount')}</TableHead>
                  <TableHead>{t('payments.commission')}</TableHead>
                  <TableHead>{t('payments.net')}</TableHead>
                  <TableHead>{t('payments.status')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.payments.map(payment => (
                  <TableRow key={payment.id}>
                    <TableCell>{formatDate(payment.createdAt, locale)}</TableCell>
                    <TableCell>{payment.description}</TableCell>
                    <TableCell>{t(`provider.${payment.provider}`)}</TableCell>
                    <TableCell>{formatMoney(payment.amountCents, payment.currency, locale)}</TableCell>
                    <TableCell>{formatMoney(payment.commissionCents, payment.currency, locale)}</TableCell>
                    <TableCell>{formatMoney(payment.amountCents - payment.commissionCents, payment.currency, locale)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{t(`paymentStatus.${payment.status}`)}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              {t('payments.previous')}
            </Button>
            <span className="text-sm text-muted-foreground">{t('payments.page', { page, pages })}</span>
            <Button variant="outline" size="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
              {t('payments.next')}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function SellerSettings() {
  const t = useMarketplaceTranslations()
  const result = useSearchParams().get('result')
  const known = RESULTS.find(value => value === result)
  const { data, isError } = useQuery({
    queryKey: ACCOUNT_KEY,
    queryFn: () => apiCall<{ accounts: Account[]; providers: Record<Provider, boolean> }>('/account'),
  })

  return (
    <div className="max-w-4xl space-y-6" data-cy="marketplace-settings">
      <header>
        <h1 className="text-2xl font-bold">{t('settings.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('settings.description')}</p>
      </header>

      {known && (
        <Alert variant={known === 'connected' ? 'default' : 'destructive'} role="status">
          <AlertDescription>{t(`result.${known}`)}</AlertDescription>
        </Alert>
      )}
      {isError && <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>}

      {data && (
        <div className="grid gap-4 md:grid-cols-2">
          {PROVIDERS.map(provider => (
            <ProviderCard key={provider} provider={provider} account={data.accounts.find(account => account.provider === provider)} configured={data.providers[provider]} />
          ))}
        </div>
      )}

      <PaymentHistory />
    </div>
  )
}
