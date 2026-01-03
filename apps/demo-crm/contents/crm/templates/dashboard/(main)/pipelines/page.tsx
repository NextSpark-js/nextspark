/**
 * Pipelines List Page
 * Professional landing page for sales pipelines
 */

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import {
    Plus,
    TrendingUp,
    Target,
    Layers,
    ArrowRight,
    Inbox
} from 'lucide-react'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'
import { cn } from '@nextsparkjs/core/lib/utils'
import { PermissionGate } from '@nextsparkjs/core/components/permissions/PermissionGate'

interface Pipeline {
    id: string
    name: string
    description?: string
    stages?: any[]
    isActive?: boolean
    totalValue?: number
    dealCount?: number
}

export default function PipelinesPage() {
    const router = useRouter()
    const { currentTeam, isLoading: teamLoading } = useTeamContext()
    const [pipelines, setPipelines] = useState<Pipeline[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (teamLoading || !currentTeam) return

        async function fetchPipelines() {
            try {
                const response = await fetchWithTeam('/api/v1/pipelines')
                if (!response.ok) throw new Error('Failed to fetch pipelines')
                const result = await response.json()
                setPipelines(result.data || [])
            } catch (error) {
                console.error('Error loading pipelines:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPipelines()
    }, [teamLoading, currentTeam])

    const handlePipelineClick = (pipelineId: string) => {
        router.push(`/dashboard/pipelines/${pipelineId}`)
    }

    const handleCreatePipeline = () => {
        router.push('/dashboard/pipelines/create')
    }

    // Stats
    const totalPipelines = pipelines.length
    const activePipelines = pipelines.filter(p => p.isActive !== false).length

    if (isLoading) {
        return (
            <div className="p-6 space-y-6">
                {/* Header skeleton */}
                <div className="flex items-center justify-between">
                    <div className="space-y-2">
                        <div className="h-8 w-48 bg-muted animate-pulse rounded-lg" />
                        <div className="h-4 w-64 bg-muted animate-pulse rounded-md" />
                    </div>
                    <div className="h-10 w-36 bg-muted animate-pulse rounded-lg" />
                </div>

                {/* Stats skeleton */}
                <div className="grid grid-cols-2 gap-4">
                    {[1, 2].map(i => (
                        <div key={i} className="h-20 bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>

                {/* Cards skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-48 bg-muted animate-pulse rounded-xl" />
                    ))}
                </div>
            </div>
        )
    }

    return (
        <div className="p-6 space-y-6">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground tracking-tight">
                        Sales Pipelines
                    </h1>
                    <p className="text-sm text-muted-foreground mt-1">
                        Manage your sales pipelines and track opportunities
                    </p>
                </div>
                <PermissionGate permission="pipelines.create">
                    <Button onClick={handleCreatePipeline} className="gap-2" data-cy="pipelines-add">
                        <Plus className="w-4 h-4" />
                        New Pipeline
                    </Button>
                </PermissionGate>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <Layers className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{totalPipelines}</p>
                            <p className="text-xs text-muted-foreground">Total Pipelines</p>
                        </div>
                    </div>
                </div>

                <div className="bg-card border rounded-xl p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                            <Target className="w-5 h-5 text-emerald-600" />
                        </div>
                        <div>
                            <p className="text-2xl font-bold text-foreground">{activePipelines}</p>
                            <p className="text-xs text-muted-foreground">Active</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pipeline Cards */}
            {pipelines.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" data-cy="pipelines-list">
                    {pipelines.map((pipeline, index) => (
                        <div
                            key={pipeline.id}
                            data-cy={`pipelines-row-${pipeline.id}`}
                            onClick={() => handlePipelineClick(pipeline.id)}
                            className={cn(
                                'bg-card border rounded-xl p-5 cursor-pointer transition-all duration-200',
                                'hover:shadow-md hover:border-primary/30 group',
                                'animate-in fade-in slide-in-from-bottom-3'
                            )}
                            style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'backwards' }}
                        >
                            {/* Header */}
                            <div className="flex items-start justify-between mb-4">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-foreground truncate mb-1">
                                        {pipeline.name}
                                    </h3>
                                    {pipeline.description && (
                                        <p className="text-sm text-muted-foreground line-clamp-2">
                                            {pipeline.description}
                                        </p>
                                    )}
                                </div>
                                <span className={cn(
                                    'px-2.5 py-1 rounded-md text-xs font-medium shrink-0 ml-3',
                                    pipeline.isActive !== false
                                        ? 'bg-emerald-500/10 text-emerald-600'
                                        : 'bg-muted text-muted-foreground'
                                )}>
                                    {pipeline.isActive !== false ? 'Active' : 'Inactive'}
                                </span>
                            </div>

                            {/* Stats */}
                            <div className="flex items-center gap-4 mb-4">
                                <div className="flex items-center gap-2 text-sm">
                                    <Layers className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-muted-foreground">
                                        {pipeline.stages?.length || 0} stages
                                    </span>
                                </div>
                                {pipeline.dealCount !== undefined && (
                                    <div className="flex items-center gap-2 text-sm">
                                        <Target className="w-4 h-4 text-muted-foreground" />
                                        <span className="text-muted-foreground">
                                            {pipeline.dealCount} deals
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* View button */}
                            <div className="flex items-center justify-between pt-4 border-t border-border/50">
                                <div className="flex items-center gap-2 text-sm font-medium text-primary group-hover:underline">
                                    <TrendingUp className="w-4 h-4" />
                                    View Kanban
                                </div>
                                <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-16 px-4" data-cy="pipelines-empty">
                    <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                        <Inbox className="w-8 h-8 text-muted-foreground" />
                    </div>
                    <h3 className="text-lg font-semibold text-foreground mb-2">
                        No pipelines yet
                    </h3>
                    <p className="text-sm text-muted-foreground text-center max-w-sm mb-6">
                        Create your first sales pipeline to start tracking opportunities and managing your deals.
                    </p>
                    <PermissionGate permission="pipelines.create">
                        <Button onClick={handleCreatePipeline} className="gap-2">
                            <Plus className="w-4 h-4" />
                            Create Pipeline
                        </Button>
                    </PermissionGate>
                </div>
            )}
        </div>
    )
}
