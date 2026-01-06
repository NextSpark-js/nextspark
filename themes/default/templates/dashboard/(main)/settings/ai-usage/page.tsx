'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@nextsparkjs/core/components/ui/select'
import { useTokenUsage } from '@/themes/default/lib/hooks/useTokenUsage'
import { useTranslations } from 'next-intl'
import { Loader2, Coins, Zap, TrendingUp } from 'lucide-react'

type Period = 'today' | '7d' | '30d' | 'all'

export default function AIUsagePage() {
    const t = useTranslations('aiUsage')
    const [period, setPeriod] = useState<Period>('30d')
    const { data, isLoading, error } = useTokenUsage(period)

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64" data-cy="ai-usage-loading">
                <Loader2 className="h-8 w-8 animate-spin" />
            </div>
        )
    }

    if (error) {
        return (
            <div className="p-4 text-destructive" data-cy="ai-usage-error">
                {t('error')}: {error.message}
            </div>
        )
    }

    const stats = data?.data?.stats
    const daily = data?.data?.daily || []

    return (
        <div className="space-y-6" data-cy="ai-usage-page">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">{t('title')}</h1>
                    <p className="text-muted-foreground">{t('description')}</p>
                </div>

                <Select value={period} onValueChange={(v: string) => setPeriod(v as Period)}>
                    <SelectTrigger className="w-32" data-cy="ai-usage-period-select">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="today">{t('period.today')}</SelectItem>
                        <SelectItem value="7d">{t('period.7d')}</SelectItem>
                        <SelectItem value="30d">{t('period.30d')}</SelectItem>
                        <SelectItem value="all">{t('period.all')}</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Stats Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card data-cy="ai-usage-total-tokens">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.totalTokens.title')}</CardTitle>
                        <Zap className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats?.totalTokens.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {stats?.inputTokens.toLocaleString() || 0} {t('stats.totalTokens.input')} / {stats?.outputTokens.toLocaleString() || 0} {t('stats.totalTokens.output')}
                        </p>
                    </CardContent>
                </Card>

                <Card data-cy="ai-usage-total-cost">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.estimatedCost.title')}</CardTitle>
                        <Coins className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            ${stats?.totalCost.toFixed(4) || '0.0000'}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('stats.estimatedCost.currency')}
                        </p>
                    </CardContent>
                </Card>

                <Card data-cy="ai-usage-requests">
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                        <CardTitle className="text-sm font-medium">{t('stats.requests.title')}</CardTitle>
                        <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">
                            {stats?.requestCount.toLocaleString() || 0}
                        </div>
                        <p className="text-xs text-muted-foreground">
                            {t('stats.requests.description')}
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* Usage by Model */}
            {stats?.byModel && Object.keys(stats.byModel).length > 0 && (
                <Card data-cy="ai-usage-by-model">
                    <CardHeader>
                        <CardTitle>{t('usageByModel.title')}</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {Object.entries(stats.byModel).map(([model, data]) => (
                                <div key={model} className="flex items-center justify-between">
                                    <div>
                                        <p className="font-medium">{model}</p>
                                        <p className="text-sm text-muted-foreground">
                                            {data.tokens.toLocaleString()} {t('usageByModel.tokens')}
                                        </p>
                                    </div>
                                    <div className="text-right">
                                        <p className="font-medium">${data.cost.toFixed(4)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Daily Chart */}
            <Card data-cy="ai-usage-chart">
                <CardHeader>
                    <CardTitle>{t('dailyUsage.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                    {daily.length === 0 ? (
                        <p className="text-muted-foreground text-center py-8">
                            {t('dailyUsage.noData')}
                        </p>
                    ) : (
                        <div className="space-y-2">
                            {daily.slice(0, 7).map((day) => (
                                <div key={day.date} className="flex items-center justify-between text-sm">
                                    <span>{day.date}</span>
                                    <span>{day.tokens.toLocaleString()} {t('dailyUsage.tokens')}</span>
                                    <span>${day.cost.toFixed(4)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
