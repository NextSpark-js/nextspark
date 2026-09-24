/**
 * Pipeline Kanban Component
 * Professional Kanban board with stats and drag-drop
 */

'use client'

import React, { useState, useCallback } from 'react'
import { StageColumn, type Stage } from './StageColumn'
import { type Deal } from './DealCard'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    Plus,
    Target,
    DollarSign,
    TrendingUp,
    BarChart3,
    Loader2
} from 'lucide-react'

interface Pipeline {
    id: string
    name: string
    stages: Stage[]
}

interface PipelineKanbanProps {
    pipeline: Pipeline
    deals: Deal[]
    onDealClick?: (deal: Deal) => void
    onDealMove?: (dealId: string, fromStageId: string, toStageId: string) => Promise<void>
    onAddDeal?: (stageId?: string) => void
}

export function PipelineKanban({
    pipeline,
    deals: initialDeals,
    onDealClick,
    onDealMove,
    onAddDeal,
}: PipelineKanbanProps) {
    const [deals, setDeals] = useState(initialDeals)
    const [isMoving, setIsMoving] = useState(false)

    // Group deals by stage
    const dealsByStage = pipeline.stages.reduce((acc, stage) => {
        acc[stage.id] = deals.filter(deal => deal.stageId === stage.id)
        return acc
    }, {} as Record<string, Deal[]>)

    // Calculate pipeline stats
    const totalValue = deals.reduce((sum, d) => sum + d.amount, 0)
    const weightedValue = deals.reduce((sum, d) => sum + (d.amount * d.probability / 100), 0)
    const avgDealSize = deals.length > 0 ? totalValue / deals.length : 0
    const currency = deals[0]?.currency || 'USD'

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: currency,
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(value)
    }

    const handleDrop = useCallback(async (dealId: string, targetStageId: string) => {
        const deal = deals.find(d => d.id === dealId)
        if (!deal || deal.stageId === targetStageId) return

        const previousStageId = deal.stageId

        // Optimistic update
        setDeals(prev => prev.map(d =>
            d.id === dealId ? { ...d, stageId: targetStageId } : d
        ))

        setIsMoving(true)

        try {
            await onDealMove?.(dealId, previousStageId, targetStageId)
        } catch (error) {
            // Revert on error
            setDeals(prev => prev.map(d =>
                d.id === dealId ? { ...d, stageId: previousStageId } : d
            ))
            console.error('Failed to move deal:', error)
        } finally {
            setIsMoving(false)
        }
    }, [deals, onDealMove])

    return (
        <div className="space-y-6" data-cy="pipeline-kanban">
            {/* Header */}
            <div className="flex items-start justify-between" data-cy="pipeline-kanban-header">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        {pipeline.name}
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        {pipeline.stages.length} stages • {deals.length} opportunities
                    </p>
                </div>

                <Button onClick={() => onAddDeal?.()} className="gap-2" data-cy="pipeline-kanban-add-deal-btn">
                    <Plus className="w-4 h-4" />
                    Add Deal
                </Button>
            </div>

            {/* Stats cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-cy="pipeline-kanban-stats">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{deals.length}</p>
                            <p className="text-xs text-muted-foreground">Open Deals</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <DollarSign className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalValue)}</p>
                            <p className="text-xs text-muted-foreground">Total Value</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                            <TrendingUp className="w-5 h-5 text-amber-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(weightedValue)}</p>
                            <p className="text-xs text-muted-foreground">Weighted Value</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <BarChart3 className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{formatCurrency(avgDealSize)}</p>
                            <p className="text-xs text-muted-foreground">Avg Deal Size</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Kanban Board */}
            <div className="overflow-x-auto pb-4 -mx-6 px-6" data-cy="pipeline-kanban-board">
                <div className="flex gap-4 min-w-max">
                    {pipeline.stages.map((stage, index) => (
                        <div
                            key={stage.id}
                            className="animate-in fade-in slide-in-from-bottom-3"
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                            <StageColumn
                                stage={stage}
                                deals={dealsByStage[stage.id] || []}
                                onDealClick={onDealClick}
                                onDrop={handleDrop}
                                onAddDeal={onAddDeal}
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* Moving indicator */}
            {isMoving && (
                <div className="fixed bottom-6 right-6 bg-primary text-primary-foreground px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-medium">Updating deal...</span>
                </div>
            )}
        </div>
    )
}

export default PipelineKanban
