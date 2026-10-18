/**
 * Team Invitation Service
 *
 * Creates a pending team invitation: the permission, role-hierarchy, duplicate checks, the row and the email.
 * `POST /api/v1/teams/:teamId/members` and the `inviteMember` Server Action both go through it, so they
 * refuse and accept the same requests. The invitee accepts through `/accept-invite/:token`.
 *
 * @module TeamInvitationService
 */

import { queryOneWithRLS, mutateWithRLS } from '../db'
import { checkRateLimit } from '../api/rate-limit'
import { RATE_LIMITS } from '../api/keys'
import { inviteMemberSchema } from '../teams/schema'
import { canInviteToRole } from '../teams/permissions'
import { MembershipService } from './membership.service'
import { EmailFactory } from '../email/factory'
import { sendTeamInvitationEmail } from '../email/send'
import { I18N_CONFIG, APP_NAME } from '../config'
import { withBasePath } from '../base-path'
import type { Team, TeamInvitation, TeamRole } from '../teams/types'

export interface CreateInvitationParams {
  teamId: string
  /** The inviter: id from the session, never from the client */
  actor: { id: string; email: string }
  /** Unvalidated `{ email, role }`: parsed with `inviteMemberSchema` after the permission check (a ZodError is thrown) */
  input: unknown
}

export type CreateInvitationResult =
  | { success: true; invitation: TeamInvitation }
  | {
      success: false
      status: number
      code: string
      error: string
      /** Extra fields of the refusal (the REST body adds them next to `error`) */
      details?: Record<string, unknown>
    }

export class TeamInvitationService {
  static async create({ teamId, actor, input }: CreateInvitationParams): Promise<CreateInvitationResult> {
    // 20 invitations per minute and inviter
    const rateLimitConfig = RATE_LIMITS['teams:invite']
    const rateLimit = checkRateLimit(`invite:create:${actor.id}`, rateLimitConfig.requests, rateLimitConfig.windowMs)
    if (!rateLimit.allowed) {
      return {
        success: false,
        status: 429,
        code: 'RATE_LIMIT_EXCEEDED',
        error: 'Rate limit exceeded. Please try again later.',
        details: { retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000) },
      }
    }

    if (!teamId || teamId.trim() === '') {
      return { success: false, status: 400, code: 'MISSING_TEAM_ID', error: 'Team ID is required' }
    }

    const membership = await MembershipService.get(actor.id, teamId)
    const actionResult = membership.canPerformAction('team.members.invite')
    if (actionResult.allowed === false) {
      return {
        success: false,
        status: 403,
        code: 'FORBIDDEN',
        error: actionResult.message ?? 'Permission denied',
        details: { reason: actionResult.reason, meta: actionResult.meta },
      }
    }
    const actorRole = membership.role as TeamRole

    const { email, role } = inviteMemberSchema.parse(input)

    // Users can only invite to roles below their own (the role-change rule)
    if (!canInviteToRole(actorRole, role)) {
      return {
        success: false,
        status: 403,
        code: 'ROLE_HIERARCHY_VIOLATION',
        error: `You cannot invite members to a role higher than your own. Your role: ${actorRole}, requested role: ${role}`,
      }
    }

    const existingUser = await queryOneWithRLS<{ id: string }>(
      'SELECT id FROM "users" WHERE email = $1',
      [email],
      actor.id
    )
    if (existingUser) {
      const existingMember = await queryOneWithRLS<{ id: string }>(
        'SELECT id FROM "team_members" WHERE "teamId" = $1 AND "userId" = $2',
        [teamId, existingUser.id],
        actor.id
      )
      if (existingMember) {
        return { success: false, status: 409, code: 'ALREADY_MEMBER', error: 'User is already a member of this team' }
      }
    }

    const existingInvitation = await queryOneWithRLS<TeamInvitation>(
      `SELECT * FROM "team_invitations"
       WHERE "teamId" = $1 AND email = $2 AND status = 'pending'`,
      [teamId, email],
      actor.id
    )
    if (existingInvitation) {
      return {
        success: false,
        status: 409,
        code: 'INVITATION_EXISTS',
        error: 'A pending invitation already exists for this email',
      }
    }

    const team = await queryOneWithRLS<Team>('SELECT * FROM "teams" WHERE id = $1', [teamId], actor.id)
    if (!team) {
      return { success: false, status: 404, code: 'TEAM_NOT_FOUND', error: 'Team not found' }
    }

    const token = globalThis.crypto.randomUUID()
    const expiresAt = new Date()
    expiresAt.setDate(expiresAt.getDate() + 7) // Expires in 7 days

    const result = await mutateWithRLS<TeamInvitation>(
      `INSERT INTO "team_invitations" ("teamId", email, role, status, token, "invitedBy", "expiresAt")
       VALUES ($1, $2, $3, 'pending', $4, $5, $6)
       RETURNING *`,
      [teamId, email, role, token, actor.id, expiresAt.toISOString()],
      actor.id
    )
    const invitation = result.rows[0]

    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5173').replace(/\/$/, '')
    const acceptUrl = `${baseUrl}${withBasePath(`/accept-invite/${token}`)}`

    try {
      const emailProvider = EmailFactory.getInstance()
      const inviterName = actor.email // Use email as inviter name
      const emailContent = await sendTeamInvitationEmail(
        {
          inviteeEmail: email,
          inviterName,
          teamName: team.name,
          role,
          acceptUrl,
          expiresIn: '7 days',
          appName: process.env.NEXT_PUBLIC_APP_NAME || APP_NAME,
        },
        I18N_CONFIG.defaultLocale
      )

      const sent = await emailProvider.send({ to: email, subject: emailContent.subject, html: emailContent.html })
      if (!sent.success) throw new Error(sent.error || 'The email provider did not send the invitation')

      // Development only (to accept an invitation without an inbox): the accept URL is a credential
      if (process.env.NODE_ENV === 'development') {
        console.log('\n' + '🎫'.repeat(30))
        console.log('📨 TEAM INVITATION CREATED')
        console.log('🎫'.repeat(30))
        console.log(`📧 To: ${email}`)
        console.log(`👤 Invited by: ${inviterName}`)
        console.log(`🏢 Team: ${team.name}`)
        console.log(`👑 Role: ${role}`)
        console.log(`🔗 Accept URL: ${acceptUrl}`)
        console.log('🎫'.repeat(30) + '\n')
      }
    } catch (emailError) {
      // An invitation nobody received must not look sent: remove it, so the inviter sees the error and can retry
      console.error('Failed to send invitation email:', emailError)
      try {
        const removed = await mutateWithRLS('DELETE FROM "team_invitations" WHERE id = $1', [invitation.id], actor.id)
        if (removed.rowCount === 0) console.warn(`Invitation ${invitation.id} was not removed after its email failed (no row deleted); the inviter can cancel it`)
      } catch (deleteError) {
        // The inviter still gets the send failure; the pending row can be cancelled from the members page
        console.error(`Invitation ${invitation.id} could not be removed after its email failed:`, deleteError)
      }
      return {
        success: false,
        status: 503,
        code: 'EMAIL_SEND_FAILED',
        error: 'The invitation email could not be sent. Try again later.',
      }
    }

    return { success: true, invitation }
  }
}
