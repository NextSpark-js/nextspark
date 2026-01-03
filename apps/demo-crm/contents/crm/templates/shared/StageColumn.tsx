/**
 * Stage Column Component
 * Professional Kanban column with drag-drop support
 */

'use client'

import React, { useState } from 'react'
import { DealCard, type Deal } from './DealCard'
import { formatCurrency } from '@/themes/crm/lib/crm-utils'
import { Inbox, Plus } from 'lucide-react'
import { cn } from '@nextsparkjs/core/lib/utils'

export interface Stage {
    id: string
    name: string
    order: number
    probability: number
    color: string
}

interface StageColumnProps {
    stage: Stage
    deals: Deal[]
    onDealClick?: (deal: Deal) => void
    onDrop?: (dealId: string, stageId: string) => void
    onAddDeal?: (stageId: string) => void
}

export function StageColumn({ stage, deals, onDealClick, onDrop, onAddDeal }: StageColumnProps) {
    const [isDragOver, setIsDragOver] = useState(false)
    const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0)
    const avgCurrency = deals[0]?.currency || 'USD'
    const weightedValue = deals.reduce((sum, deal) => sum + (deal.amount * deal.probability / 100), 0)

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(true)
    }

    const handleDragLeave = () => {
        setIsDragOver(false)
    }

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault()
        setIsDragOver(false)
        const dealId = e.dataTransfer.getData('dealId')
        if (dealId && onDrop) {
            onDrop(dealId, stage.id)
        }
    }

    return (
        <div
            className={cn(
                'flex flex-col w-[320px] shrink-0 rounded-xl transition-all duration-200 border border-border/60 bg-muted/40 shadow-sm',
                isDragOver && 'ring-2 ring-primary ring-offset-2 bg-primary/5'
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            data-cy={`stage-column-${stage.id}`}
        >
            {/* Header */}
            <div className="bg-card border-b border-border/60 rounded-t-xl p-4" data-cy={`stage-column-header-${stage.id}`}>
                <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: stage.color }}
                        />
                        <h3 className="font-semibold text-sm text-foreground">
                            {stage.name}
                        </h3>
                    </div>
                    <span className="px-2 py-0.5 bg-muted rounded-md text-xs font-medium text-muted-foreground">
                        {deals.length}
                    </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                        <p className="text-muted-foreground mb-0.5">Total Value</p>
                        <p className="font-semibold text-foreground">
                            {formatCurrency(totalAmount, avgCurrency)}
                        </p>
                    </div>
                    <div>
                        <p className="text-muted-foreground mb-0.5">Weighted</p>
                        <p className="font-semibold text-primary">
                            {formatCurrency(weightedValue, avgCurrency)}
                        </p>
                    </div>
                </div>

                {/* Progress bar showing probability */}
                <div className="mt-3 h-1 bg-muted rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-300"
                        style={{
                            width: `${stage.probability}%`,
                            backgroundColor: stage.color
                        }}
                    />
                </div>
            </div>

            {/* Deals list */}
            <div
                className={cn(
                    'flex-1 bg-muted/50 rounded-b-xl p-3 space-y-2 min-h-[300px] max-h-[calc(100vh-320px)] overflow-y-auto',
                    isDragOver && 'bg-primary/10'
                )}
                data-cy={`stage-column-deals-${stage.id}`}
            >
                {deals.map((deal, index) => (
                    <div
                        key={deal.id}
                        draggable
                        className="animate-in fade-in slide-in-from-top-2"
                        style={{ animationDelay: `${index * 30}ms`, animationFillMode: 'backwards' }}
                        onDragStart={(e) => {
                            e.dataTransfer.setData('dealId', deal.id)
                            e.currentTarget.style.opacity = '0.5'
                        }}
                        onDragEnd={(e) => {
                            e.currentTarget.style.opacity = '1'
                        }}
                    >
                        <DealCard
                            deal={deal}
                            onClick={() => onDealClick?.(deal)}
                        />
                    </div>
                ))}

                {deals.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center" data-cy={`stage-column-empty-${stage.id}`}>
                        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mb-3">
                            <Inbox className="w-6 h-6 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground mb-3">
                            No deals in this stage
                        </p>
                        {onAddDeal && (
                            <button
                                onClick={() => onAddDeal(stage.id)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                                data-cy={`stage-column-add-deal-${stage.id}`}
                            >
                                <Plus className="w-3.5 h-3.5" />
                                Add deal
                            </button>
                        )}
                    </div>
                )}

                {/* Add deal button at bottom */}
                {deals.length > 0 && onAddDeal && (
                    <button
                        onClick={() => onAddDeal(stage.id)}
                        className="w-full py-3 border-2 border-dashed border-border rounded-xl text-sm text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                        data-cy={`stage-column-add-deal-${stage.id}`}
                    >
                        <Plus className="w-4 h-4" />
                        Add deal
                    </button>
                )}
            </div>
        </div>
    )
}

export default StageColumn
