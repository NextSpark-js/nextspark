/**
 * Deal Card Component
 * Professional card for opportunities in the Kanban board
 */

'use client'

import React from 'react'
import { formatCurrency, formatRelativeDate, isDealRotten } from '@/themes/crm/lib/crm-utils'
import { Building2, Clock, AlertTriangle, TrendingUp } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

export interface Deal {
    id: string
    name: string
    companyId: string
    companyName?: string
    amount: number
    currency?: string
    probability: number
    assignedTo?: string
    assignedToName?: string
    updatedAt: string | Date
    stageId: string
}

interface DealCardProps {
    deal: Deal
    onClick?: () => void
    isDragging?: boolean
    rottenDays?: number
}

// Probability color based on percentage
const getProbabilityStyle = (probability: number) => {
    if (probability >= 75) return { bg: 'bg-emerald-500/10', text: 'text-emerald-600', fill: 'bg-emerald-500' }
    if (probability >= 50) return { bg: 'bg-amber-500/10', text: 'text-amber-600', fill: 'bg-amber-500' }
    if (probability >= 25) return { bg: 'bg-orange-500/10', text: 'text-orange-600', fill: 'bg-orange-500' }
    return { bg: 'bg-muted', text: 'text-muted-foreground', fill: 'bg-muted-foreground' }
}

export function DealCard({ deal, onClick, isDragging, rottenDays = 30 }: DealCardProps) {
    const isRotten = isDealRotten(deal.updatedAt, rottenDays)
    const probStyle = getProbabilityStyle(deal.probability)

    return (
        <div
            className={cn(
                'bg-card border rounded-xl p-4 transition-all duration-200 cursor-grab active:cursor-grabbing',
                'hover:shadow-md hover:border-primary/30',
                isDragging && 'opacity-50 shadow-lg scale-105 rotate-2',
                isRotten && 'border-l-4 border-l-destructive'
            )}
            onClick={onClick}
            role="button"
            tabIndex={0}
            data-cy={`deal-card-${deal.id}`}
        >
            {/* Header */}
            <div className="mb-3">
                <h4 className="font-semibold text-sm text-foreground leading-tight mb-1 line-clamp-2" data-cy={`deal-card-name-${deal.id}`}>
                    {deal.name}
                </h4>

                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="w-3 h-3" />
                    <span className="truncate" data-cy={`deal-card-company-${deal.id}`}>{deal.companyName || 'No company'}</span>
                </div>
            </div>

            {/* Amount and Probability */}
            <div className="flex items-end justify-between mb-3">
                <div className="font-bold text-lg text-primary" data-cy={`deal-card-amount-${deal.id}`}>
                    {formatCurrency(deal.amount, deal.currency || 'USD')}
                </div>

                <div className={cn('flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium', probStyle.bg, probStyle.text)}>
                    <TrendingUp className="w-3 h-3" />
                    {deal.probability}%
                </div>
            </div>

            {/* Probability bar */}
            <div className="h-1.5 bg-muted rounded-full overflow-hidden mb-3">
                <div
                    className={cn('h-full rounded-full transition-all duration-300', probStyle.fill)}
                    style={{ width: `${deal.probability}%` }}
                />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between">
                {deal.assignedToName ? (
                    <div className="flex items-center gap-1.5">
                        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                            {deal.assignedToName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </div>
                        <span className="text-xs text-muted-foreground truncate max-w-[80px]">
                            {deal.assignedToName.split(' ')[0]}
                        </span>
                    </div>
                ) : (
                    <span className="text-xs text-muted-foreground">Unassigned</span>
                )}

                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatRelativeDate(deal.updatedAt)}</span>
                </div>
            </div>

            {/* Rotten warning */}
            {isRotten && (
                <div className="mt-3 pt-3 border-t border-destructive/20 flex items-center gap-1.5 text-xs text-destructive font-medium">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    <span>Needs attention - no activity for {rottenDays}+ days</span>
                </div>
            )}
        </div>
    )
}

export default DealCard
