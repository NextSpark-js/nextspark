/**
 * Business metrics for the superadmin home (#267), computed live from Postgres on the service connection.
 *
 * No access check here: the service is called only by `/superadmin` (a page under the area, rendered only after
 * `requireAreaAccess('superadmin')`, see routes/_internal/area-access). Do not expose it from any other route.
 *
 * Definitions (billing is team-based: a team has at most one active/trialing/past_due subscription):
 * - Total users: rows of `users`.
 * - Sign-ups per day: `users."createdAt"` per UTC day for the last 30 days (today and the 29 before), zero days included.
 * - Paying subscription: `status = 'active'` (so not trialing, past_due, paused, canceled or expired) on a plan whose
 *   `type` is not `free`, on a team that is not soft-deleted, with a price above zero for its billing interval.
 *   A subscription with `cancelAtPeriodEnd` still counts until `currentPeriodEnd`, as a gateway reports MRR.
 * - Paying teams: distinct teams with a paying subscription.
 * - Paying users: distinct payers of those subscriptions, `COALESCE(subscriptions."userId", teams."ownerId")`: the
 *   user the subscription was made for, or the team owner for a team-level subscription. Members who only use a paid
 *   team are not counted.
 * - MRR: per currency (plans carry their own, never added across currencies), in cents: `priceMonthly` for monthly
 *   subscriptions, `priceYearly / 12` for yearly ones, rounded once per currency. The schema has no quantity, seats,
 *   discount or per-subscription price, so the plan price is the price.
 */
import { queryRows } from '../db'

export type SqlRunner = (text: string, params?: unknown[]) => Promise<Array<Record<string, unknown>>>

export interface BusinessMetrics {
  totalUsers: number
  /** Oldest day first, always 30 entries; `day` is `YYYY-MM-DD` (UTC). */
  signupsPerDay: Array<{ day: string; count: number }>
  payingUsers: number
  payingTeams: number
  /** Monthly recurring revenue per currency (lowercase ISO code), in cents. Empty when nothing is paying. */
  mrr: Array<{ currency: string; cents: number }>
}

export const SIGNUP_DAYS = 30

const PAYING = `
  WITH paying AS (
    SELECT s."teamId",
           COALESCE(s."userId", t."ownerId") AS "payerId",
           lower(COALESCE(p.currency, 'usd')) AS currency,
           s."billingInterval" AS "interval",
           CASE s."billingInterval" WHEN 'yearly' THEN p."priceYearly" ELSE p."priceMonthly" END AS price
    FROM public."subscriptions" s
    JOIN public."plans" p ON p.id = s."planId"
    JOIN public."teams" t ON t.id = s."teamId"
    WHERE s.status = 'active'
      AND p.type <> 'free'
      AND t."deletedAt" IS NULL
      AND NOT (COALESCE(s."cancelAtPeriodEnd", false) AND s."currentPeriodEnd" <= now())
  )`

export const QUERIES = {
  totalUsers: `SELECT count(*)::int AS n FROM public."users"`,
  signups: `
    WITH win AS (SELECT (now() AT TIME ZONE 'UTC')::date AS today, (now() AT TIME ZONE 'UTC')::date - ($1::int - 1) AS first)
    SELECT to_char(d, 'YYYY-MM-DD') AS day, COALESCE(c.n, 0)::int AS count
    FROM win, generate_series(win.first, win.today, interval '1 day') AS d
    LEFT JOIN (
      SELECT (u."createdAt" AT TIME ZONE 'UTC')::date AS day, count(*) AS n
      FROM public."users" u, win
      WHERE u."createdAt" >= win.first::timestamp AT TIME ZONE 'UTC'
      GROUP BY 1
    ) c ON c.day = d::date
    ORDER BY d`,
  paying: `${PAYING}
    SELECT count(DISTINCT "teamId")::int AS teams, count(DISTINCT "payerId")::int AS users FROM paying WHERE price > 0`,
  mrr: `${PAYING}
    SELECT currency,
           round(sum(CASE "interval" WHEN 'yearly' THEN price / 12.0 ELSE price END))::bigint AS cents
    FROM paying WHERE price > 0 GROUP BY currency ORDER BY currency`,
}

export async function getBusinessMetrics(run: SqlRunner = queryRows as SqlRunner): Promise<BusinessMetrics> {
  const [users, signups, paying, mrr] = await Promise.all([
    run(QUERIES.totalUsers),
    run(QUERIES.signups, [SIGNUP_DAYS]),
    run(QUERIES.paying),
    run(QUERIES.mrr),
  ])
  return {
    totalUsers: Number(users[0]?.n ?? 0),
    signupsPerDay: signups.map(r => ({ day: String(r.day), count: Number(r.count) })),
    payingUsers: Number(paying[0]?.users ?? 0),
    payingTeams: Number(paying[0]?.teams ?? 0),
    mrr: mrr.map(r => ({ currency: String(r.currency), cents: Number(r.cents) })),
  }
}
