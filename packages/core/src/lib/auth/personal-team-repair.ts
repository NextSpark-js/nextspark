/**
 * Personal Team Repair (#324)
 *
 * A user whose personal team was never created (a failure the sign-up could not undo, or an account from before
 * sign-up failed on it) has no team and cannot create one: canUserCreateTeam never allows it in single-user and
 * single-tenant mode. The first authenticated session request that finds no team calls this, which creates it.
 *
 * Only for the modes that create a personal team per user (single-user, multi-tenant). Not repaired: an account
 * that signed up team-less on purpose (signupIntent.skipTeamForNonOwnerIntents records a signup_intent meta), a
 * user with a pending invitation, a user that owns a team, and a user that still has a membership (including in a
 * deleted team). Removing a member deletes their membership row, so a member removed from their only team, and
 * who never owned one, gets a personal team on their next request; in multi-tenant mode they could create one anyway.
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

// Repairs running at once: each holds a connection for the lock while TeamService.create takes another, so
// unbounded they could take the whole pool. The rest wait here, holding nothing.
const MAX_CONCURRENT = 4
let active = 0
const waiting: Array<() => void> = []

async function withSlot<T>(fn: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) await new Promise<void>(resolve => waiting.push(resolve))
  else active++
  try {
    return await fn()
  } finally {
    const next = waiting.shift()
    if (next) next() // the slot passes to the next one
    else active--
  }
}

/**
 * The user's default team id after making sure a user that should have a personal team has one; undefined when
 * there is none to give. Never throws: authentication must not break on a failed repair.
 *
 * Idempotent and safe under concurrency: the check and the creation run under a per-user advisory lock taken
 * without waiting (a request that does not get it is not blocked: the one that did creates the team, and this one
 * answers with whatever team exists by then), and the check is repeated once the lock is held, so concurrent
 * requests create exactly one team.
 */
export async function repairMissingPersonalTeam(userId: string): Promise<string | undefined> {
  if (TEAMS_CONFIG.mode !== 'single-user' && TEAMS_CONFIG.mode !== 'multi-tenant') return undefined
  try {
    // ponytail: one cheap read per request for a user that is team-less on purpose; cache it if that ever matters
    // (the default team is read again: the team may have been created since the caller looked)
    if (!(await needsPersonalTeam(userId, queryOne))) return await getUserDefaultTeamId(userId)
    await withSlot(async () => {
      const lock = await getServiceTransactionClient()
      try {
        const got = await lock.queryOne<{ locked: boolean }>('SELECT pg_try_advisory_xact_lock(hashtext($1)) AS locked', [`personal-team:${userId}`])
        if (got?.locked && await needsPersonalTeam(userId, lock.queryOne)) {
          await TeamService.create(userId)
          console.log(`[Teams] Repaired the missing team of user ${userId}`)
        }
        await lock.commit()
      } catch (error) {
        await lock.rollback()
        throw error
      }
    })
    return await getUserDefaultTeamId(userId)
  } catch (error) {
    console.error(`[Teams] Failed to repair the missing team of user ${userId}:`, error)
    return undefined
  }
}
