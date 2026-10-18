/**
 * Paddle checkout team token (#269)
 *
 * Paddle copies a transaction's custom_data to the subscription created from it, and returns it in every transaction
 * and subscription webhook. But custom data can also come from the browser (Paddle.js `customData`), so the
 * transactions this app creates carry `teamToken`, an HMAC of the team id and the transaction's price id, and the
 * webhook binds a new subscription to a team only when the token matches that team and the price the event is about.
 * The key is PADDLE_TEAM_TOKEN_SECRET, or the webhook secret when it is unset.
 *
 * No dependency beyond node:crypto, so the webhook route does not import the gateway.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** The key of the team token: PADDLE_TEAM_TOKEN_SECRET, else PADDLE_WEBHOOK_SECRET; null when neither is set. */
export function paddleTeamTokenSecret(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.PADDLE_TEAM_TOKEN_SECRET?.trim() || env.PADDLE_WEBHOOK_SECRET?.trim() || null
}

/** The token a transaction of `priceId` carries next to the team id: hex HMAC-SHA256 of both. */
export function paddleTeamToken(teamId: string, priceId: string, secret: string): string {
  return createHmac('sha256', secret).update(`nextspark-paddle-team:${teamId}:${priceId}`).digest('hex')
}

/** True when `token` is the team token of `teamId` for one of `priceIds`; constant-time per price. */
export function isValidPaddleTeamToken(teamId: string, priceIds: string[], token: unknown, secret: string): boolean {
  if (typeof token !== 'string' || !/^[0-9a-f]{64}$/.test(token)) return false
  const given = Buffer.from(token, 'hex')
  return priceIds.some(priceId => timingSafeEqual(Buffer.from(paddleTeamToken(teamId, priceId, secret), 'hex'), given))
}
