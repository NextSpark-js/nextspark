/**
 * Pipeline Kanban Page
 * Page template for viewing a pipeline in Kanban view
 */

'use client'

import { useParams, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { PipelineKanban } from '@/themes/crm/templates/shared/PipelineKanban'
import type { Stage } from '@/themes/crm/templates/shared/StageColumn'
import type { Deal } from '@/themes/crm/templates/shared/DealCard'
import { fetchWithTeam } from '@nextsparkjs/core/lib/api/entities'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'

// This page will be rendered at /dashboard/pipelines/[id]
export default function PipelineKanbanPage() {
    const params = useParams()
    const router = useRouter()
    const pipelineId = params.id as string
    const { currentTeam, isLoading: teamLoading } = useTeamContext()

    const [pipeline, setPipeline] = useState<any>(null)
    const [deals, setDeals] = useState<Deal[]>([])
    const [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        // Wait for team context to be ready
        if (teamLoading || !currentTeam) {
            return
        }

        async function fetchPipelineData() {
            try {
                // Fetch pipeline details
                const pipelineRes = await fetchWithTeam(`/api/v1/pipelines/${pipelineId}`)
                if (!pipelineRes.ok) throw new Error('Failed to fetch pipeline')
                const pipelineResult = await pipelineRes.json()
                const pipelineData = pipelineResult.data

                // Fetch opportunities for this pipeline
                const dealsRes = await fetchWithTeam(`/api/v1/opportunities?pipelineId=${pipelineId}`)
                if (!dealsRes.ok) throw new Error('Failed to fetch opportunities')
                const dealsResult = await dealsRes.json()
                const dealsData = dealsResult.data || []

                // Transform pipeline data
                const transformedPipeline = {
                    id: pipelineData.id,
                    name: pipelineData.name,
                    stages: (pipelineData.stages as any[]).sort((a, b) => a.order - b.order),
                }

                // Transform deals data
                const transformedDeals: Deal[] = dealsData.map((opp: any) => ({
                    id: opp.id,
                    name: opp.name,
                    companyId: opp.companyId,
                    companyName: opp.companyName || 'Unknown Company',
                    amount: opp.amount || 0,
                    currency: opp.currency || 'USD',
                    probability: opp.probability || 0,
                    assignedTo: opp.assignedTo,
                    assignedToName: opp.assignedToName,
                    updatedAt: opp.updatedAt,
                    stageId: opp.stageId,
                }))

                setPipeline(transformedPipeline)
                setDeals(transformedDeals)
            } catch (error) {
                console.error('Error loading pipeline:', error)
            } finally {
                setIsLoading(false)
            }
        }

        fetchPipelineData()
    }, [pipelineId, teamLoading, currentTeam])

    const handleDealClick = (deal: Deal) => {
        router.push(`/dashboard/opportunities/${deal.id}`)
    }

    const handleDealMove = async (dealId: string, fromStageId: string, toStageId: string) => {
        try {
            const response = await fetchWithTeam(`/api/v1/opportunities/${dealId}`, {
                method: 'PATCH',
                body: JSON.stringify({ stageId: toStageId }),
            })

            if (!response.ok) {
                throw new Error('Failed to update deal stage')
            }

            // Update local state
            setDeals(prev => prev.map(d =>
                d.id === dealId ? { ...d, stageId: toStageId } : d
            ))
        } catch (error) {
            console.error('Error moving deal:', error)
            throw error
        }
    }

    const handleAddDeal = () => {
        router.push(`/dashboard/opportunities/create?pipelineId=${pipelineId}`)
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <div className="crm-skeleton w-64 h-8 mx-auto mb-4"></div>
                    <div className="crm-skeleton w-48 h-4 mx-auto"></div>
                </div>
            </div>
        )
    }

    if (!pipeline) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="text-center">
                    <h2 className="text-xl font-semibold text-gray-800">Pipeline not found</h2>
                    <p className="text-gray-600 mt-2">The requested pipeline could not be loaded.</p>
                </div>
            </div>
        )
    }

    return (
        <div className="p-6">
            <PipelineKanban
                pipeline={pipeline}
                deals={deals}
                onDealClick={handleDealClick}
                onDealMove={handleDealMove}
                onAddDeal={handleAddDeal}
            />
        </div>
    )
}
