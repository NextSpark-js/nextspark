/**
 * Superadmin business metrics (#267) against a throwaway cluster with core's migrations: the service's real queries on
 * fixture rows. Skipped when initdb and pg_ctl are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HAS_POSTGRES, cutoverDatabase } from './_pg-cutover'
import { getBusinessMetrics, SIGNUP_DAYS, type SqlRunner } from '../../src/lib/services/business-metrics.service'

test('business metrics: users, sign-ups, paying teams and users, MRR per currency', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 300000 }, async t => {
  const { owner } = await cutoverDatabase(t)
  const run: SqlRunner = async (text, params) => (await owner.query(text, params)).rows

  // the sample data of the migrations is not loaded: an empty platform has zero of everything, 30 zero days
  const empty = await getBusinessMetrics(run)
  assert.equal(empty.totalUsers, 0)
  assert.equal(empty.signupsPerDay.length, SIGNUP_DAYS)
  assert.ok(empty.signupsPerDay.every(d => d.count === 0))
  assert.deepEqual([empty.payingUsers, empty.payingTeams, empty.mrr], [0, 0, []])

  // users: two today, one 3 days ago, one 29 days ago (first day of the window), one 30 days ago (outside it)
  const ago = (days: number) => `now() - interval '${days} days'`
  for (const [id, days] of [['u1', 0], ['u2', 0], ['u3', 3], ['u4', 29], ['u5', 30], ['u6', 0], ['u7', 0], ['u8', 0], ['u9', 0], ['u10', 0], ['u11', 0]] as const) {
    await owner.query(`INSERT INTO users (id, email, "createdAt") VALUES ($1, $2, ${ago(days)})`, [id, `${id}@example.com`])
  }

  await owner.query(`INSERT INTO plans (id, slug, name, type, "priceMonthly", "priceYearly", currency) VALUES
    ('free', 'free', 'Free', 'free', 0, 0, 'usd'),
    ('pro', 'pro', 'Pro', 'paid', 1000, 12000, 'usd'),
    ('eur', 'eur', 'Euro', 'paid', 2000, 20000, 'EUR'),
    ('ent', 'ent', 'Enterprise', 'enterprise', NULL, NULL, 'usd'),
    ('odd', 'odd', 'Odd', 'paid', 999, 10000, NULL)`)
  // one team per subscription (a team has at most one active, trialing or past_due subscription)
  const teams = ['t-monthly', 't-yearly', 't-free', 't-canceled', 't-trial', 't-pastdue', 't-eur', 't-eur-yearly', 't-ent', 't-end', 't-ended', 't-deleted', 't-shared', 't-odd']
  for (const [i, id] of teams.entries()) {
    await owner.query(`INSERT INTO teams (id, name, slug, "ownerId") VALUES ($1, $1, $1, $2)`, [id, `u${(i % 11) + 1}`])
  }
  await owner.query(`UPDATE teams SET "deletedAt" = now() WHERE id = 't-deleted'`)
  const sub = (team: string, plan: string, status: string, interval: string, extra: { user?: string; cancelAtPeriodEnd?: boolean; periodEnd?: string } = {}) =>
    owner.query(
      `INSERT INTO subscriptions ("teamId", "userId", "planId", status, "billingInterval", "cancelAtPeriodEnd", "currentPeriodStart", "currentPeriodEnd")
       VALUES ($1, $2, $3, $4, $5, $6, now() - interval '10 days', ${extra.periodEnd ?? "now() + interval '20 days'"})`,
      [team, extra.user ?? null, plan, status, interval, extra.cancelAtPeriodEnd ?? false],
    )
  await sub('t-monthly', 'pro', 'active', 'monthly', { user: 'u1' })        // 1000
  await sub('t-yearly', 'pro', 'active', 'yearly', { user: 'u2' })          // 12000 / 12 = 1000
  await sub('t-free', 'free', 'active', 'monthly', { user: 'u3' })          // free plan: not paying
  await sub('t-canceled', 'pro', 'canceled', 'monthly', { user: 'u4' })     // canceled now: not paying
  await sub('t-trial', 'pro', 'trialing', 'monthly', { user: 'u5' })        // trialing: not paying
  await sub('t-pastdue', 'pro', 'past_due', 'monthly', { user: 'u6' })      // past_due: not paying
  await sub('t-eur', 'eur', 'active', 'monthly', { user: 'u7' })            // 2000 eur
  await sub('t-eur-yearly', 'eur', 'active', 'yearly')                      // 20000 / 12 = 1666.67 eur; team-level: payer is the owner
  await sub('t-ent', 'ent', 'active', 'monthly', { user: 'u9' })            // enterprise without a price: not paying
  await sub('t-end', 'pro', 'active', 'monthly', { user: 'u10', cancelAtPeriodEnd: true })   // cancels at period end: counts until then
  await sub('t-ended', 'pro', 'active', 'monthly', { user: 'u11', cancelAtPeriodEnd: true, periodEnd: "now() - interval '1 hour'" }) // period over: not paying
  await sub('t-deleted', 'pro', 'active', 'monthly', { user: 'u8' })        // soft-deleted team: not paying
  await sub('t-shared', 'pro', 'active', 'monthly', { user: 'u1' })         // u1 pays for a second team: one paying user
  await sub('t-odd', 'odd', 'active', 'monthly', { user: 'u2' })            // no currency: usd; u2 again

  const m = await getBusinessMetrics(run)
  assert.equal(m.totalUsers, 11)

  assert.equal(m.signupsPerDay.length, SIGNUP_DAYS)
  const days = m.signupsPerDay.map(d => d.day)
  assert.deepEqual(days, [...days].sort())
  assert.equal(new Set(days).size, SIGNUP_DAYS)
  assert.equal(m.signupsPerDay.at(-1)!.count, 8)  // u1 u2 u6..u11, today
  assert.equal(m.signupsPerDay.at(-4)!.count, 1)  // 3 days ago
  assert.equal(m.signupsPerDay[0]!.count, 1)      // 29 days ago
  assert.equal(m.signupsPerDay.reduce((n, d) => n + d.count, 0), 10) // the one 30 days ago is outside
  assert.equal(m.signupsPerDay.filter(d => d.count === 0).length, 27)

  // paying teams: monthly, yearly, eur, eur-yearly, end, shared, odd (7). payers: u1 (two teams), u2 (two), u7, u10, and u8's
  // owner is not involved; t-eur-yearly has no userId, so its owner counts: teams[7] is owned by u8.
  assert.equal(m.payingTeams, 7)
  assert.equal(m.payingUsers, 5) // u1, u2, u7, u10, u8 (owner of t-eur-yearly)

  // usd: 1000 + 12000/12 + 1000 (t-end) + 1000 (t-shared) + 999 (odd, default currency) = 4999; eur: 2000 + 1666.67 = 3667
  assert.deepEqual(m.mrr, [{ currency: 'eur', cents: 3667 }, { currency: 'usd', cents: 4999 }])
})
