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

  test('a handler that throws after writing a billing_events row keeps none of its writes, and the retry writes one', async () => {
    const onOneTimePaymentCompleted = jest.fn()
      .mockRejectedValueOnce(new Error('credits service down'))
      .mockResolvedValueOnce(undefined)
    const handler = createPolarWebhookHandler(async () => ({ onOneTimePaymentCompleted }))
    const event = polarOrder('evt_polar_rollback')
    const auditRows = async () =>
      (await db.query(`SELECT count(*)::int AS n FROM billing_events WHERE metadata->>'polarEventId' = $1`, [event.id])).rows[0].n
    const claims = async () =>
      (await db.query(`SELECT status FROM billing_webhook_events WHERE "eventId" = $1`, [event.id])).rows

    expect((await handler(polarRequest(event))).status).toBe(500)
    expect(await auditRows()).toBe(0)
    expect(await claims()).toEqual([])

    expect(await responseOf(await handler(polarRequest(event)))).toEqual({ status: 200, body: { received: true } })
    expect(await auditRows()).toBe(1)
    expect(await claims()).toEqual([{ status: 'processed' }])
  })

  test('when the final update matches no claim, nothing the handler wrote is kept', async () => {
    const { query } = require('@nextsparkjs/core/lib/db')
    const audit = () => db.query(`SELECT count(*)::int AS n FROM billing_events WHERE metadata->>'evt' = 'evt_lost_claim'`)

    const outcome = await webhookEvents.processWebhookEventOnce('stripe', 'evt_lost_claim', 'x', async () => {
      await query(
        `INSERT INTO billing_events ("subscriptionId", type, status, amount, currency, metadata)
         VALUES ('sub-1', 'payment', 'succeeded', 1, 'usd', '{"evt": "evt_lost_claim"}')`
      )
      // another delivery took the claim over meanwhile: the token no longer matches
      await db.query(`UPDATE billing_webhook_events SET "claimedAt" = clock_timestamp() WHERE "eventId" = 'evt_lost_claim'`)
    })

    expect(outcome).toBe('in_progress')
    expect((await audit()).rows[0].n).toBe(0)
    expect((await db.query(`SELECT status FROM billing_webhook_events WHERE "eventId" = 'evt_lost_claim'`)).rows)
      .toEqual([{ status: 'processing' }])
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

  test('a stale delivery that completes or fails after a takeover does not touch the newer claim', async () => {
    const backdate = (eventId: string) => db.query(
      `UPDATE billing_webhook_events SET "claimedAt" = "claimedAt" - make_interval(secs => $1 + 1) WHERE "eventId" = $2`,
      [webhookEvents.WEBHOOK_CLAIM_LEASE_SECONDS, eventId]
    )
    const row = async (eventId: string) =>
      (await db.query(`SELECT status, "claimedAt"::text AS "claimedAt" FROM billing_webhook_events WHERE "eventId" = $1`, [eventId])).rows

    for (const [eventId, ending] of [['evt_stale_completes', 'completes'], ['evt_stale_fails', 'fails']] as const) {
      let finishStale!: () => void
      const staleHandle = new Promise<void>(resolve => { finishStale = resolve })
      const stale = webhookEvents.processWebhookEventOnce('stripe', eventId, 'x', async () => {
        await staleHandle
        if (ending === 'fails') throw new Error('stale delivery failed')
      })
      // the stale delivery holds its claim; its lease runs out
      while ((await row(eventId)).length === 0) await sleep(5)
      await backdate(eventId)
      const staleClaim = (await row(eventId))[0]

      let finishNewer!: () => void
      const newerHandle = new Promise<void>(resolve => { finishNewer = resolve })
      const newer = webhookEvents.processWebhookEventOnce('stripe', eventId, 'x', () => newerHandle)
      // the newer delivery has taken the claim over
      while ((await row(eventId))[0].claimedAt === staleClaim.claimedAt) await sleep(5)
      const newerClaim = (await row(eventId))[0]

      finishStale()
      if (ending === 'fails') await expect(stale).rejects.toThrow('stale delivery failed')
      // its writes are rolled back, and the gateway is told to retry: the newer delivery may still fail
      else expect(await stale).toBe('in_progress')
      expect(await row(eventId)).toEqual([newerClaim])
      expect(newerClaim.status).toBe('processing')

      finishNewer()
      expect(await newer).toBe('processed')
      expect((await row(eventId))[0].status).toBe('processed')
    }
  })

  test('two concurrent takeovers of one stale lease run handle once', async () => {
    await db.query(
      `INSERT INTO billing_webhook_events (gateway, "eventId", status, "claimedAt")
       VALUES ('stripe', 'evt_stale_race', 'processing', now() - make_interval(secs => $1 + 1))`,
      [webhookEvents.WEBHOOK_CLAIM_LEASE_SECONDS]
    )
    const handle = jest.fn(async () => { await sleep(200) })

    const outcomes = await Promise.all([
      webhookEvents.processWebhookEventOnce('stripe', 'evt_stale_race', 'x', handle),
      webhookEvents.processWebhookEventOnce('stripe', 'evt_stale_race', 'x', handle),
    ])

    expect(handle).toHaveBeenCalledTimes(1)
    expect(outcomes.sort()).toEqual(['in_progress', 'processed'])
  })

  test('a delivery whose COMMIT was applied but not acknowledged does not delete the processed event', async () => {
    const { servicePool } = require('@nextsparkjs/core/lib/db')
    const realConnect = servicePool.connect.bind(servicePool)
    // the transaction's client: its COMMIT reaches the server, then the answer is lost
    const connectSpy = jest.spyOn(servicePool, 'connect').mockImplementation(((callback?: unknown) => {
      if (callback) return realConnect(callback)
      connectSpy.mockRestore()
      return realConnect().then((client: { query: (text: string, params?: unknown[]) => Promise<unknown> }) => {
        const realClientQuery = client.query.bind(client)
        client.query = async (text: string, params?: unknown[]) => {
          const result = await realClientQuery(text, params)
          if (text !== 'COMMIT') return result
          client.query = realClientQuery
          throw new Error('Connection terminated unexpectedly')
        }
        return client
      })
    }) as never)

    try {
      await expect(webhookEvents.processWebhookEventOnce('stripe', 'evt_commit_ack_lost', 'x', async () => {}))
        .rejects.toThrow('Connection terminated unexpectedly')
    } finally {
      connectSpy.mockRestore()
    }
    expect((await db.query(`SELECT status FROM billing_webhook_events WHERE "eventId" = 'evt_commit_ack_lost'`)).rows)
      .toEqual([{ status: 'processed' }])
  })

  describe('cleanup of processed events', () => {
    const insertEvent = (eventId: string, status: string, ageDays: number) => db.query(
      `INSERT INTO billing_webhook_events (gateway, "eventId", status, "claimedAt", "processedAt")
       VALUES ('cleanup', $1, $2, now() - make_interval(days => $3), CASE WHEN $2 = 'processed' THEN now() - make_interval(days => $3) END)`,
      [eventId, status, ageDays]
    )
    const cleanupEvents = async () =>
      (await db.query(`SELECT "eventId" FROM billing_webhook_events WHERE gateway = 'cleanup' ORDER BY "eventId"`)).rows.map(r => r.eventId)
    /** Past the cleanup interval of the last run: Date.now() one more hour ahead while `fn` runs. */
    let hoursAhead = 0
    async function anHourLater<T>(fn: () => Promise<T>): Promise<T> {
      const now = Date.now()
      const spy = jest.spyOn(Date, 'now').mockReturnValue(now + ++hoursAhead * 3600_000)
      try { return await fn() } finally { spy.mockRestore() }
    }
    const registry = () => require('@nextsparkjs/registries/billing-registry').BILLING_REGISTRY

    beforeEach(() => db.query(`DELETE FROM billing_webhook_events WHERE gateway = 'cleanup'`))
    afterEach(() => { delete registry().webhookEventRetentionDays })

    test('removes processed events older than the retention, and keeps recent ones and every processing one', async () => {
      await insertEvent('old-processed', 'processed', 31)
      await insertEvent('recent-processed', 'processed', 29)
      await insertEvent('old-processing', 'processing', 31)

      expect(await webhookEvents.cleanUpProcessedWebhookEvents()).toBe(1)
      expect(await cleanupEvents()).toEqual(['old-processing', 'recent-processed'])
    })

    test('takes its retention from the billing config', async () => {
      await insertEvent('six-days', 'processed', 6)
      await insertEvent('four-days', 'processed', 4)
      registry().webhookEventRetentionDays = 5

      expect(await webhookEvents.cleanUpProcessedWebhookEvents()).toBe(1)
      expect(await cleanupEvents()).toEqual(['four-days'])
    })

    test('raises a retention below the floor to 3 days, and warns once', async () => {
      await insertEvent('two-days', 'processed', 2)
      await insertEvent('four-days', 'processed', 4)
      registry().webhookEventRetentionDays = 1
      const warnings = console.warn as jest.Mock
      warnings.mockClear()

      expect(await webhookEvents.cleanUpProcessedWebhookEvents()).toBe(1)
      expect(await webhookEvents.cleanUpProcessedWebhookEvents()).toBe(0)
      expect(await cleanupEvents()).toEqual(['two-days'])
      expect(warnings.mock.calls).toEqual([[expect.stringMatching(/webhookEventRetentionDays is 1.*3 days/)]])
    })

    test('a retention that is not a finite number uses the default', async () => {
      for (const configured of [Infinity, NaN]) {
        await insertEvent('old-processed', 'processed', 31)
        await insertEvent('recent-processed', 'processed', 29)
        registry().webhookEventRetentionDays = configured

        expect(await webhookEvents.cleanUpProcessedWebhookEvents()).toBe(1)
        expect(await cleanupEvents()).toEqual(['recent-processed'])
        await db.query(`DELETE FROM billing_webhook_events WHERE gateway = 'cleanup'`)
      }
    })

    test('runs after a processed event, at most once per interval', async () => {
      await insertEvent('old-processed', 'processed', 31)

      expect(await anHourLater(() => webhookEvents.processWebhookEventOnce('stripe', 'evt_cleanup_1', 'x', async () => {}))).toBe('processed')
      for (let i = 0; i < 100 && (await cleanupEvents()).length > 0; i++) await sleep(10)
      expect(await cleanupEvents()).toEqual([])

      // within the interval of the last run: the next processed event does not clean up
      await insertEvent('old-processed-2', 'processed', 31)
      expect(await webhookEvents.processWebhookEventOnce('stripe', 'evt_cleanup_2', 'x', async () => {})).toBe('processed')
      await sleep(50)
      expect(await cleanupEvents()).toEqual(['old-processed-2'])
    })

    test('a cleanup that fails does not change the outcome of the webhook', async () => {
      const { servicePool } = require('@nextsparkjs/core/lib/db')
      const realQuery = servicePool.query.bind(servicePool)
      const querySpy = jest.spyOn(servicePool, 'query').mockImplementation(((text: string, params?: unknown[]) =>
        /^\s*DELETE FROM "billing_webhook_events" WHERE ctid/.test(text) ? Promise.reject(new Error('cleanup failed')) : realQuery(text, params)) as never)
      const errors = console.error as jest.Mock
      errors.mockClear()
      try {
        const event = stripeCheckout('evt_cleanup_fails')
        expect(await anHourLater(async () => responseOf(await handleStripeWebhook(stripeRequest(event)))))
          .toEqual({ status: 200, body: { received: true } })
        for (let i = 0; i < 100 && errors.mock.calls.length === 0; i++) await sleep(10)
        expect(errors.mock.calls).toEqual([[expect.stringContaining('cleanup'), expect.objectContaining({ message: 'cleanup failed' })]])
        expect((await db.query(`SELECT status FROM billing_webhook_events WHERE "eventId" = $1`, [event.id])).rows).toEqual([{ status: 'processed' }])
      } finally {
        querySpy.mockRestore()
      }
    })
  })

  test('a live claim makes another delivery wait (in_progress), and the same id on another gateway is its own event', async () => {
    await db.query(`INSERT INTO billing_webhook_events (gateway, "eventId") VALUES ('stripe', 'evt_live')`)
    const handle = jest.fn(async () => {})

    expect(await webhookEvents.processWebhookEventOnce('stripe', 'evt_live', 'x', handle)).toBe('in_progress')
    expect(handle).not.toHaveBeenCalled()
    expect(await webhookEvents.processWebhookEventOnce('polar', 'evt_live', 'x', handle)).toBe('processed')
    expect(handle).toHaveBeenCalledTimes(1)
  })

  describe('a team whose subscription ended checks out again (#300)', () => {
    const rowOf = async (id: string) => (await db.query(
      `SELECT status, "externalSubscriptionId", "externalCustomerId", "paymentProvider", "cancelAtPeriodEnd", "canceledAt" IS NOT NULL AS "hasCanceledAt"
       FROM subscriptions WHERE id = $1`, [id])).rows[0]

    beforeAll(async () => {
      await db.query(`
        INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-ended-stripe', 'Ended Stripe', 'team-ended-stripe', 'u1'), ('team-ended-polar', 'Ended Polar', 'team-ended-polar', 'u1'), ('team-no-row', 'No Row', 'team-no-row', 'u1');
        -- an expired subscription and, older, a canceled one: the latest row is reused
        INSERT INTO subscriptions (id, "teamId", "planId", status, "currentPeriodStart", "currentPeriodEnd", "createdAt", "paymentProvider", "externalSubscriptionId", "canceledAt") VALUES
          ('sub-ended-stripe-old', 'team-ended-stripe', 'plan-1', 'canceled', now() - interval '90 days', now() - interval '60 days', now() - interval '90 days', 'stripe', 'sub_stripe_older', now() - interval '60 days'),
          ('sub-ended-stripe', 'team-ended-stripe', 'plan-1', 'expired', now() - interval '40 days', now() - interval '10 days', now() - interval '40 days', 'stripe', 'sub_stripe_ended', now() - interval '10 days'),
          ('sub-ended-polar', 'team-ended-polar', 'plan-1', 'canceled', now() - interval '40 days', now() - interval '10 days', now() - interval '40 days', 'polar', 'sub_polar_ended', now() - interval '10 days');
      `)
    })

    test('Stripe: checkout.session.completed activates the latest row on the new subscription', async () => {
      const event = {
        id: 'evt_stripe_resubscribe',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_resubscribe', subscription: 'sub_stripe_new', customer: 'cus_stripe_new', amount_total: 2900, currency: 'usd', metadata: { teamId: 'team-ended-stripe', planSlug: 'pro', billingPeriod: 'monthly' } } },
      }
      expect(await responseOf(await handleStripeWebhook(stripeRequest(event)))).toEqual({ status: 200, body: { received: true } })
      expect(await rowOf('sub-ended-stripe')).toEqual({
        status: 'active', externalSubscriptionId: 'sub_stripe_new', externalCustomerId: 'cus_stripe_new', paymentProvider: 'stripe', cancelAtPeriodEnd: false, hasCanceledAt: false,
      })
      expect((await rowOf('sub-ended-stripe-old')).status).toBe('canceled')
      expect((await db.query(`SELECT type, status, amount FROM billing_events WHERE "subscriptionId" = 'sub-ended-stripe'`)).rows).toEqual([{ type: 'payment', status: 'succeeded', amount: 2900 }])
    })

    test('Polar: checkout.updated activates the latest row on the new subscription', async () => {
      const event = {
        id: 'evt_polar_resubscribe',
        type: 'checkout.updated',
        data: { status: 'succeeded', subscriptionId: 'sub_polar_new', customerId: 'cus_polar_new', amount: 2900, currency: 'usd', metadata: { teamId: 'team-ended-polar', planSlug: 'pro', billingPeriod: 'monthly' } },
      }
      const handler = createPolarWebhookHandler()
      expect(await responseOf(await handler(polarRequest(event)))).toEqual({ status: 200, body: { received: true } })
      expect(await rowOf('sub-ended-polar')).toEqual({
        status: 'active', externalSubscriptionId: 'sub_polar_new', externalCustomerId: 'cus_polar_new', paymentProvider: 'polar', cancelAtPeriodEnd: false, hasCanceledAt: false,
      })
    })

    test('a team with no subscription row logs an error with the event id and writes nothing', async () => {
      const errors = console.error as jest.Mock
      errors.mockClear()
      const before = (await db.query(`SELECT (SELECT count(*) FROM subscriptions)::int + (SELECT count(*) FROM billing_events)::int AS n`)).rows[0].n
      const event = {
        id: 'evt_stripe_no_row',
        type: 'checkout.session.completed',
        data: { object: { id: 'cs_no_row', subscription: 'sub_x', customer: 'cus_x', amount_total: 2900, currency: 'usd', metadata: { teamId: 'team-no-row', planSlug: 'pro' } } },
      }
      expect((await handleStripeWebhook(stripeRequest(event))).status).toBe(200)
      expect(errors).toHaveBeenCalledWith(expect.stringContaining('Event evt_stripe_no_row: team team-no-row has no subscription row'))
      expect((await db.query(`SELECT (SELECT count(*) FROM subscriptions)::int + (SELECT count(*) FROM billing_events)::int AS n`)).rows[0].n).toBe(before)
    })
  })
})
