/**
 * Billing webhook deduplication (#266) against a real PostgreSQL with core's migrations: the Stripe and Polar
 * handlers claim each event in billing_webhook_events, so a repeated or concurrent delivery is processed once, a
 * failed delivery is processed again on retry, and a dead delivery's claim is taken over after the lease.
 *
 * Only the signature check is mocked (it returns the posted event). The test starts a throwaway cluster with initdb
 * and pg_ctl on a free port, and is skipped when they are not on the PATH.
 */
import { execFileSync, spawnSync } from 'node:child_process'
import fs from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { Client } from 'pg'

jest.mock('@nextsparkjs/core/lib/billing/gateways/factory', () => ({
  getBillingGateway: async () => ({ verifyWebhookSignature: (payload: string) => JSON.parse(payload) }),
}))

const CORE = path.resolve(__dirname, '../../../..')
const HAS_POSTGRES = ['initdb', 'pg_ctl'].every(bin => spawnSync(bin, ['--version']).status === 0)
const describeWithPostgres = HAS_POSTGRES ? describe : describe.skip

async function freePort() {
  const server = net.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as net.AddressInfo
  await new Promise(resolve => server.close(resolve))
  return port
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** A request as the handlers read it: the raw body and the headers. */
function webhookRequest(event: object, headers: Record<string, string> = {}) {
  const map = new Map(Object.entries(headers))
  return {
    text: async () => JSON.stringify(event),
    headers: { get: (name: string) => map.get(name) ?? null, forEach: (fn: (v: string, k: string) => void) => map.forEach(fn) },
  } as never
}

const stripeRequest = (event: object) => webhookRequest(event, { 'stripe-signature': 'sig' })
const polarRequest = (event: { id: string }) =>
  webhookRequest(event, { 'webhook-id': event.id, 'webhook-signature': 'sig', 'webhook-timestamp': '1' })

async function responseOf(response: Response) {
  return { status: response.status, body: await response.json() }
}

describeWithPostgres('billing webhook deduplication', () => {
  let dir: string
  let db: Client
  let handleStripeWebhook: typeof import('@nextsparkjs/core/lib/billing/stripe-webhook').handleStripeWebhook
  let createPolarWebhookHandler: typeof import('@nextsparkjs/core/routes/_internal/polar-webhook').createPolarWebhookHandler
  let webhookEvents: typeof import('@nextsparkjs/core/lib/billing/webhook-events')
  let closePool: () => Promise<void>

  beforeAll(async () => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'webhook-dedupe-pg-'))
    const port = await freePort()
    execFileSync('initdb', ['-D', path.join(dir, 'data'), '--auth=trust', '--no-locale', '--encoding=UTF8', '--username', 'owner'], { stdio: 'ignore' })
    execFileSync('pg_ctl', ['-D', path.join(dir, 'data'), '-l', path.join(dir, 'log'), '-o', `-h 127.0.0.1 -p ${port} -k ${dir}`, 'start', '-w'], { stdio: 'ignore' })
    const url = `postgresql://owner@127.0.0.1:${port}/postgres?sslmode=disable`
    db = new Client({ connectionString: url })
    // the cluster stops under it at the end
    db.on('error', () => {})
    await db.connect()
    for (const file of fs.readdirSync(path.join(CORE, 'migrations')).filter(f => f.endsWith('.sql') && f !== '090_sample_data.sql').sort()) {
      await db.query(fs.readFileSync(path.join(CORE, 'migrations', file), 'utf8'))
    }
    await db.query(`
      INSERT INTO users (id, email, name, role, "emailVerified") VALUES ('u1', 'u1@example.test', 'U1', 'member', true);
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-1', 'Team 1', 'team-1', 'u1');
      INSERT INTO plans (id, slug, name) VALUES ('plan-1', 'pro', 'Pro');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "externalSubscriptionId")
        VALUES ('sub-1', 'team-1', 'plan-1', 'active', now(), now() + interval '30 days', 'sub_stripe_1');
      INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-2', 'Team 2', 'team-2', 'u1');
      INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "externalCustomerId")
        VALUES ('sub-2', 'team-2', 'plan-1', 'trialing', now(), now() + interval '30 days', 'cus_polar_1');
    `)

    // lib/db.ts opens its pools on import, from DATABASE_URL
    process.env.DATABASE_URL = url
    delete process.env.DATABASE_SERVICE_URL
    handleStripeWebhook = require('@nextsparkjs/core/lib/billing/stripe-webhook').handleStripeWebhook
    createPolarWebhookHandler = require('@nextsparkjs/core/routes/_internal/polar-webhook').createPolarWebhookHandler
    webhookEvents = require('@nextsparkjs/core/lib/billing/webhook-events')
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

  /** A Stripe one-time checkout: it writes no billing_events row and calls the project's extension. */
  const stripeCheckout = (id: string) => ({
    id,
    type: 'checkout.session.completed',
    data: { object: { id: `cs_${id}`, metadata: { teamId: 'team-1', userId: 'u1' }, amount_total: 500, currency: 'usd' } },
  })

  /** A Polar one-time order for team-1, which has a subscription, so the handler logs a billing_events row first. */
  const polarOrder = (id: string) => ({
    id,
    type: 'order.paid',
    data: { id: `ord_${id}`, amount: 500, currency: 'usd', metadata: { teamId: 'team-1', userId: 'u1' } },
  })

  test('Stripe: the same event delivered twice concurrently is processed once', async () => {
    const onOneTimePaymentCompleted = jest.fn(async () => { await sleep(200) })
    const event = stripeCheckout('evt_stripe_concurrent')

    const responses = await Promise.all([
      handleStripeWebhook(stripeRequest(event), { onOneTimePaymentCompleted }).then(responseOf),
      handleStripeWebhook(stripeRequest(event), { onOneTimePaymentCompleted }).then(responseOf),
    ])

    expect(onOneTimePaymentCompleted).toHaveBeenCalledTimes(1)
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect(await responseOf(await handleStripeWebhook(stripeRequest(event), { onOneTimePaymentCompleted })))
      .toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
    expect(onOneTimePaymentCompleted).toHaveBeenCalledTimes(1)
  })

  test('Polar: the same event delivered twice concurrently is processed once', async () => {
    const onOneTimePaymentCompleted = jest.fn(async () => { await sleep(200) })
    const handler = createPolarWebhookHandler(async () => ({ onOneTimePaymentCompleted }))
    const event = polarOrder('evt_polar_concurrent')

    const responses = await Promise.all([
      handler(polarRequest(event)).then(responseOf),
      handler(polarRequest(event)).then(responseOf),
    ])

    expect(onOneTimePaymentCompleted).toHaveBeenCalledTimes(1)
    expect(responses.map(r => r.status).sort()).toEqual([200, 409])
    expect(await responseOf(await handler(polarRequest(event))))
      .toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
  })

  test('Stripe: a handler that throws is processed again on retry, not reported as duplicate', async () => {
    const onOneTimePaymentCompleted = jest.fn()
      .mockRejectedValueOnce(new Error('credits service down'))
      .mockResolvedValueOnce(undefined)
    const event = stripeCheckout('evt_stripe_throws')

    expect((await handleStripeWebhook(stripeRequest(event), { onOneTimePaymentCompleted })).status).toBe(500)
    expect(await responseOf(await handleStripeWebhook(stripeRequest(event), { onOneTimePaymentCompleted })))
      .toEqual({ status: 200, body: { received: true } })
    expect(onOneTimePaymentCompleted).toHaveBeenCalledTimes(2)
  })

  test('Polar: a handler that throws after its billing_events row is processed again on retry', async () => {
    const onOneTimePaymentCompleted = jest.fn()
      .mockRejectedValueOnce(new Error('credits service down'))
      .mockResolvedValueOnce(undefined)
    const handler = createPolarWebhookHandler(async () => ({ onOneTimePaymentCompleted }))
    const event = polarOrder('evt_polar_throws')

    expect((await handler(polarRequest(event))).status).toBe(500)
    expect(await responseOf(await handler(polarRequest(event)))).toEqual({ status: 200, body: { received: true } })
    expect(onOneTimePaymentCompleted).toHaveBeenCalledTimes(2)
  })

  test('Stripe: an event that writes no billing_events row is deduplicated', async () => {
    const event = {
      id: 'evt_stripe_sub_updated',
      type: 'customer.subscription.updated',
      data: { object: { id: 'sub_stripe_1', status: 'past_due', cancel_at_period_end: false, items: { data: [] } } },
    }

    expect(await responseOf(await handleStripeWebhook(stripeRequest(event)))).toEqual({ status: 200, body: { received: true } })
    expect((await db.query(`SELECT status FROM subscriptions WHERE id = 'sub-1'`)).rows[0].status).toBe('past_due')
    // a later event moved it on; the redelivered one must not move it back
    await db.query(`UPDATE subscriptions SET status = 'active' WHERE id = 'sub-1'`)

    expect(await responseOf(await handleStripeWebhook(stripeRequest(event))))
      .toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
    expect((await db.query(`SELECT status FROM subscriptions WHERE id = 'sub-1'`)).rows[0].status).toBe('active')
    expect((await db.query(`SELECT count(*)::int AS n FROM billing_events WHERE metadata::text LIKE '%evt_stripe_sub_updated%'`)).rows[0].n).toBe(0)
  })

  test('Polar: an event that writes no billing_events row is deduplicated', async () => {
    const handler = createPolarWebhookHandler()
    // no subscription matches, so the handler updates nothing and logs no billing_events row
    const event = { id: 'evt_polar_sub_updated', type: 'subscription.updated', data: { id: 'sub_polar_unknown', status: 'active' } }

    expect(await responseOf(await handler(polarRequest(event)))).toEqual({ status: 200, body: { received: true } })
    expect(await responseOf(await handler(polarRequest(event))))
      .toEqual({ status: 200, body: { received: true, status: 'duplicate' } })
  })

  test('Polar: subscription.created, .updated and .canceled for a known subscription answer 200 (#282)', async () => {
    const handler = createPolarWebhookHandler()
    const subscription = async () =>
      (await db.query(`SELECT status, "externalSubscriptionId" AS "externalId" FROM subscriptions WHERE id = 'sub-2'`)).rows[0]

    const created = { id: 'evt_polar_sub_created', type: 'subscription.created', data: { id: 'sub_polar_1', customerId: 'cus_polar_1', status: 'active' } }
    expect(await responseOf(await handler(polarRequest(created)))).toEqual({ status: 200, body: { received: true } })
    expect(await subscription()).toEqual({ status: 'active', externalId: 'sub_polar_1' })

    const updated = { id: 'evt_polar_sub_updated_known', type: 'subscription.updated', data: { id: 'sub_polar_1', status: 'past_due' } }
    expect(await responseOf(await handler(polarRequest(updated)))).toEqual({ status: 200, body: { received: true } })
    expect((await subscription()).status).toBe('past_due')

    const canceled = { id: 'evt_polar_sub_canceled', type: 'subscription.canceled', data: { id: 'sub_polar_1' } }
    expect(await responseOf(await handler(polarRequest(canceled)))).toEqual({ status: 200, body: { received: true } })
    expect((await subscription()).status).toBe('canceled')
  })

  test('a claim older than the lease, left by a delivery that died, is taken over by the retry', async () => {
    await db.query(
      `INSERT INTO billing_webhook_events (gateway, "eventId", status, "claimedAt")
       VALUES ('stripe', 'evt_dead', 'processing', now() - make_interval(secs => $1 + 1))`,
      [webhookEvents.WEBHOOK_CLAIM_LEASE_SECONDS]
    )
    const handle = jest.fn(async () => {})

    expect(await webhookEvents.processWebhookEventOnce('stripe', 'evt_dead', 'x', handle)).toBe('processed')
    expect(handle).toHaveBeenCalledTimes(1)
    expect((await db.query(`SELECT status FROM billing_webhook_events WHERE "eventId" = 'evt_dead'`)).rows[0].status).toBe('processed')
  })

  test('a live claim makes another delivery wait (in_progress), and the same id on another gateway is its own event', async () => {
    await db.query(`INSERT INTO billing_webhook_events (gateway, "eventId") VALUES ('stripe', 'evt_live')`)
    const handle = jest.fn(async () => {})

    expect(await webhookEvents.processWebhookEventOnce('stripe', 'evt_live', 'x', handle)).toBe('in_progress')
    expect(handle).not.toHaveBeenCalled()
    expect(await webhookEvents.processWebhookEventOnce('polar', 'evt_live', 'x', handle)).toBe('processed')
    expect(handle).toHaveBeenCalledTimes(1)
  })
})
