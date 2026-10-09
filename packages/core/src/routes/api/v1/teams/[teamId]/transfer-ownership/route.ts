import { NextRequest, NextResponse } from 'next/server'
import * as z from 'zod'
import { getAuthorizationSession } from '@nextsparkjs/core/lib/auth/authorization-session'
import { withRateLimitTier } from '@nextsparkjs/core/lib/api/rate-limit'
import { corsPreflight } from '@nextsparkjs/core/lib/api/cors-response'
import { createApiResponse, createApiError } from '@nextsparkjs/core/lib/api/helpers'
import { TeamMemberService } from '@nextsparkjs/core/lib/services/team-member.service'

const transferSchema = z.object({ newOwnerId: z.string().min(1) })

const ERRORS: Record<string, [number, string]> = {
  SAME_OWNER: [400, 'New owner must be different from current owner'],
  NOT_OWNER: [403, 'Only the team owner can transfer ownership'],
  NOT_A_MEMBER: [404, 'New owner must be a member of this team'],
}

/**
 * POST /api/v1/teams/:teamId/transfer-ownership
 *
 * The team's owner hands the team to a current member: the member becomes owner and the caller becomes admin.
 * Body: { newOwnerId: string } (the member's user id). Session only, as account deletion: an API key cannot
 * transfer a team.
 */
export const POST = withRateLimitTier(async (
  req: NextRequest,
  { params }: { params: Promise<{ teamId: string }> }
) => {
  const session = await getAuthorizationSession(req.headers)
  if (!session?.user) {
    return createApiError('Authentication required', 401)
  }

  const parsed = transferSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return createApiError('Invalid request body', 400, { errors: parsed.error.issues })
  }

  const { teamId } = await params
  try {
    const result = await TeamMemberService.transferOwnership(teamId, parsed.data.newOwnerId, session.user.id)
    return createApiResponse(result)
  } catch (error) {
    const known = ERRORS[(error as { code?: string })?.code ?? '']
    if (known) {
      return createApiError(known[1], known[0], null, (error as { code: string }).code)
    }
    console.error('[Transfer ownership API] Error:', error)
    return createApiError('Failed to transfer ownership', 500)
  }
}, 'strict')

export const OPTIONS = corsPreflight
