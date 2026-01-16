/**
 * ============================================================================
 * TOKEN USAGE API ENDPOINT
 * ============================================================================
 *
 * Provides token usage statistics for users and teams.
 * Supports different time periods and user/team views.
 *
 * GET /api/ai/usage
 *   Query params:
 *     - period: 'today' | '7d' | '30d' | 'all' (default: '30d')
 *     - type: 'user' | 'team' (default: 'user')
 *
 * Returns:
 *   - stats: Aggregated usage statistics
 *   - daily: Daily breakdown for charts
 *
 * ============================================================================
 */

import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { tokenTracker } from '@/plugins/langchain/lib/token-tracker'
import { queryOne } from '@nextsparkjs/core/lib/db'

type Period = 'today' | '7d' | '30d' | 'all'

/**
 * GET - Retrieve token usage statistics
 */
const getHandler = async (request: NextRequest) => {
    try {
        // 1. Authentication
        const authResult = await authenticateRequest(request)
        if (!authResult.success || !authResult.user) {
            return NextResponse.json(
                { success: false, error: 'Unauthorized' },
                { status: 401 }
            )
        }

        // 2. Team context
        const teamId = request.headers.get('x-team-id')
        if (!teamId) {
            return NextResponse.json(
                { success: false, error: 'Team context required', code: 'TEAM_CONTEXT_REQUIRED' },
                { status: 400 }
            )
        }

        const userId = authResult.user.id

        // 3. Parse query parameters
        const { searchParams } = new URL(request.url)
        const period = (searchParams.get('period') || '30d') as Period
        const type = searchParams.get('type') || 'user'

        // Validate period
        if (!['today', '7d', '30d', 'all'].includes(period)) {
            return NextResponse.json(
                { success: false, error: 'Invalid period. Must be: today, 7d, 30d, or all' },
                { status: 400 }
            )
        }

        // 4. Check permissions for team usage
        if (type === 'team') {
            // Get user's team role to check if they're admin
            const teamMembership = await queryOne<{ role: string }>(
                `SELECT role FROM public.team_members
                 WHERE "userId" = $1 AND "teamId" = $2`,
                [userId, teamId]
            )

            const isTeamAdmin = teamMembership?.role === 'admin' || teamMembership?.role === 'owner'

            if (!isTeamAdmin) {
                return NextResponse.json(
                    { success: false, error: 'Team usage requires admin permissions' },
                    { status: 403 }
                )
            }
        }

        const context = {
            userId,
            teamId,
        }

        // 5. Fetch usage statistics
        const [stats, daily] = await Promise.all([
            type === 'team'
                ? tokenTracker.getTeamUsage(teamId, period)
                : tokenTracker.getUsage(context, period),
            tokenTracker.getDailyUsage(
                context,
                period === 'all' ? 365 : period === '30d' ? 30 : period === '7d' ? 7 : 1
            ),
        ])

        // 6. Return results
        return NextResponse.json({
            success: true,
            data: {
                stats,
                daily,
                period,
                type,
            },
        })
    } catch (error) {
        console.error('[AI Usage] Error:', error)
        return NextResponse.json(
            {
                success: false,
                error: 'Failed to retrieve usage statistics',
                details: error instanceof Error ? error.message : 'Unknown error',
            },
            { status: 500 }
        )
    }
}

export const GET = withRateLimitTier(getHandler, 'read')
