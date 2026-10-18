/**
 * The Paddle webhook (#269) end to end against a real PostgreSQL with core's migrations: real signatures, the real
 * factory and gateway, the real dedup helper and lib/db.ts. Nothing reaches Paddle: the payloads are hand-built from
 * the documented shapes (developer.paddle.com: how webhooks work, signature verification, the subscription.created and
 * transaction.completed examples, the subscription and transaction entities), not recorded from an account.
 *
 * Like webhook-dedupe.test.ts it starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when
 * they are not on the PATH.
 */
import { createHmac } from 'node:crypto'
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

jest.mock('@nextsparkjs/registries/billing-registry', () => ({
  BILLING_REGISTRY: {
    provider: 'paddle',
    plans: [
      { slug: 'free', name: 'Free', providerPriceIds: { monthly: null, yearly: null }, limits: {}, features: [] },
      { slug: 'pro', name: 'Pro', providerPriceIds: { monthly: 'pri_pro_m', yearly: 'pri_pro_y' }, limits: {}, features: [] },
    ],
    limits: {},
  },
}))

const CORE = path.resolve(__dirname, '../../../..')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const describeWithPostgres = HAS_POSTGRES ? describe : describe.skip

const SECRET = 'pdl_ntfset_sandbox_e2e_secret'

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

/** The Paddle-Signature header for `body`, signed now (or `ts`) with `secret`. */
function sign(body: string, secret = SECRET, ts = Math.floor(Date.now() / 1000)) {
  return `ts=${ts};h1=${createHmac('sha256', secret).update(`${ts}:${body}`).digest('hex')}`
}

/** A request as the handler reads it: the raw bytes and the headers. */
function request(body: string, signature: string | null) {
  const headers = new Map(signature === null ? [] : [['paddle-signature', signature]])
  return {
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
  } as never
}

async function responseOf(response: Response) {
  return { status: response.status, body: await response.json() }
}

let teamToken: (teamId: string, priceId?: string) => string

/** custom data as our checkout sets it: the team and its token for the transaction's price (pri_pro_m: pro monthly). */
const customFor = (teamId: string, priceId = 'pri_pro_m') => ({ teamId, teamToken: teamToken(teamId, priceId), planSlug: 'pro', billingPeriod: 'monthly' })

let eventCounter = 0
const nextEventId = () => `evt_e2e_${String(++eventCounter).padStart(4, '0')}`

interface EventOptions { eventId?: string; occurredAt: string }

function subscriptionEvent(name: string, fields: Record<string, unknown>, custom: Record<string, unknown> | null, id: string, options: EventOptions) {
  const priceId = (fields.priceId as string | undefined) ?? 'pri_pro_m'
  const { priceId: _priceId, ...rest } = fields
  return JSON.stringify({
    event_id: options.eventId ?? nextEventId(),
    event_type: name,
    occurred_at: options.occurredAt,
    notification_id: 'ntf_e2e',
    data: {
      id,
      status: 'active',
      customer_id: 'ctm_e2e',
      currency_code: 'USD',
      custom_data: custom,
      items: [{ price: { id: priceId }, quantity: 1, status: 'active', trial_dates: null }],
      scheduled_change: null,
      canceled_at: null,
      current_billing_period: { starts_at: '2026-10-01T00:00:00.000000Z', ends_at: '2026-11-01T00:00:00.000000Z' },
      billing_cycle: { interval: 'month', frequency: 1 },
      updated_at: options.occurredAt,
      ...rest,
    },
  })
}

function transactionEvent(name: string, fields: Record<string, unknown>, custom: Record<string, unknown> | null, id: string, options: EventOptions) {
  const priceId = (fields.priceId as string | undefined) ?? 'pri_pro_m'
  const { priceId: _priceId, ...rest } = fields
  return JSON.stringify({
    event_id: options.eventId ?? nextEventId(),
    event_type: name,
    occurred_at: options.occurredAt,
    notification_id: 'ntf_e2e',
    data: {
      id,
      status: name === 'transaction.payment_failed' ? 'past_due' : name === 'transaction.paid' ? 'paid' : 'completed',
      origin: 'subscription_recurring',
      subscription_id: null,
      customer_id: 'ctm_e2e',
      invoice_number: '325-1',
      currency_code: 'USD',
      custom_data: custom,
      items: [{ price: { id: priceId }, quantity: 1 }],
      details: { totals: { subtotal: '2900', tax: '0', total: '2900', grand_total: '2900', currency_code: 'USD' } },
      updated_at: options.occurredAt,
      ...rest,
    },
  })
}

describeWithPostgres('Paddle webhook', () => {
  let dir: string
  let db: Client
  let handler: (req: never) => Promise<Response>
  let closePool: () => Promise<void>
  let resetGateway: () => void

  const post = async (body: string, signature: string | null = sign(body)) => responseOf(await handler(request(body, signature)))

  const row = async (id: string) => (await db.query(
    `SELECT s."externalSubscriptionId", s."externalCustomerId", s."paymentProvider", s.status, s."cancelAtPeriodEnd",
            s."canceledAt" IS NOT NULL AS "hasCanceledAt", s."currentPeriodStart", s."currentPeriodEnd", s."trialEndsAt",
            p.slug AS plan, s."billingInterval"
     FROM subscriptions s JOIN plans p ON p.id = s."planId" WHERE s.id = $1`, [id])).rows[0]
  const billingEvents = async (subscriptionId: string) => (await db.query(
    `SELECT type, status, amount, currency, "externalPaymentId", metadata FROM billing_events WHERE "subscriptionId" = $1 ORDER BY "createdAt", id`,
    [subscriptionId])).rows
  const claim = async (eventId: string) => (await db.query(
    `SELECT status FROM billing_webhook_events WHERE gateway = 'paddle' AND "eventId" = $1`, [eventId])).rows[0]?.status ?? null
  const claims = async () => (await db.query(`SELECT count(*)::int AS n FROM billing_webhook_events`)).rows[0].n
  const counts = async () => (await db.query(
    `SELECT (SELECT count(*) FROM subscriptions)::int AS subscriptions, (SELECT count(*) FROM billing_events)::int AS events`)).rows[0]
  const addTeam = (n: number, extra = '') => db.query(`
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-${n}', 'Team ${n}', 'team-${n}', 'u1');
    INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd"${extra ? ', "paymentProvider", "externalSubscriptionId"' : ''})
      VALUES ('sub-${n}', 'team-${n}', '${extra ? 'plan-pro' : 'plan-free'}', 'active', now(), now() + interval '30 days'${extra});
  `)

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'paddle-webhook-pg-'))
    const port = await freePort()
    execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
    const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
    db = new Client({ connectionString: url })
    db.on('error', () => {})
    await db.connect()
    for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql').sort()) {
      await db.query(fs.readFileSync(path.join(CORE, 'migrations', file), 'utf8'))
    }
    await db.query(`
      INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('u1', 'u1@example.test', 'U1', 'member', true);
      INSERT INTO plans (id, slug, name) VALUES ('plan-free', 'free', 'Free'), ('plan-pro', 'pro', 'Pro');
    `)
    // team-1 and team-3: the free subscription a team starts with; team-2: already on Paddle subscription sub_two
    await addTeam(1)
    await addTeam(2, `, 'paddle', 'sub_two'`)
    await addTeam(3)

    process.env.DATABASE_URL = url
    delete process.env.DATABASE_SERVICE_URL
    process.env.PADDLE_API_KEY = 'pdl_sdbx_apikey_e2e'
    process.env.PADDLE_WEBHOOK_SECRET = SECRET
    process.env.PADDLE_ENVIRONMENT = 'sandbox'
    const { createPaddleWebhookHandler } = require('@nextsparkjs/core/routes/_internal/paddle-webhook')
    handler = createPaddleWebhookHandler()
    const { paddleTeamToken } = require('@nextsparkjs/core/lib/billing/paddle-webhook')
    teamToken = (teamId: string, priceId = 'pri_pro_m') => paddleTeamToken(teamId, priceId, SECRET)
    resetGateway = require('@nextsparkjs/core/lib/billing/gateways/factory').resetBillingGateway
    closePool = () => require('@nextsparkjs/core/lib/db').pool.end()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.spyOn(console, 'error').mockImplementation(() => {})
  }, 120000)

  afterAll(async () => {
    await closePool?.()
    await db?.end()
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), 'stop', '-m', 'immediate', '-w'], { stdio: 'ignore' })
    fs.rmSync(dir, { recursive: true, force: true })
  })

  test('a bad, missing, foreign, stale or malformed signature is refused before anything is claimed or written', async () => {
    const before = await counts()
    const body = subscriptionEvent('subscription.created', {}, customFor('team-1'), 'sub_one', { occurredAt: '2026-10-01T00:00:00.000000Z' })
    const now = Math.floor(Date.now() / 1000)
    expect(await post(body, null)).toEqual({ status: 400, body: { error: 'No signature provided' } })
    expect(await post(body, `ts=${now};h1=${'f'.repeat(64)}`)).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect(await post(body, sign(body, 'pdl_ntfset_another_secret'))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect(await post(body.replace('"status":"active"', '"status":"canceled"'), sign(body))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    // a captured delivery replayed a minute later
    expect(await post(body, sign(body, SECRET, now - 60))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect(await post(body, `h1=${sign(body).split('h1=')[1]}`)).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect(await claims()).toBe(0)
    expect(await counts()).toEqual(before)
  })

  test('created (trialing), activated, a plan change, a scheduled cancellation, then canceled move team-1\'s row through the lifecycle', async () => {
    expect(await post(subscriptionEvent('subscription.created', {
      status: 'trialing',
      items: [{ price: { id: 'pri_pro_m' }, quantity: 1, trial_dates: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-15T00:00:00Z' } }],
      current_billing_period: { starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-10-15T00:00:00Z' },
    }, customFor('team-1'), 'sub_one', { occurredAt: '2026-10-01T00:00:01.000001Z' }))).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-1')).toMatchObject({
      externalSubscriptionId: 'sub_one', externalCustomerId: 'ctm_e2e', paymentProvider: 'paddle', status: 'trialing',
      cancelAtPeriodEnd: false, hasCanceledAt: false, plan: 'pro', billingInterval: 'monthly',
      currentPeriodStart: new Date('2026-10-01T00:00:00Z'), currentPeriodEnd: new Date('2026-10-15T00:00:00Z'), trialEndsAt: new Date('2026-10-15T00:00:00Z'),
    })

    // trial over: activated
    expect((await post(subscriptionEvent('subscription.activated', {
      current_billing_period: { starts_at: '2026-10-15T00:00:00Z', ends_at: '2026-11-15T00:00:00Z' },
    }, customFor('team-1'), 'sub_one', { occurredAt: '2026-10-15T00:00:01Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ status: 'active', currentPeriodEnd: new Date('2026-11-15T00:00:00Z') })

    // a plan change to the yearly price: no custom data needed once bound (the old token names the monthly price)
    expect((await post(subscriptionEvent('subscription.updated', {
      priceId: 'pri_pro_y', current_billing_period: { starts_at: '2026-10-15T00:00:00Z', ends_at: '2027-10-15T00:00:00Z' },
    }, customFor('team-1'), 'sub_one', { occurredAt: '2026-10-16T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ billingInterval: 'yearly', currentPeriodEnd: new Date('2027-10-15T00:00:00Z') })

    // cancel at period end: Paddle schedules the change and keeps the subscription active
    expect((await post(subscriptionEvent('subscription.updated', {
      priceId: 'pri_pro_y', scheduled_change: { action: 'cancel', effective_at: '2027-10-15T00:00:00Z', resume_at: null },
      current_billing_period: { starts_at: '2026-10-15T00:00:00Z', ends_at: '2027-10-15T00:00:00Z' },
    }, customFor('team-1'), 'sub_one', { occurredAt: '2026-10-20T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ status: 'active', cancelAtPeriodEnd: true, hasCanceledAt: true })

    // the cancellation takes effect
    expect((await post(subscriptionEvent('subscription.canceled', {
      priceId: 'pri_pro_y', status: 'canceled', canceled_at: '2027-10-15T00:00:00Z', current_billing_period: null,
    }, customFor('team-1'), 'sub_one', { occurredAt: '2027-10-15T00:00:01.000002Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({
      status: 'canceled', cancelAtPeriodEnd: false, hasCanceledAt: true, externalSubscriptionId: 'sub_one', currentPeriodEnd: new Date('2027-10-15T00:00:00Z'),
    })

    expect((await billingEvents('sub-1')).map(event => [event.type, event.status, event.metadata.event])).toEqual([
      ['lifecycle', 'succeeded', 'subscription.created'],
      ['lifecycle', 'succeeded', 'subscription.activated'],
      ['lifecycle', 'succeeded', 'subscription.canceled'],
    ])
  })

  test('a replayed event is a duplicate and changes nothing; an older event does not move the row back', async () => {
    const body = subscriptionEvent('subscription.paused', { status: 'paused' }, null, 'sub_one', { eventId: 'evt_replay', occurredAt: '2027-10-14T00:00:00Z' })
    // older than the cancellation: processed, but the row stays canceled
    expect(await post(body)).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-1')).toMatchObject({ status: 'canceled' })
    // the same event again, as Paddle retries it or a person replays it (re-signed with a new timestamp)
    const before = await counts()
    expect(await post(body)).toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
    expect(await counts()).toEqual(before)
    expect(await claim('evt_replay')).toBe('processed')

    // microseconds count: an event one microsecond older than the last applied one is not applied either
    await post(subscriptionEvent('subscription.updated', { status: 'active' }, null, 'sub_one', { occurredAt: '2027-10-15T00:00:01.000001Z' }))
    expect(await row('sub-1')).toMatchObject({ status: 'canceled' })
  })

  test('after the cancellation, a new subscription of the team is applied to its latest row (#300)', async () => {
    expect((await post(subscriptionEvent('subscription.created', {}, customFor('team-1'), 'sub_one_again', { occurredAt: '2027-11-01T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({
      externalSubscriptionId: 'sub_one_again', status: 'active', cancelAtPeriodEnd: false, hasCanceledAt: false, plan: 'pro', billingInterval: 'monthly',
    })
    // the canceled subscription's events no longer reach the row
    expect((await post(subscriptionEvent('subscription.updated', { status: 'canceled' }, null, 'sub_one', { occurredAt: '2027-11-02T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: 'sub_one_again', status: 'active' })
  })

  test('a late event of an older subscription does not reactivate a row a newer one has bound and ended', async () => {
    // B (sub_one_again) ends too: the row is canceled and bound to B
    expect((await post(subscriptionEvent('subscription.canceled', { status: 'canceled', canceled_at: '2027-12-01T00:00:00Z', current_billing_period: null },
      customFor('team-1'), 'sub_one_again', { occurredAt: '2027-12-01T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: 'sub_one_again', status: 'canceled' })

    // a delivery of A (sub_one) from before its cancellation, as active, arrives days late
    expect(await post(subscriptionEvent('subscription.updated', {}, customFor('team-1'), 'sub_one', { occurredAt: '2027-10-14T00:00:00Z' })))
      .toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: 'sub_one_again', status: 'canceled' })
    // A's cancellation delivered again, newer than B's: an unbound canceled subscription binds nothing
    expect((await post(subscriptionEvent('subscription.canceled', { status: 'canceled', current_billing_period: null }, customFor('team-1'), 'sub_one',
      { occurredAt: '2027-12-05T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: 'sub_one_again', status: 'canceled' })

    // a new subscription after B ended still binds
    expect((await post(subscriptionEvent('subscription.created', {}, customFor('team-1'), 'sub_one_third', { occurredAt: '2027-12-10T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: 'sub_one_third', status: 'active', hasCanceledAt: false })
  })

  test('a failed payment and its recovery are recorded; the status follows the subscription events', async () => {
    expect((await post(subscriptionEvent('subscription.created', {}, customFor('team-3'), 'sub_three', { occurredAt: '2026-10-02T00:00:00Z' }))).status).toBe(200)
    expect(await row('sub-3')).toMatchObject({ externalSubscriptionId: 'sub_three', status: 'active', plan: 'pro' })

    expect(await post(transactionEvent('transaction.payment_failed', { subscription_id: 'sub_three' }, customFor('team-3'), 'txn_renew', { occurredAt: '2026-11-02T00:00:00Z' })))
      .toEqual({ status: 200, body: { received: true } })
    expect((await post(subscriptionEvent('subscription.past_due', { status: 'past_due' }, customFor('team-3'), 'sub_three', { occurredAt: '2026-11-02T00:00:01Z' }))).status).toBe(200)
    expect(await row('sub-3')).toMatchObject({ status: 'past_due' })

    // the retry succeeds: paid, then completed, for the same transaction; one payment row
    expect((await post(transactionEvent('transaction.paid', { subscription_id: 'sub_three' }, customFor('team-3'), 'txn_renew', { occurredAt: '2026-11-05T00:00:00Z' }))).status).toBe(200)
    expect((await post(transactionEvent('transaction.completed', { subscription_id: 'sub_three' }, customFor('team-3'), 'txn_renew', { occurredAt: '2026-11-05T00:00:01Z' }))).status).toBe(200)
    expect((await post(subscriptionEvent('subscription.updated', { status: 'active' }, customFor('team-3'), 'sub_three', { occurredAt: '2026-11-05T00:00:02Z' }))).status).toBe(200)
    expect(await row('sub-3')).toMatchObject({ status: 'active' })

    const payments = (await billingEvents('sub-3')).filter(event => event.type === 'payment')
    expect(payments.map(event => [event.status, event.amount, event.currency, event.externalPaymentId])).toEqual([
      ['failed', 2900, 'usd', 'txn_renew'],
      ['succeeded', 2900, 'usd', 'txn_renew'],
    ])
  })

  test('transaction.paid and transaction.completed delivered at the same time record one payment', async () => {
    const at = { occurredAt: '2026-12-02T00:00:00Z' }
    const paid = transactionEvent('transaction.paid', { subscription_id: 'sub_three' }, customFor('team-3'), 'txn_together', at)
    const completed = transactionEvent('transaction.completed', { subscription_id: 'sub_three' }, customFor('team-3'), 'txn_together', at)
    const answers = await Promise.all([post(paid), post(completed)])
    expect(answers.map(answer => answer.status)).toEqual([200, 200])
    expect((await billingEvents('sub-3')).filter(event => event.externalPaymentId === 'txn_together')).toHaveLength(1)
  })

  test('a handled event with no data.id or occurred_at is refused with 400 and claims nothing', async () => {
    const before = await claims()
    const noOccurredAt = JSON.stringify({ event_id: nextEventId(), event_type: 'subscription.updated', data: { id: 'sub_three', status: 'canceled' } })
    expect(await post(noOccurredAt)).toEqual({ status: 400, body: { error: 'Event has no data.id or occurred_at' } })
    const noId = JSON.stringify({ event_id: nextEventId(), event_type: 'transaction.completed', occurred_at: '2026-10-01T00:00:00Z', data: { status: 'completed' } })
    expect((await post(noId)).status).toBe(400)
    expect(await claims()).toBe(before)
    expect(await row('sub-3')).toMatchObject({ status: 'active' })
  })

  test('a subscription with no plan\'s price, a token of another price, or a token not scoped to a price binds nothing', async () => {
    await addTeam(5)
    const sub5 = await row('sub-5')
    const errors = console.error as jest.Mock
    errors.mockClear()
    // a recurring add-on bought through createOneTimeCheckout: its token is valid, its price is no plan's
    await post(subscriptionEvent('subscription.created', { priceId: 'pri_addon' }, customFor('team-5', 'pri_addon'), 'sub_addon', { occurredAt: '2026-10-05T00:00:00Z' }))
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('subscription sub_addon has no plan\'s price; not applied'))
    // a plan price with the token of another price (a token of a cheap checkout reused)
    await post(subscriptionEvent('subscription.created', {}, customFor('team-5', 'pri_addon'), 'sub_reused', { occurredAt: '2026-10-05T00:00:00Z' }))
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('the team token of team team-5 does not match'))
    // a token of the team alone, not scoped to any price
    const unscoped = createHmac('sha256', SECRET).update('nextspark-paddle-team:team-5').digest('hex')
    await post(subscriptionEvent('subscription.created', {}, { teamId: 'team-5', teamToken: unscoped }, 'sub_unscoped', { occurredAt: '2026-10-05T00:00:00Z' }))
    expect(errors.mock.calls.filter(([message]) => String(message).includes('the team token of team team-5 does not match'))).toHaveLength(2)
    expect(await row('sub-5')).toEqual(sub5)
  })

  test('a sandbox event cannot be applied by a production deployment (its own secret)', async () => {
    await addTeam(7)
    const sub7 = await row('sub-7')
    const env = process.env as Record<string, string | undefined>
    const saved = { key: env.PADDLE_API_KEY, secret: env.PADDLE_WEBHOOK_SECRET, environment: env.PADDLE_ENVIRONMENT }
    env.PADDLE_API_KEY = 'pdl_live_apikey_e2e'
    env.PADDLE_WEBHOOK_SECRET = 'pdl_ntfset_live_e2e_secret'
    env.PADDLE_ENVIRONMENT = 'production'
    resetGateway()
    try {
      // signed by the sandbox notification destination, delivered to the production deployment
      const sandboxEvent = subscriptionEvent('subscription.created', {}, customFor('team-7'), 'sub_sandbox', { occurredAt: '2026-10-08T00:00:00Z' })
      expect(await post(sandboxEvent, sign(sandboxEvent, SECRET))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
      expect(await row('sub-7')).toEqual(sub7)
      // a sandbox API key is refused by a production deployment at selection: the webhook answers 400 as well
      env.PADDLE_API_KEY = 'pdl_sdbx_apikey_e2e'
      resetGateway()
      expect(await post(sandboxEvent, sign(sandboxEvent, 'pdl_ntfset_live_e2e_secret'))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
      expect(console.error).toHaveBeenCalledWith('[paddle-webhook] Signature verification failed:', expect.objectContaining({
        message: 'Paddle billing is misconfigured: PADDLE_API_KEY is a sandbox key but PADDLE_ENVIRONMENT is production.',
      }))
      expect(await row('sub-7')).toEqual(sub7)
    } finally {
      env.PADDLE_API_KEY = saved.key
      env.PADDLE_WEBHOOK_SECRET = saved.secret
      env.PADDLE_ENVIRONMENT = saved.environment
      resetGateway()
    }
  })

  test('a team with a live subscription of another provider is not switched by a new one', async () => {
    await addTeam(6, `, 'stripe', 'sub_stripe_live'`)
    const sub6 = await row('sub-6')
    const errors = console.error as jest.Mock
    errors.mockClear()
    const body = subscriptionEvent('subscription.created', {}, customFor('team-6'), 'sub_six', { eventId: 'evt_cross', occurredAt: '2026-10-07T00:00:00Z' })
    expect((await post(body)).status).toBe(200)
    expect(errors).toHaveBeenCalledWith(expect.stringContaining(
      'Event evt_cross: team team-6 has a live stripe subscription sub_stripe_live; paddle subscription sub_six is not applied'
    ))
    expect(await row('sub-6')).toEqual(sub6)

    // once the Stripe subscription has ended, the same team's new Paddle subscription is applied
    await db.query(`UPDATE subscriptions SET status = 'canceled', "canceledAt" = now() WHERE id = 'sub-6'`)
    expect((await post(subscriptionEvent('subscription.updated', {}, customFor('team-6'), 'sub_six', { occurredAt: '2026-10-07T00:00:01Z' }))).status).toBe(200)
    expect(await row('sub-6')).toMatchObject({ externalSubscriptionId: 'sub_six', paymentProvider: 'paddle', status: 'active', hasCanceledAt: false })
  })

  test('an unknown team or subscription creates no rows and binds nothing to the wrong team', async () => {
    const before = await counts()
    const sub2 = await row('sub-2')
    const at = { occurredAt: '2026-10-03T00:00:00Z' }

    // custom data written in the browser (Paddle.js customData) with no valid token
    await post(subscriptionEvent('subscription.created', {}, { teamId: 'team-3' }, 'sub_x1', at))
    await post(subscriptionEvent('subscription.created', {}, { teamId: 'team-3', teamToken: teamToken('team-1') }, 'sub_x2', at))
    // a valid token for a team that does not exist
    await post(subscriptionEvent('subscription.created', {}, customFor('team-404'), 'sub_x3', at))
    // no custom data at all, and an update for a subscription that is not ours
    await post(subscriptionEvent('subscription.created', {}, null, 'sub_x4', at))
    await post(subscriptionEvent('subscription.updated', { status: 'canceled' }, null, 'sub_x5', at))
    // team-2 already has subscription sub_two: a second one is not bound over it
    await post(subscriptionEvent('subscription.created', {}, customFor('team-2'), 'sub_x6', at))
    // an event about team-2's subscription whose custom data names team-1
    await post(subscriptionEvent('subscription.canceled', { status: 'canceled' }, customFor('team-1'), 'sub_two', at))
    // payments: for a subscription that is not ours, and with a hand-written team
    await post(transactionEvent('transaction.completed', { subscription_id: 'sub_x7' }, null, 'txn_x1', at))
    await post(transactionEvent('transaction.completed', { subscription_id: null }, { teamId: 'team-2' }, 'txn_x2', at))
    // a payment of team-2's subscription whose custom data names team-1
    await post(transactionEvent('transaction.completed', { subscription_id: 'sub_two' }, customFor('team-1'), 'txn_x3', at))

    expect(await counts()).toEqual(before)
    expect(await row('sub-2')).toEqual(sub2)
    expect((await db.query(`SELECT count(*)::int AS n FROM subscriptions WHERE "externalSubscriptionId" LIKE 'sub_x%'`)).rows[0].n).toBe(0)
  })

  test('a failing handler releases the claim and rolls back its writes; the retry processes the event', async () => {
    // the lifecycle row of this event fails to insert, after the subscription row was updated
    await db.query(`
      CREATE FUNCTION fail_e2e() RETURNS trigger LANGUAGE plpgsql AS $$
      BEGIN RAISE EXCEPTION 'billing_events unavailable'; END $$;
      CREATE TRIGGER fail_e2e BEFORE INSERT ON billing_events FOR EACH ROW
        WHEN (NEW.metadata->>'paddleEventId' = 'evt_fails') EXECUTE FUNCTION fail_e2e();
    `)
    const body = subscriptionEvent('subscription.paused', { status: 'paused' }, null, 'sub_three', { eventId: 'evt_fails', occurredAt: '2026-11-10T00:00:00Z' })
    const before = await counts()
    try {
      expect(await post(body)).toEqual({ status: 500, body: { error: 'Handler failed' } })
      expect(await claim('evt_fails')).toBeNull()
      expect(await row('sub-3')).toMatchObject({ status: 'active' }) // the row update rolled back
      expect(await counts()).toEqual(before)
    } finally {
      await db.query(`DROP TRIGGER fail_e2e ON billing_events; DROP FUNCTION fail_e2e();`)
    }

    expect(await post(body)).toEqual({ status: 200, body: { received: true } })
    expect(await claim('evt_fails')).toBe('processed')
    expect(await row('sub-3')).toMatchObject({ status: 'paused' })
    expect((await counts()).events).toBe(before.events + 1)
  })

  test('an unknown event is answered 200 and recorded', async () => {
    const before = await counts()
    const unknown = JSON.stringify({ event_id: 'evt_unknown', event_type: 'customer.created', occurred_at: '2026-10-01T00:00:00Z', data: { id: 'ctm_e2e' } })
    expect(await post(unknown)).toEqual({ status: 200, body: { received: true } })
    expect(await claim('evt_unknown')).toBe('processed')
    expect(await counts()).toEqual(before)
  })

  test('a first payment that arrives before its subscription.created is recorded for the verified team, once', async () => {
    await addTeam(4)
    const sub4 = await row('sub-4')
    const at = { occurredAt: '2026-10-04T00:00:00Z' }
    const completed = transactionEvent('transaction.completed', { origin: 'web', subscription_id: 'sub_four' }, customFor('team-4'), 'txn_first', at)
    expect(await post(completed)).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-4')).toEqual(sub4) // the row is left to the subscription events
    expect(await post(completed)).toEqual({ status: 200, body: { received: true, status: 'duplicate' } })

    expect((await post(subscriptionEvent('subscription.created', {}, customFor('team-4'), 'sub_four', at))).status).toBe(200)
    expect(await row('sub-4')).toMatchObject({ externalSubscriptionId: 'sub_four', plan: 'pro' })
    // transaction.paid of the same transaction, delivered late: still one payment
    expect((await post(transactionEvent('transaction.paid', { origin: 'web', subscription_id: 'sub_four' }, customFor('team-4'), 'txn_first', at))).status).toBe(200)
    expect((await billingEvents('sub-4')).filter(event => event.type === 'payment').map(event => [event.status, event.externalPaymentId, event.metadata.paddleSubscriptionId]))
      .toEqual([['succeeded', 'txn_first', 'sub_four']])
  })

  test('a one-time purchase with a verified team is recorded on the team\'s row', async () => {
    const before = (await billingEvents('sub-4')).length
    const oneTime = transactionEvent('transaction.completed', { origin: 'web', subscription_id: null, priceId: 'pri_credits' }, { ...customFor('team-4', 'pri_credits'), type: 'credit_pack' }, 'txn_credits', { occurredAt: '2026-10-09T00:00:00Z' })
    expect(await post(oneTime)).toEqual({ status: 200, body: { received: true } })
    const events = await billingEvents('sub-4')
    expect(events).toHaveLength(before + 1)
    expect(events.at(-1)).toMatchObject({ type: 'payment', status: 'succeeded', amount: 2900, externalPaymentId: 'txn_credits' })
  })
})
