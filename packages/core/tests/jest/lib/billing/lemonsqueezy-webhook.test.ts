/**
 * The Lemon Squeezy webhook (#268) end to end against a real PostgreSQL with core's migrations: real signatures, the
 * real factory and gateway, the real dedup helper and lib/db.ts. Nothing reaches Lemon Squeezy: the payloads are
 * hand-built from the documented shapes (docs.lemonsqueezy.com: webhook requests, event types, the subscription,
 * subscription invoice and order objects), not recorded from a store.
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
    provider: 'lemonsqueezy',
    plans: [
      { slug: 'free', name: 'Free', providerPriceIds: { monthly: null, yearly: null }, limits: {}, features: [] },
      { slug: 'pro', name: 'Pro', providerPriceIds: { monthly: '1001', yearly: '1002' }, limits: {}, features: [] },
    ],
    limits: {},
  },
}))

const CORE = path.resolve(__dirname, '../../../..')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const describeWithPostgres = HAS_POSTGRES ? describe : describe.skip

const SECRET = 'ls_webhook_secret_e2e'
const STORE = '4242'

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

const sign = (body: string, secret = SECRET) => createHmac('sha256', secret).update(body).digest('hex')

/** A request as the handler reads it: the raw bytes and the headers. */
function request(body: string, signature: string | null = sign(body)) {
  const headers = new Map(signature === null ? [] : [['x-signature', signature]])
  return {
    arrayBuffer: async () => new TextEncoder().encode(body).buffer,
    headers: { get: (name: string) => headers.get(name.toLowerCase()) ?? null },
  } as never
}

async function responseOf(response: Response) {
  return { status: response.status, body: await response.json() }
}

let teamToken: (teamId: string, variantId?: string) => string

/** custom data as our checkout sets it: the team and its token for the checkout's variant (1001: pro monthly). */
const customFor = (teamId: string, variantId = '1001') => ({ teamId, teamToken: teamToken(teamId, variantId), planSlug: 'pro', billingPeriod: 'monthly' })

function subscriptionEvent(name: string, attributes: Record<string, unknown>, custom: Record<string, unknown> | null, id = '555') {
  return JSON.stringify({
    meta: { event_name: name, test_mode: true, webhook_id: 'wh-1', ...(custom && { custom_data: custom }) },
    data: {
      type: 'subscriptions',
      id,
      attributes: {
        store_id: Number(STORE),
        customer_id: 77,
        order_id: 1,
        product_id: 10,
        variant_id: 1001,
        status: 'active',
        cancelled: false,
        pause: null,
        trial_ends_at: null,
        renews_at: '2026-11-01T00:00:00.000000Z',
        ends_at: null,
        created_at: '2026-10-01T00:00:00.000000Z',
        test_mode: true,
        ...attributes,
      },
    },
  })
}

function invoiceEvent(name: string, attributes: Record<string, unknown>, custom: Record<string, unknown> | null = null, id = 'inv-1') {
  return JSON.stringify({
    meta: { event_name: name, test_mode: true, ...(custom && { custom_data: custom }) },
    data: {
      type: 'subscription-invoices',
      id,
      attributes: {
        store_id: Number(STORE),
        subscription_id: 555,
        customer_id: 77,
        billing_reason: 'renewal',
        status: 'paid',
        total: 2900,
        currency: 'USD',
        urls: { invoice_url: 'https://store.lemonsqueezy.com/my-orders/x/subscription-invoice/1' },
        test_mode: true,
        ...attributes,
      },
    },
  })
}

function orderEvent(id: string, custom: Record<string, unknown> | null, attributes: Record<string, unknown> = {}) {
  return JSON.stringify({
    meta: { event_name: 'order_created', test_mode: true, ...(custom && { custom_data: custom }) },
    data: {
      type: 'orders',
      id,
      attributes: {
        store_id: Number(STORE),
        customer_id: 77,
        identifier: `uuid-${id}`,
        status: 'paid',
        total: 500,
        currency: 'USD',
        first_order_item: { order_id: Number(id), product_id: 30, variant_id: 3001 },
        created_at: '2026-10-01T00:00:00.000000Z',
        updated_at: '2026-10-01T00:00:00.000000Z',
        test_mode: true,
        ...attributes,
      },
    },
  })
}

describeWithPostgres('Lemon Squeezy webhook', () => {
  let dir: string
  let db: Client
  let handler: (extensions?: object) => (req: never) => Promise<Response>
  let closePool: () => Promise<void>

  const post = async (body: string, extensions: object = {}, signature?: string | null) =>
    responseOf(await handler(extensions)(request(body, signature === undefined ? sign(body) : signature)))

  const row = async (id: string) => (await db.query(
    `SELECT s."externalSubscriptionId", s."externalCustomerId", s."paymentProvider", s.status, s."cancelAtPeriodEnd",
            s."canceledAt" IS NOT NULL AS "hasCanceledAt", s."currentPeriodEnd", s."trialEndsAt", p.slug AS plan, s."billingInterval"
     FROM subscriptions s JOIN plans p ON p.id = s."planId" WHERE s.id = $1`, [id])).rows[0]
  const billingEvents = async (subscriptionId: string) => (await db.query(
    `SELECT type, status, amount, currency, "externalPaymentId", metadata FROM billing_events WHERE "subscriptionId" = $1 ORDER BY "createdAt", id`,
    [subscriptionId])).rows
  /** The claim of an event, by its id without the body hash. */
  const claim = async (eventIdPrefix: string) => (await db.query(
    `SELECT status FROM billing_webhook_events WHERE gateway = 'lemonsqueezy' AND "eventId" LIKE $1 || ':%'`, [eventIdPrefix])).rows[0]?.status ?? null
  const counts = async () => (await db.query(
    `SELECT (SELECT count(*) FROM subscriptions)::int AS subscriptions, (SELECT count(*) FROM billing_events)::int AS events`)).rows[0]

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lemonsqueezy-webhook-pg-'))
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
      INSERT INTO teams (id, name, slug, "ownerId") VALUES
        ('team-1', 'Team 1', 'team-1', 'u1'), ('team-2', 'Team 2', 'team-2', 'u1'), ('team-3', 'Team 3', 'team-3', 'u1');
      -- team-1 and team-3: the free subscription a team starts with; team-2: already on Lemon Squeezy subscription 999
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd") VALUES
        ('sub-1', 'team-1', 'plan-free', 'active', now(), now() + interval '30 days'),
        ('sub-3', 'team-3', 'plan-free', 'active', now(), now() + interval '30 days');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "paymentProvider", "externalSubscriptionId") VALUES
        ('sub-2', 'team-2', 'plan-pro', 'active', now(), now() + interval '30 days', 'lemonsqueezy', '999');
    `)

    process.env.DATABASE_URL = url
    delete process.env.DATABASE_SERVICE_URL
    process.env.LEMONSQUEEZY_API_KEY = 'ls_api_key_e2e'
    process.env.LEMONSQUEEZY_STORE_ID = STORE
    process.env.LEMONSQUEEZY_WEBHOOK_SECRET = SECRET
    const { createLemonSqueezyWebhookHandler } = require('@nextsparkjs/core/routes/_internal/lemonsqueezy-webhook')
    handler = (extensions = {}) => createLemonSqueezyWebhookHandler(async () => extensions)
    const { lemonSqueezyTeamToken } = require('@nextsparkjs/core/lib/billing/lemonsqueezy-webhook')
    teamToken = (teamId: string, variantId = '1001') => lemonSqueezyTeamToken(teamId, variantId, SECRET)
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

  test('a bad, missing or foreign signature is refused before anything is claimed or written', async () => {
    const before = await counts()
    const body = subscriptionEvent('subscription_created', { updated_at: '2026-10-01T00:00:00.000000Z' }, customFor('team-1'))
    expect(await post(body, {}, null)).toEqual({ status: 400, body: { error: 'No signature provided' } })
    expect(await post(body, {}, 'f'.repeat(64))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect(await post(body, {}, sign(body, 'another_secret'))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect(await post(body.replace('"status":"active"', '"status":"expired"'), {}, sign(body))).toEqual({ status: 400, body: { error: 'Invalid signature' } })
    expect((await db.query(`SELECT count(*)::int AS n FROM billing_webhook_events`)).rows[0].n).toBe(0)
    expect(await counts()).toEqual(before)
  })

  test('created, updated, cancelled, then expired move team-1\'s row through the lifecycle', async () => {
    // subscription_created: on trial, bound to team-1's free row through the verified custom data
    expect(await post(subscriptionEvent('subscription_created', {
      status: 'on_trial', trial_ends_at: '2026-10-15T00:00:00.000000Z', renews_at: '2026-10-15T00:00:00.000000Z', updated_at: '2026-10-01T00:00:01.000000Z',
    }, customFor('team-1')))).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-1')).toMatchObject({
      externalSubscriptionId: '555', externalCustomerId: '77', paymentProvider: 'lemonsqueezy', status: 'trialing',
      cancelAtPeriodEnd: false, hasCanceledAt: false, plan: 'pro', billingInterval: 'monthly',
      currentPeriodEnd: new Date('2026-10-15T00:00:00Z'), trialEndsAt: new Date('2026-10-15T00:00:00Z'),
    })

    // subscription_updated: trial over, active, yearly variant; no custom data needed once bound
    expect((await post(subscriptionEvent('subscription_updated', {
      status: 'active', variant_id: 1002, renews_at: '2027-10-15T00:00:00.000000Z', updated_at: '2026-10-15T00:00:01.000000Z',
    }, null))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ status: 'active', trialEndsAt: null, billingInterval: 'yearly', currentPeriodEnd: new Date('2027-10-15T00:00:00Z') })

    // subscription_cancelled: grace period until ends_at
    expect((await post(subscriptionEvent('subscription_cancelled', {
      status: 'cancelled', cancelled: true, variant_id: 1002, ends_at: '2027-10-15T00:00:00.000000Z', updated_at: '2026-10-20T00:00:00.000000Z',
    }, customFor('team-1')))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ status: 'active', cancelAtPeriodEnd: true, hasCanceledAt: true, currentPeriodEnd: new Date('2027-10-15T00:00:00Z') })

    // subscription_expired: over
    expect((await post(subscriptionEvent('subscription_expired', {
      status: 'expired', cancelled: true, variant_id: 1002, ends_at: '2027-10-15T00:00:00.000000Z', updated_at: '2027-10-15T00:00:01.000000Z',
    }, customFor('team-1')))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ status: 'expired', cancelAtPeriodEnd: false, hasCanceledAt: true, externalSubscriptionId: '555' })

    expect((await billingEvents('sub-1')).map(event => [event.type, event.status, event.metadata.event])).toEqual([
      ['lifecycle', 'succeeded', 'subscription_created'],
      ['lifecycle', 'succeeded', 'subscription_cancelled'],
      ['lifecycle', 'succeeded', 'subscription_expired'],
    ])
  })

  test('a replayed event is a duplicate and changes nothing; an older event does not move the row back', async () => {
    const body = subscriptionEvent('subscription_expired', {
      status: 'expired', cancelled: true, variant_id: 1002, ends_at: '2027-10-15T00:00:00.000000Z', updated_at: '2027-10-15T00:00:01.000000Z',
    }, customFor('team-1'))
    const before = await counts()
    expect(await post(body)).toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
    expect(await counts()).toEqual(before)

    // a late retry of an update older than the expiry: processed, but the row stays expired
    expect((await post(subscriptionEvent('subscription_updated', { status: 'active', updated_at: '2026-10-16T00:00:00.000000Z' }, null))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ status: 'expired' })
  })

  test('after the expiry, a new subscription of the team is applied to its latest row (#300)', async () => {
    expect((await post(subscriptionEvent('subscription_created', { updated_at: '2027-11-01T00:00:00.000000Z' }, customFor('team-1'), '556'))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({
      externalSubscriptionId: '556', status: 'active', cancelAtPeriodEnd: false, hasCanceledAt: false, plan: 'pro', billingInterval: 'monthly',
    })
    // the expired subscription's events no longer reach the row
    expect((await post(subscriptionEvent('subscription_updated', { status: 'expired', updated_at: '2027-11-02T00:00:00.000000Z' }, null, '555'))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: '556', status: 'active' })
  })

  test('a late event of an older subscription does not reactivate a row a newer one has bound and ended', async () => {
    // 556 expires too: the row is expired and bound to 556
    expect((await post(subscriptionEvent('subscription_expired', {
      status: 'expired', cancelled: true, ends_at: '2027-12-01T00:00:00.000000Z', updated_at: '2027-12-01T00:00:00.000000Z',
    }, customFor('team-1'), '556'))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: '556', status: 'expired' })

    // a delivery of 555 from before its expiry, as active, arrives late
    expect(await post(subscriptionEvent('subscription_updated', { status: 'active', updated_at: '2027-10-14T00:00:00.000000Z' }, customFor('team-1'), '555')))
      .toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: '556', status: 'expired' })

    // a new subscription after 556 ended still binds
    expect((await post(subscriptionEvent('subscription_created', { updated_at: '2027-12-10T00:00:00.000000Z' }, customFor('team-1'), '557'))).status).toBe(200)
    expect(await row('sub-1')).toMatchObject({ externalSubscriptionId: '557', status: 'active', hasCanceledAt: false })
  })

  test('a subscription whose expiry arrives before its created ends expired', async () => {
    // team-9's previous subscription ended: its row is expired
    await db.query(`
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-9', 'Team 9', 'team-9', 'u1');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd")
        VALUES ('sub-9', 'team-9', 'plan-free', 'expired', now() - interval '60 days', now() - interval '30 days');
    `)
    // B's expiry is delivered first
    expect(await post(subscriptionEvent('subscription_expired', {
      status: 'expired', cancelled: true, ends_at: '2026-10-20T00:00:10.000000Z', updated_at: '2026-10-20T00:00:10.000000Z',
    }, customFor('team-9'), '901'))).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-9')).toMatchObject({ externalSubscriptionId: '901', paymentProvider: 'lemonsqueezy', status: 'expired' })
    // then B's creation, active and older: the row stays expired on B
    expect(await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-20T00:00:00.000000Z' }, customFor('team-9'), '901')))
      .toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-9')).toMatchObject({ externalSubscriptionId: '901', status: 'expired' })
  })

  test('a payment failure is recorded and marks the row past_due; the recovery marks it active', async () => {
    // team-3 subscribes: bound, active
    expect((await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-02T00:00:00.000000Z' }, customFor('team-3'), '777'))).status).toBe(200)
    expect(await row('sub-3')).toMatchObject({ externalSubscriptionId: '777', status: 'active', plan: 'pro' })

    expect(await post(invoiceEvent('subscription_payment_failed', { subscription_id: 777, status: 'pending', updated_at: '2026-11-02T00:00:00.000000Z' }, null, 'inv-f')))
      .toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-3')).toMatchObject({ status: 'past_due' })

    expect((await post(invoiceEvent('subscription_payment_success', { subscription_id: 777, updated_at: '2026-11-05T00:00:00.000000Z' }, null, 'inv-s'))).status).toBe(200)
    expect(await row('sub-3')).toMatchObject({ status: 'active' })

    const payments = (await billingEvents('sub-3')).filter(event => event.type === 'payment')
    expect(payments.map(event => [event.status, event.amount, event.currency, event.externalPaymentId])).toEqual([
      ['failed', 2900, 'usd', 'inv-f'],
      ['succeeded', 2900, 'usd', 'inv-s'],
    ])
  })

  test('two updates within the same second are both applied (the key includes the body hash)', async () => {
    const at = '2026-11-06T00:00:00.000000Z'
    expect(await post(subscriptionEvent('subscription_updated', { variant_id: 1002, updated_at: at }, null, '777'))).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-3')).toMatchObject({ billingInterval: 'yearly' })
    expect(await post(subscriptionEvent('subscription_updated', { variant_id: 1001, updated_at: at }, null, '777'))).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-3')).toMatchObject({ billingInterval: 'monthly' })
    // a byte-identical redelivery is still one event
    expect(await post(subscriptionEvent('subscription_updated', { variant_id: 1001, updated_at: at }, null, '777'))).toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
  })

  test('a handled event with no data.id or updated_at is refused with 400 and claims nothing', async () => {
    const before = (await db.query(`SELECT count(*)::int AS n FROM billing_webhook_events`)).rows[0].n
    const noUpdatedAt = subscriptionEvent('subscription_updated', {}, null, '777')
    expect(await post(noUpdatedAt)).toEqual({ status: 400, body: { error: 'Event has no data.id or data.attributes.updated_at' } })
    const noId = JSON.stringify({ meta: { event_name: 'order_created' }, data: { type: 'orders', attributes: { store_id: Number(STORE), updated_at: '2026-10-01T00:00:00.000000Z' } } })
    expect((await post(noId)).status).toBe(400)
    // an updated_at that is not a date cannot be ordered either
    expect(await post(subscriptionEvent('subscription_updated', { updated_at: 'not-a-date' }, null, '777')))
      .toEqual({ status: 400, body: { error: 'Event has no data.id or data.attributes.updated_at' } })
    expect((await db.query(`SELECT count(*)::int AS n FROM billing_webhook_events`)).rows[0].n).toBe(before)
  })

  test('a subscription of a variant that is no plan\'s, or a token of another variant, binds nothing', async () => {
    await db.query(`
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-5', 'Team 5', 'team-5', 'u1');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd")
        VALUES ('sub-5', 'team-5', 'plan-free', 'active', now(), now() + interval '30 days');
    `)
    const sub5 = await row('sub-5')
    const errors = console.error as jest.Mock
    errors.mockClear()
    // a recurring add-on bought through createOneTimeCheckout: its token is valid, its variant is no plan's
    await post(subscriptionEvent('subscription_created', { variant_id: 3001, updated_at: '2026-10-05T00:00:00.000000Z' }, customFor('team-5', '3001'), '851'))
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('is of variant 3001, which is no plan\'s'))
    // a plan variant with the token of another variant (a token of a cheap checkout reused)
    await post(subscriptionEvent('subscription_created', { variant_id: 1002, updated_at: '2026-10-05T00:00:00.000000Z' }, customFor('team-5', '3001'), '852'))
    expect(errors).toHaveBeenCalledWith(expect.stringContaining('the team token of team team-5 does not match'))
    expect(await row('sub-5')).toEqual(sub5)
  })

  test('in production, test-mode events are ignored with one error per process, unless LEMONSQUEEZY_ACCEPT_TEST_MODE=true', async () => {
    const sub5 = await row('sub-5')
    const env = process.env as Record<string, string | undefined>
    const nodeEnv = env.NODE_ENV
    const errors = console.error as jest.Mock
    errors.mockClear()
    env.NODE_ENV = 'production'
    try {
      const first = subscriptionEvent('subscription_created', { updated_at: '2026-10-06T00:00:00.000000Z' }, customFor('team-5'), '853')
      const second = subscriptionEvent('subscription_created', { updated_at: '2026-10-06T00:00:01.000000Z' }, customFor('team-5'), '853')
      expect(await post(first)).toEqual({ status: 200, body: { received: true, status: 'ignored_test_mode' } })
      expect(await post(second)).toEqual({ status: 200, body: { received: true, status: 'ignored_test_mode' } })
      expect(errors.mock.calls.filter(([message]) => String(message).includes('LEMONSQUEEZY_ACCEPT_TEST_MODE=true'))).toHaveLength(1)
      expect(await claim('subscription_created:subscriptions:853:2026-10-06T00:00:00.000000Z')).toBeNull()
      expect(await row('sub-5')).toEqual(sub5)

      // staging or a preview on test data: an explicit opt-in
      env.LEMONSQUEEZY_ACCEPT_TEST_MODE = 'true'
      expect(await post(first)).toEqual({ status: 200, body: { received: true } })
      expect(await row('sub-5')).toMatchObject({ externalSubscriptionId: '853', paymentProvider: 'lemonsqueezy', plan: 'pro' })
    } finally {
      env.NODE_ENV = nodeEnv
      delete env.LEMONSQUEEZY_ACCEPT_TEST_MODE
    }
  })

  test('a team with a live subscription of another provider is not switched by a new one', async () => {
    await db.query(`
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-6', 'Team 6', 'team-6', 'u1');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "paymentProvider", "externalSubscriptionId")
        VALUES ('sub-6', 'team-6', 'plan-pro', 'active', now(), now() + interval '30 days', 'stripe', 'sub_stripe_live');
    `)
    const sub6 = await row('sub-6')
    const errors = console.error as jest.Mock
    errors.mockClear()
    expect((await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-07T00:00:00.000000Z' }, customFor('team-6'), '861'))).status).toBe(200)
    expect(errors).toHaveBeenCalledWith(expect.stringMatching(/Event subscription_created:subscriptions:861:.*team team-6 has a live stripe subscription sub_stripe_live; lemonsqueezy subscription 861 is not applied/))
    expect(await row('sub-6')).toEqual(sub6)

    // once the Stripe subscription has ended, the same team's new Lemon Squeezy subscription is applied
    await db.query(`UPDATE subscriptions SET status = 'canceled', "canceledAt" = now() WHERE id = 'sub-6'`)
    expect((await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-07T00:00:01.000000Z' }, customFor('team-6'), '861'))).status).toBe(200)
    expect(await row('sub-6')).toMatchObject({ externalSubscriptionId: '861', paymentProvider: 'lemonsqueezy', status: 'active', hasCanceledAt: false })
  })

  test('an unknown team or subscription creates no rows and binds nothing to the wrong team', async () => {
    const before = await counts()
    const sub2 = await row('sub-2')

    // a checkout link with a hand-written teamId and no valid token
    await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-03T00:00:00.000000Z' }, { teamId: 'team-3' }, '801'))
    await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-03T00:00:00.000000Z' }, { teamId: 'team-3', teamToken: teamToken('team-1') }, '802'))
    // a valid token for a team that does not exist
    await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-03T00:00:00.000000Z' }, customFor('team-404'), '803'))
    // no custom data at all, and an update for a subscription that is not ours
    await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-03T00:00:00.000000Z' }, null, '804'))
    await post(subscriptionEvent('subscription_updated', { status: 'expired', updated_at: '2026-10-03T00:00:00.000000Z' }, null, '805'))
    // team-2 already has subscription 999: a second one is not bound over it
    await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-03T00:00:00.000000Z' }, customFor('team-2'), '806'))
    // an event about team-2's subscription whose custom data names team-1
    await post(subscriptionEvent('subscription_expired', { status: 'expired', updated_at: '2026-10-03T00:00:00.000000Z' }, customFor('team-1'), '999'))
    // a payment for a subscription that is not ours
    await post(invoiceEvent('subscription_payment_success', { subscription_id: 4040, updated_at: '2026-10-03T00:00:00.000000Z' }, null, 'inv-x'))
    // another store's event about team-2's subscription
    await post(subscriptionEvent('subscription_expired', { status: 'expired', store_id: 1, updated_at: '2026-10-03T00:00:01.000000Z' }, null, '999'))
    // a one-time order with a hand-written team
    const onOneTimePaymentCompleted = jest.fn(async () => {})
    await post(orderEvent('9001', { teamId: 'team-2' }), { onOneTimePaymentCompleted })

    expect(onOneTimePaymentCompleted).not.toHaveBeenCalled()
    expect(await counts()).toEqual(before)
    expect(await row('sub-2')).toEqual(sub2)
    expect((await db.query(`SELECT count(*)::int AS n FROM subscriptions WHERE "externalSubscriptionId" IN ('801','802','803','804','805','806')`)).rows[0].n).toBe(0)
  })

  test('a failing handler releases the claim and rolls back its writes; the retry processes the event', async () => {
    const body = orderEvent('9002', { ...customFor('team-3', '3001'), type: 'credit_pack' })
    const failing = jest.fn(async () => { throw new Error('credit service down') })
    const before = await counts()

    expect(await post(body, { onOneTimePaymentCompleted: failing })).toEqual({ status: 500, body: { error: 'Handler failed' } })
    expect(await claim(`order_created:orders:9002:2026-10-01T00:00:00.000000Z`)).toBeNull()
    expect(await counts()).toEqual(before) // the billing_events row written before the throw rolled back

    const working = jest.fn(async () => {})
    expect(await post(body, { onOneTimePaymentCompleted: working })).toEqual({ status: 200, body: { received: true } })
    expect(working).toHaveBeenCalledWith(
      expect.objectContaining({ id: '9002', total: 500, currency: 'usd', variantId: '3001', metadata: expect.objectContaining({ type: 'credit_pack', teamId: 'team-3' }) }),
      { teamId: 'team-3', userId: '' }
    )
    expect(await claim(`order_created:orders:9002:2026-10-01T00:00:00.000000Z`)).toBe('processed')
    expect((await counts()).events).toBe(before.events + 1)
  })

  test('a plan\'s order is left to its subscription events; an unknown event is answered 200 and recorded', async () => {
    const extension = jest.fn(async () => {})
    const before = await counts()
    expect((await post(orderEvent('9003', customFor('team-3'), { first_order_item: { variant_id: 1001, product_id: 10 } }), { onOneTimePaymentCompleted: extension })).status).toBe(200)
    expect(extension).not.toHaveBeenCalled()

    const unknown = JSON.stringify({ meta: { event_name: 'license_key_created' }, data: { type: 'license-keys', id: '1', attributes: { store_id: Number(STORE), updated_at: '2026-10-01T00:00:00.000000Z' } } })
    expect(await post(unknown)).toEqual({ status: 200, body: { received: true } })
    expect(await claim('license_key_created:license-keys:1:2026-10-01T00:00:00.000000Z')).toBe('processed')
    expect(await counts()).toEqual(before)
  })

  test('a first payment that arrives before its subscription_created is recorded for the verified team, once', async () => {
    await db.query(`
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-4', 'Team 4', 'team-4', 'u1');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd")
        VALUES ('sub-4', 'team-4', 'plan-free', 'active', now(), now() + interval '30 days');
    `)
    const sub4 = await row('sub-4')
    const payment = invoiceEvent('subscription_payment_success', { subscription_id: 888, billing_reason: 'initial', updated_at: '2026-10-04T00:00:00.000000Z' }, customFor('team-4'), 'inv-first')
    expect(await post(payment)).toEqual({ status: 200, body: { received: true } })
    expect(await row('sub-4')).toEqual(sub4) // the row is left to the subscription events
    expect(await post(payment)).toEqual({ status: 200, body: { received: true, status: 'duplicate' } })

    expect((await post(subscriptionEvent('subscription_created', { updated_at: '2026-10-04T00:00:00.000000Z' }, customFor('team-4'), '888'))).status).toBe(200)
    expect(await row('sub-4')).toMatchObject({ externalSubscriptionId: '888', plan: 'pro' })
    expect((await billingEvents('sub-4')).filter(event => event.type === 'payment').map(event => [event.status, event.externalPaymentId, event.metadata.lemonSqueezySubscriptionId]))
      .toEqual([['succeeded', 'inv-first', '888']])
  })

})
