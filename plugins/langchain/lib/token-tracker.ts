/**
 * Token Tracker Service
 *
 * Tracks token usage and calculates costs per request.
 * Integrates with LangChain callbacks for automatic tracking.
 */

import { mutateWithRLS, queryWithRLS } from '@nextsparkjs/core/lib/db'
import type { AgentContext } from '../types/langchain.types'

interface TokenUsage {
    inputTokens: number
    outputTokens: number
    totalTokens: number
}

interface TrackUsageParams {
    context: AgentContext
    sessionId?: string
    provider: string
    model: string
    usage: TokenUsage
    agentName?: string
    metadata?: Record<string, unknown>
}

interface UsageStats {
    totalTokens: number
    totalCost: number
    inputTokens: number
    outputTokens: number
    requestCount: number
    byModel: Record<string, { tokens: number; cost: number }>
}

type Period = 'today' | '7d' | '30d' | 'all'

// Pricing per 1M tokens (USD)
const DEFAULT_PRICING: Record<string, { input: number; output: number }> = {
    'gpt-4o': { input: 5.00, output: 15.00 },
    'gpt-4o-mini': { input: 0.15, output: 0.60 },
    'gpt-4-turbo': { input: 10.00, output: 30.00 },
    'gpt-3.5-turbo': { input: 0.50, output: 1.50 },
    'claude-3-5-sonnet': { input: 3.00, output: 15.00 },
    'claude-3-opus': { input: 15.00, output: 75.00 },
    'claude-3-haiku': { input: 0.25, output: 1.25 },
    // Ollama models are free (local)
    'ollama/*': { input: 0, output: 0 },
}

export const tokenTracker = {
    /**
     * Calculate cost for token usage
     */
    calculateCost(model: string, usage: TokenUsage, customPricing?: typeof DEFAULT_PRICING): {
        inputCost: number
        outputCost: number
        totalCost: number
    } {
        const pricing = customPricing || DEFAULT_PRICING

        // Check for exact match first, then wildcard
        let modelPricing = pricing[model]
        if (!modelPricing) {
            // Check for provider wildcard (e.g., 'ollama/*')
            const provider = model.split('/')[0] || model.split('-')[0]
            modelPricing = pricing[`${provider}/*`] || { input: 0, output: 0 }
        }

        const inputCost = (usage.inputTokens / 1_000_000) * modelPricing.input
        const outputCost = (usage.outputTokens / 1_000_000) * modelPricing.output

        return {
            inputCost,
            outputCost,
            totalCost: inputCost + outputCost,
        }
    },

    /**
     * Track token usage for a request
     */
    async trackUsage(params: TrackUsageParams): Promise<void> {
        const { context, sessionId, provider, model, usage, agentName, metadata } = params
        const { userId, teamId } = context

        const costs = this.calculateCost(model, usage)

        await mutateWithRLS(
            `INSERT INTO public."langchain_token_usage"
             (id, "userId", "teamId", "sessionId", provider, model,
              "inputTokens", "outputTokens", "totalTokens",
              "inputCost", "outputCost", "totalCost",
              "agentName", metadata)
             VALUES (gen_random_uuid()::text, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
            [
                userId, teamId, sessionId || null, provider, model,
                usage.inputTokens, usage.outputTokens, usage.totalTokens,
                costs.inputCost, costs.outputCost, costs.totalCost,
                agentName || null, JSON.stringify(metadata || {})
            ],
            userId
        )
    },

    /**
     * Get usage statistics for a user
     */
    async getUsage(context: AgentContext, period: Period = '30d'): Promise<UsageStats> {
        const { userId, teamId } = context

        const periodClause = this.getPeriodClause(period)

        const result = await queryWithRLS<{
            totalTokens: string
            totalCost: string
            inputTokens: string
            outputTokens: string
            requestCount: string
            model: string
            modelTokens: string
            modelCost: string
        }>(
            `SELECT
                SUM("totalTokens")::text as "totalTokens",
                SUM("totalCost")::text as "totalCost",
                SUM("inputTokens")::text as "inputTokens",
                SUM("outputTokens")::text as "outputTokens",
                COUNT(*)::text as "requestCount",
                model,
                SUM("totalTokens")::text as "modelTokens",
                SUM("totalCost")::text as "modelCost"
             FROM public."langchain_token_usage"
             WHERE "userId" = $1 AND "teamId" = $2 ${periodClause}
             GROUP BY model`,
            [userId, teamId],
            userId
        )

        if (!result.length) {
            return {
                totalTokens: 0,
                totalCost: 0,
                inputTokens: 0,
                outputTokens: 0,
                requestCount: 0,
                byModel: {},
            }
        }

        // Aggregate results
        const byModel: Record<string, { tokens: number; cost: number }> = {}
        let totalTokens = 0
        let totalCost = 0
        let inputTokens = 0
        let outputTokens = 0
        let requestCount = 0

        for (const row of result) {
            byModel[row.model] = {
                tokens: parseInt(row.modelTokens, 10),
                cost: parseFloat(row.modelCost),
            }
            totalTokens += parseInt(row.totalTokens || '0', 10)
            totalCost += parseFloat(row.totalCost || '0')
            inputTokens += parseInt(row.inputTokens || '0', 10)
            outputTokens += parseInt(row.outputTokens || '0', 10)
            requestCount += parseInt(row.requestCount || '0', 10)
        }

        return {
            totalTokens,
            totalCost,
            inputTokens,
            outputTokens,
            requestCount,
            byModel,
        }
    },

    /**
     * Get daily usage for charts
     */
    async getDailyUsage(context: AgentContext, days: number = 30): Promise<Array<{
        date: string
        tokens: number
        cost: number
        requests: number
    }>> {
        const { userId, teamId } = context

        // Validate days parameter to prevent SQL injection (must be positive integer)
        const safeDays = Math.max(1, Math.min(365, Math.floor(Number(days) || 30)))

        const result = await queryWithRLS<{
            date: string
            tokens: string
            cost: string
            requests: string
        }>(
            `SELECT
                DATE("createdAt")::text as date,
                SUM("totalTokens")::text as tokens,
                SUM("totalCost")::text as cost,
                COUNT(*)::text as requests
             FROM public."langchain_token_usage"
             WHERE "userId" = $1 AND "teamId" = $2
               AND "createdAt" >= now() - ($3 || ' days')::interval
             GROUP BY DATE("createdAt")
             ORDER BY date DESC`,
            [userId, teamId, safeDays.toString()],
            userId
        )

        return result.map(row => ({
            date: row.date,
            tokens: parseInt(row.tokens, 10),
            cost: parseFloat(row.cost),
            requests: parseInt(row.requests, 10),
        }))
    },

    /**
     * Get team usage (admin only)
     */
    async getTeamUsage(teamId: string, period: Period = '30d'): Promise<UsageStats & {
        byUser: Record<string, { tokens: number; cost: number }>
    }> {
        const periodClause = this.getPeriodClause(period)

        // This bypasses RLS - caller must verify admin permissions
        const result = await queryWithRLS<{
            userId: string
            totalTokens: string
            totalCost: string
            inputTokens: string
            outputTokens: string
            requestCount: string
        }>(
            `SELECT
                "userId",
                SUM("totalTokens")::text as "totalTokens",
                SUM("totalCost")::text as "totalCost",
                SUM("inputTokens")::text as "inputTokens",
                SUM("outputTokens")::text as "outputTokens",
                COUNT(*)::text as "requestCount"
             FROM public."langchain_token_usage"
             WHERE "teamId" = $1 ${periodClause}
             GROUP BY "userId"`,
            [teamId],
            'admin' // Use admin context for team-wide queries
        )

        const byUser: Record<string, { tokens: number; cost: number }> = {}
        let totalTokens = 0
        let totalCost = 0
        let inputTokens = 0
        let outputTokens = 0
        let requestCount = 0

        for (const row of result) {
            byUser[row.userId] = {
                tokens: parseInt(row.totalTokens, 10),
                cost: parseFloat(row.totalCost),
            }
            totalTokens += parseInt(row.totalTokens || '0', 10)
            totalCost += parseFloat(row.totalCost || '0')
            inputTokens += parseInt(row.inputTokens || '0', 10)
            outputTokens += parseInt(row.outputTokens || '0', 10)
            requestCount += parseInt(row.requestCount || '0', 10)
        }

        return {
            totalTokens,
            totalCost,
            inputTokens,
            outputTokens,
            requestCount,
            byModel: {}, // Not grouped by model for team view
            byUser,
        }
    },

    // Helper: Get SQL period clause
    getPeriodClause(period: Period): string {
        switch (period) {
            case 'today':
                return `AND "createdAt" >= CURRENT_DATE`
            case '7d':
                return `AND "createdAt" >= now() - interval '7 days'`
            case '30d':
                return `AND "createdAt" >= now() - interval '30 days'`
            case 'all':
            default:
                return ''
        }
    },
}
