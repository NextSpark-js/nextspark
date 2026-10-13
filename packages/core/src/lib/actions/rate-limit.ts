/**
 * Per-user rate limit for the Server Actions that write.
 * Not a 'use server' module: it exports no action.
 *
 * The tiers are the ones of the REST twins (`write` for create/update/delete, `strict` for
 * transfer-ownership and delete-account), so a client gets the same ceiling through either door.
 * REST counts per client address; an action counts per signed-in user, whatever the address.
 */

import { checkDistributedRateLimit, type RateLimitTier } from '../api/rate-limit'

export const ACTION_RATE_LIMITED = 'Too many requests. Please try again later.'

/** The error to return when the user is over the tier's limit, or null to go on. */
export async function actionRateLimitError(
  userId: string,
  tier: Extract<RateLimitTier, 'write' | 'strict'>
): Promise<string | null> {
  const result = await checkDistributedRateLimit(`${tier}:user:${userId}`, tier)
  return result.allowed ? null : ACTION_RATE_LIMITED
}
