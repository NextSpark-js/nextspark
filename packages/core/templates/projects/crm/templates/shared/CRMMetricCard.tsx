import { Card } from '@nextsparkjs/core/components/ui/card'
import { formatCurrency, formatCompactNumber, calculatePercentageChange } from '../../lib/crm-utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface CRMMetricCardProps {
    label: string
    value: number | string
    previousValue?: number
    format?: 'currency' | 'number' | 'compact' | 'percentage' | 'none'
    currency?: string
    icon?: React.ReactNode
    className?: string
}

export function CRMMetricCard({
    label,
    value,
    previousValue,
    format = 'none',
    currency = 'USD',
    icon,
    className = '',
}: CRMMetricCardProps) {
    const formattedValue = typeof value === 'number'
        ? formatValue(value, format, currency)
        : value

    const change = previousValue !== undefined && typeof value === 'number'
        ? calculatePercentageChange(value, previousValue)
        : null

    return (
        <Card className={`crm-metric-card ${className}`}>
            <div className="flex items-start justify-between">
                <div className="flex-1">
                    <p className="crm-metric-label">{label}</p>
                    <p className="crm-metric-value">{formattedValue}</p>

                    {change && (
                        <div className={`crm-metric-change ${change.isPositive ? 'positive' : 'negative'}`}>
                            {change.isPositive ? (
                                <TrendingUp className="inline w-4 h-4 mr-1" />
                            ) : (
                                <TrendingDown className="inline w-4 h-4 mr-1" />
                            )}
                            <span>{change.value.toFixed(1)}%</span>
                        </div>
                    )}
                </div>

                {icon && (
                    <div className="text-3xl opacity-20">
                        {icon}
                    </div>
                )}
            </div>
        </Card>
    )
}

function formatValue(value: number, format: string, currency: string): string {
    switch (format) {
        case 'currency':
            return formatCurrency(value, currency)
        case 'compact':
            return formatCompactNumber(value)
        case 'percentage':
            return `${value.toFixed(1)}%`
        case 'number':
            return value.toLocaleString()
        default:
            return value.toString()
    }
}

export default CRMMetricCard
