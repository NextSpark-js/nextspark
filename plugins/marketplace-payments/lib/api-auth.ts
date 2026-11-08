import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest, createAuthFailureResponse, resolveTeamContext } from '@nextsparkjs/core/lib/api/auth/dual-auth'
import { MembershipService } from '@nextsparkjs/core/lib/services'

export async function canManageTeamBilling(userId: string, teamId: string): Promise<boolean> {
  const membership = await MembershipService.get(userId, teamId)
  return membership.canPerformAction('team.billing.manage').allowed
}

const forbidden = () => NextResponse.json({ success: false, error: 'Forbidden' }, { status: 403 })

/**
 * The signed-in user that manages the billing of the active team, or the response to give. Session only: connecting a
 * seller or reading its payments is not an API-key operation.
 */
export async function requireTeamManager(request: NextRequest): Promise<{ userId: string; teamId: string; email: string } | NextResponse> {
  const auth = await authenticateRequest(request)
  if (!auth.success || !auth.user) return createAuthFailureResponse(auth) as NextResponse
  if (auth.type !== 'session') return forbidden()
  const teamId = await resolveTeamContext(request, auth)
  if (teamId instanceof NextResponse) return teamId
  if (!(await canManageTeamBilling(auth.user.id, teamId))) return forbidden()
  return { userId: auth.user.id, teamId, email: auth.user.email }
}
