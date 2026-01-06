'use client'

import { useQuery } from '@tanstack/react-query'
import { useTeamContext } from '@nextsparkjs/core/contexts/TeamContext'

type Period = 'today' | '7d' | '30d' | 'all'

interface UsageStats {
    totalTokens: number
    totalCost: number
    inputTokens: number
    outputTokens: number
    requestCount: number
    byModel: Record<string, { tokens: number; cost: number }>
}

interface DailyUsage {
    date: string
    tokens: number
    cost: number
    requests: number
}

interface UsageResponse {
    success: boolean
    data: {
        stats: UsageStats
        daily: DailyUsage[]
        period: Period
        type: 'user' | 'team'
    }
    error?: string
}

export function useTokenUsage(period: Period = '30d', type: 'user' | 'team' = 'user') {
    const { currentTeam } = useTeamContext()

    return useQuery<UsageResponse>({
        queryKey: ['ai-usage', period, type],
        queryFn: async () => {
            const headers: Record<string, string> = {
                'Content-Type': 'application/json'
            }

            // Include team context
            if (currentTeam?.id) {
                headers['x-team-id'] = currentTeam.id
            }

            const response = await fetch(`/api/v1/theme/default/ai/usage?period=${period}&type=${type}`, {
                headers
            })

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}))
                throw new Error(errorData.error || 'Failed to fetch usage')
            }

            return response.json()
        },
        enabled: !!currentTeam?.id,
    })
}
