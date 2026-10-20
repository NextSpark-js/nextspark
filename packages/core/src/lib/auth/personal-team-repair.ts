/**
 * Personal Team Repair (#324)
 *
 * A user whose personal team was never created (a failure the sign-up could not undo, or an account from before
 * sign-up failed on it) has no team and cannot create one: canUserCreateTeam never allows it in single-user and
 * single-tenant mode. The first authenticated session request that finds no team calls this, which creates it.
 *
 * Only for the modes that create a personal team per user (single-user, multi-tenant). Not repaired: an account
 * that signed up team-less on purpose (signupIntent.skipTeamForNonOwnerIntents records a signup_intent meta), a
 * user with a pending invitation, and a user that has ever belonged to or owned a team (including a deleted one),
 * who may have left on purpose.
 */
import { getServiceTransactionClient, queryOne } from '../db'
import { TEAMS_CONFIG } from '../config'
import { TeamService } from '../services/team.service'
import { getUserDefaultTeamId } from '../teams/dashboard-team'
import { hasPendingInvitationForEmail } from '../auth'

type QueryOne = <T>(sql: string, params: unknown[]) => Promise<T | null>

async function needsPersonalTeam(userId: string, one: QueryOne): Promise<boolean> {
  const user = await one<{ email: string }>(
    `SELECT u.email FROM "users" u
      WHERE u.id = $1
        AND NOT EXISTS (SELECT 1 FROM "team_members" WHERE "userId" = u.id)
        AND NOT EXISTS (SELECT 1 FROM "teams" WHERE "ownerId" = u.id)
        AND NOT EXISTS (SELECT 1 FROM "users_metas" WHERE "userId" = u.id AND "metaKey" = 'signup_intent')`,
    [userId]
  )
  return !!user && !(await hasPendingInvitationForEmail(user.email))
}

/**
 * The user's default team id after making sure a user that should have a personal team has one; undefined when
 * there is none to give. Never throws: authentication must not break on a failed repair.
 *
 * Idempotent and safe under concurrency: the check and the creation run under a per-user advisory lock, and the
 * check is repeated once the lock is held, so concurrent requests create exactly one team.
 */
export async function repairMissingPersonalTeam(userId: string): Promise<string | undefined> {
  if (TEAMS_CONFIG.mode !== 'single-user' && TEAMS_CONFIG.mode !== 'multi-tenant') return undefined
  try {
    // ponytail: one cheap read per request for a user that is team-less on purpose; cache it if that ever matters
    if (!(await needsPersonalTeam(userId, queryOne))) return undefined
    // ponytail: holds this connection while TeamService.create takes a second; fine unless the pool is tiny
    const lock = await getServiceTransactionClient()
    try {
      await lock.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`personal-team:${userId}`])
      let teamId: string | undefined
      if (await needsPersonalTeam(userId, lock.queryOne)) {
        teamId = (await TeamService.create(userId)).id
        console.log(`[Teams] Repaired the missing team of user ${userId}`)
      }
      await lock.commit()
      return teamId ?? (await getUserDefaultTeamId(userId))
    } catch (error) {
      await lock.rollback()
      throw error
    }
  } catch (error) {
    console.error(`[Teams] Failed to repair the missing team of user ${userId}:`, error)
    return undefined
  }
}
