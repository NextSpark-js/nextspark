'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale } from 'next-intl'
import { Badge } from '@nextsparkjs/core/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@nextsparkjs/core/components/ui/table'
import { apiCall, formatDate, formatMoney, useMarketplaceTranslations } from './shared'

interface Overview {
  totals: { provider: 'stripe' | 'mercadopago'; currency: string; payments: number; volumeCents: number; commissionCents: number }[]
  accountsByStatus: { status: 'pending' | 'active' | 'restricted' | 'disconnected'; accounts: number }[]
  accounts: {
    id: string
    teamName: string
    provider: 'stripe' | 'mercadopago'
    status: 'pending' | 'active' | 'restricted' | 'disconnected'
    country: string | null
    createdAt: string
  }[]
}

export function SuperadminOverview() {
  const t = useMarketplaceTranslations()
  const locale = useLocale()
  const { data, isError } = useQuery({
    queryKey: ['marketplace-payments', 'overview'],
    queryFn: () => apiCall<Overview>('/admin/overview'),
  })

  return (
    <div className="space-y-6" data-cy="marketplace-superadmin">
      <header>
        <h1 className="text-2xl font-bold">{t('admin.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('admin.description')}</p>
      </header>

      {isError && <p role="alert" className="text-sm text-destructive">{t('loadError')}</p>}

      {data && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.accountsByStatus')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {data.accountsByStatus.length === 0 && <p className="text-sm text-muted-foreground">{t('admin.empty')}</p>}
              {data.accountsByStatus.map(row => (
                <Badge key={row.status} variant="secondary">
                  {t(`status.${row.status}`)}: {row.accounts}
                </Badge>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.totals')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.totals.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.empty')}</p>
              ) : (
                <Table data-cy="marketplace-superadmin-totals">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.provider')}</TableHead>
                      <TableHead>{t('admin.payments')}</TableHead>
                      <TableHead>{t('admin.volume')}</TableHead>
                      <TableHead>{t('admin.commission')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.totals.map(row => (
                      <TableRow key={`${row.provider}-${row.currency}`}>
                        <TableCell>{t(`provider.${row.provider}`)}</TableCell>
                        <TableCell>{row.payments}</TableCell>
                        <TableCell>{formatMoney(row.volumeCents, row.currency, locale)}</TableCell>
                        <TableCell>{formatMoney(row.commissionCents, row.currency, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('admin.accounts')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              {data.accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t('admin.empty')}</p>
              ) : (
                <Table data-cy="marketplace-superadmin-accounts">
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('admin.team')}</TableHead>
                      <TableHead>{t('admin.provider')}</TableHead>
                      <TableHead>{t('admin.status')}</TableHead>
                      <TableHead>{t('admin.country')}</TableHead>
                      <TableHead>{t('admin.connectedAt')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.accounts.map(account => (
                      <TableRow key={account.id}>
                        <TableCell>{account.teamName}</TableCell>
                        <TableCell>{t(`provider.${account.provider}`)}</TableCell>
                        <TableCell>
                          <Badge variant="secondary">{t(`status.${account.status}`)}</Badge>
                        </TableCell>
                        <TableCell>{account.country ?? '-'}</TableCell>
                        <TableCell>{formatDate(account.createdAt, locale)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
