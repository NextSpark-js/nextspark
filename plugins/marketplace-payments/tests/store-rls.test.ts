/**
 * The migration's policies on the documented cutover, and the plugin's SQL against a real PostgreSQL, with core's own
 * webhook deduplication.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac, randomBytes } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { HAS_POSTGRES, cutoverDatabase, asUser } from '../../../packages/core/tests/node/_pg-cutover'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const MIGRATION = fs.readFileSync(path.join(HERE, '../migrations/001_marketplace_payments.sql'), 'utf8')
const KEY1 = randomBytes(32).toString('base64')
const KEY2 = randomBytes(32).toString('base64')
const WH = 'whsec_pg'

test('marketplace tables: RLS, encryption at rest, idempotency, OAuth state and checkout', { skip: !HAS_POSTGRES && 'initdb/pg_ctl not on PATH', timeout: 240000 }, async t => {
  const { owner, app, ownerUrl } = await cutoverDatabase(t)
  await owner.query(MIGRATION)
  await owner.query(MIGRATION) // idempotent

  process.env.DATABASE_URL = ownerUrl
  process.env.MARKETPLACE_TOKEN_KEYS = `k1:${KEY1}`
  process.env.MARKETPLACE_STRIPE_WEBHOOK_SECRETS = WH
  process.env.MARKETPLACE_COMMISSION_BPS = '1500'

  const store = await import('../lib/store')
  const { handleStripeWebhook } = await import('../lib/webhooks/handler')
  const { appLink, mercadoPagoNotificationUrl, webhookDedupe } = await import('../lib/runtime')
  const { createMarketplaceCheckout, SellerAccountChangedError, SellerNotReadyError, refundMarketplacePayment } = await import('../lib/checkout')
  const { completeMercadoPagoOAuth, startSellerOnboarding } = await import('../lib/onboarding')
  const { rotateSellerTokenKeys } = await import('../lib/token-crypto')
  const { refreshExpiringMercadoPagoTokens } = await import('../lib/mercadopago/refresh')
  const { ProviderApiError } = await import('../lib/provider-error')
  const { runRefreshTokensAction, runRotateTokenKeysAction } = await import('../lib/scheduled-action-handlers')
  const { parseTokenKeyring } = await import('../lib/token-crypto')
  const db = await import('@nextsparkjs/core/lib/db')
  t.after(() => db.servicePool.end())

  await owner.query(`
    INSERT INTO users (id, email, name, role, "emailVerified") VALUES
      ('owner-a', 'oa@example.test', 'A', 'member', true),
      ('owner-b', 'ob@example.test', 'B', 'member', true),
      ('member-a', 'ma@example.test', 'M', 'member', true),
      ('super', 'su@example.test', 'S', 'superadmin', true);
    INSERT INTO teams (id, name, slug, "ownerId") VALUES ('team-a', 'Team A', 'team-a', 'owner-a'), ('team-b', 'Team B', 'team-b', 'owner-b');
    INSERT INTO team_members ("teamId", "userId", role) VALUES ('team-a', 'owner-a', 'owner'), ('team-a', 'member-a', 'member'), ('team-b', 'owner-b', 'owner');
  `)

  const tokens = (seller: string) => ({ accessToken: `plain-access-${seller}`, refreshToken: `plain-refresh-${seller}`, providerAccountId: seller, expiresAt: new Date(Date.now() + 86400000) })
  const accountA = await store.saveMercadoPagoSeller('team-a', tokens('mp-a'))
  const accountB = await store.saveMercadoPagoSeller('team-b', tokens('mp-b'))
  const stripeA = await store.upsertAccount({ teamId: 'team-a', provider: 'stripe', providerAccountId: 'acct_a', status: 'active', chargesEnabled: true, payoutsEnabled: true })
  const payA = await store.createPendingPayment({ teamId: 'team-a', accountId: stripeA, provider: 'stripe', providerAccountId: 'acct_a', amountCents: 10000, commissionCents: 1500, currency: 'usd', description: 'x' })
  const payB = await store.createPendingPayment({ teamId: 'team-b', accountId: accountB, provider: 'mercadopago', providerAccountId: 'mp-b', amountCents: 2000, commissionCents: 200, currency: 'ars', description: 'y' })

  const as = asUser(app)
  const count = async (user: string, table: string) => (await as(user, `SELECT count(*)::int AS n FROM public."${table}"`)).rows[0].n

  await t.test('an owner sees only its team; a plain member sees none; a superadmin sees all', async () => {
    assert.equal(await count('owner-a', 'marketplace_accounts'), 2)
    assert.equal(await count('owner-b', 'marketplace_accounts'), 1)
    assert.equal(await count('member-a', 'marketplace_accounts'), 0)
    assert.equal(await count('super', 'marketplace_accounts'), 3)
    assert.equal(await count('owner-a', 'marketplace_payments'), 1)
    assert.equal(await count('owner-b', 'marketplace_payments'), 1)
    assert.equal(await count('member-a', 'marketplace_payments'), 0)
    assert.equal(await count('super', 'marketplace_payments'), 2)
    assert.equal((await as('owner-a', `SELECT id FROM public."marketplace_payments" WHERE id = $1`, [payB])).rowCount, 0)
    assert.equal((await as('owner-b', `SELECT id FROM public."marketplace_payments" WHERE id = $1`, [payB])).rowCount, 1)
  })

  await t.test('the read path of the store goes through RLS', async () => {
    assert.deepEqual((await store.listTeamPayments('team-a', 'owner-a', { limit: 10, offset: 0 })).payments.map(p => p.id), [payA])
    const seen = await store.listTeamAccounts('team-a', 'owner-a')
    assert.equal(seen.length, 2)
    for (const account of seen) assert.equal('accessTokenEnc' in account, false)
  })

  await t.test('nobody writes through RLS', async () => {
    for (const user of ['owner-a', 'super']) {
      await assert.rejects(as(user, `INSERT INTO public."marketplace_payments" ("teamId", "accountId", provider, "providerAccountId", "amountCents", "commissionCents", currency, description) VALUES ('team-a', '${stripeA}', 'stripe', 'acct_a', 1, 0, 'USD', 'z')`), /row-level security/, user)
      assert.equal((await as(user, `UPDATE public."marketplace_payments" SET status = 'succeeded' WHERE id = '${payA}'`)).rowCount, 0, user)
      assert.equal((await as(user, `DELETE FROM public."marketplace_payments" WHERE id = '${payA}'`)).rowCount, 0, user)
      assert.equal((await as(user, `UPDATE public."marketplace_accounts" SET status = 'active'`)).rowCount, 0, user)
    }
  })

  await t.test('tokens and OAuth states are out of reach of the app role, a superadmin included', async () => {
    for (const user of ['owner-a', 'super']) {
      await assert.rejects(as(user, `SELECT * FROM public."marketplace_seller_credentials"`), /permission denied/, user)
      await assert.rejects(as(user, `SELECT * FROM public."marketplace_oauth_states"`), /permission denied/, user)
    }
  })

  await t.test('tokens are encrypted at rest and read back', async () => {
    const { rows } = await owner.query(`SELECT * FROM public."marketplace_seller_credentials" WHERE "accountId" = $1`, [accountA])
    assert.match(rows[0].accessTokenEnc, /^v1\.k1\./)
    assert.ok(!JSON.stringify(rows[0]).includes('plain-'))
    assert.equal(await store.getSellerAccessToken(accountA), 'plain-access-mp-a')
  })

  await t.test('a ciphertext copied to another seller does not decrypt', async () => {
    await owner.query(`CREATE TEMP TABLE keep AS SELECT * FROM public."marketplace_seller_credentials" WHERE "accountId" = '${accountB}'`)
    await owner.query(`UPDATE public."marketplace_seller_credentials" SET "accessTokenEnc" = (SELECT "accessTokenEnc" FROM public."marketplace_seller_credentials" WHERE "accountId" = '${accountA}') WHERE "accountId" = '${accountB}'`)
    await assert.rejects(store.getSellerAccessToken(accountB), /could not be decrypted/)
    await owner.query(`UPDATE public."marketplace_seller_credentials" c SET "accessTokenEnc" = k."accessTokenEnc" FROM keep k WHERE c."accountId" = k."accountId"`)
  })

  await t.test('rotating the key re-encrypts every row and the old key can go', async () => {
    process.env.MARKETPLACE_TOKEN_KEYS = `k2:${KEY2},k1:${KEY1}`
    assert.deepEqual(await rotateSellerTokenKeys(store.keyRotationStore, parseTokenKeyring(process.env.MARKETPLACE_TOKEN_KEYS)), { rotated: 2, failed: 0 })
    process.env.MARKETPLACE_TOKEN_KEYS = `k2:${KEY2}`
    assert.equal(await store.getSellerAccessToken(accountA), 'plain-access-mp-a')
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM public."marketplace_seller_credentials" WHERE "accessTokenEnc" LIKE 'v1.k2.%' AND "refreshTokenEnc" LIKE 'v1.k2.%'`)).rows[0].n, 2)
    // a key id is compared whole: _ is an ordinary character in one
    assert.equal((await store.keyRotationStore.listCredentialsNotOnKey('k_', null, 10)).length, 2)
    assert.equal((await store.keyRotationStore.listCredentialsNotOnKey('k2', null, 10)).length, 0)
  })

  const statusOf = async (id: string) => (await owner.query(`SELECT status FROM public."marketplace_payments" WHERE id = $1`, [id])).rows[0].status

  await t.test('a repeated or concurrent Stripe event is applied once, through core deduplication', async () => {
    const event = (id: string) => JSON.stringify({ id, livemode: false, type: 'checkout.session.completed', data: { object: { payment_status: 'paid', amount_total: 10000, currency: 'usd', payment_intent: 'pi_a', metadata: { marketplacePaymentId: payA } } } })
    const request = (id: string) => {
      const body = event(id)
      const ts = Math.floor(Date.now() / 1000)
      return new Request('https://app.test/hook', { method: 'POST', body, headers: { 'stripe-signature': `t=${ts},v1=${createHmac('sha256', WH).update(`${ts}.${body}`).digest('hex')}` } })
    }
    const deps = { secrets: [WH], livemode: false, store: store.webhookStore, dedupe: webhookDedupe }
    let applied = 0
    const counted = { ...deps, store: { ...store.webhookStore, transitionPayment: async (...args: Parameters<typeof store.webhookStore.transitionPayment>) => { applied++; return store.webhookStore.transitionPayment(...args) } } }

    const concurrent = await Promise.all([handleStripeWebhook(request('evt_a'), counted), handleStripeWebhook(request('evt_a'), counted), handleStripeWebhook(request('evt_a'), counted)])
    assert.equal(applied, 1)
    assert.ok(concurrent.every(r => r.status === 200 || r.status === 409), concurrent.map(r => r.status).join())
    assert.equal(await statusOf(payA), 'succeeded')

    const again = await handleStripeWebhook(request('evt_a'), counted)
    assert.deepEqual(await again.json(), { received: true, status: 'duplicate' })
    assert.equal(applied, 1)
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM public."billing_webhook_events" WHERE gateway = 'marketplace:stripe' AND status = 'processed'`)).rows[0].n, 1)
  })

  await t.test('a handler that fails releases the event so the retry processes it', async () => {
    const body = JSON.stringify({ id: 'evt_fail', livemode: false, type: 'charge.dispute.created', data: { object: { payment_intent: 'pi_a' } } })
    const sign = () => {
      const ts = Math.floor(Date.now() / 1000)
      return new Request('https://app.test/hook', { method: 'POST', body, headers: { 'stripe-signature': `t=${ts},v1=${createHmac('sha256', WH).update(`${ts}.${body}`).digest('hex')}` } })
    }
    t.mock.method(console, 'error', () => {})
    const broken = { secrets: [WH], livemode: false, store: { ...store.webhookStore, transitionPayment: async () => { throw new Error('down') } }, dedupe: webhookDedupe }
    assert.equal((await handleStripeWebhook(sign(), broken)).status, 500)
    assert.equal((await handleStripeWebhook(sign(), { secrets: [WH], livemode: false, store: store.webhookStore, dedupe: webhookDedupe })).status, 200)
    assert.equal(await statusOf(payA), 'disputed')
  })

  await t.test('the status guard is enforced by the UPDATE, and the refunded amount never goes down', async () => {
    await store.webhookStore.transitionPayment(payA, 'refunded', { refundedCents: 10000 })
    await store.webhookStore.transitionPayment(payA, 'succeeded')
    assert.equal(await statusOf(payA), 'refunded')
    await store.webhookStore.transitionPayment(payB, 'partially_refunded', { refundedCents: 500 })
    await store.webhookStore.transitionPayment(payB, 'partially_refunded', { refundedCents: 100 })
    assert.equal((await owner.query(`SELECT "refundedCents"::int AS r FROM public."marketplace_payments" WHERE id = $1`, [payB])).rows[0].r, 500)

    await store.webhookStore.transitionPayment(payB, 'disputed')
    await store.webhookStore.transitionPayment(payB, 'succeeded')
    assert.equal(await statusOf(payB), 'disputed', 'only resolveDispute ends a dispute')
    await store.webhookStore.resolveDispute(payB)
    assert.equal(await statusOf(payB), 'partially_refunded')
    await store.webhookStore.resolveDispute(payB, 2000)
    assert.equal(await statusOf(payB), 'partially_refunded', 'it acts only on a disputed payment')
    await store.webhookStore.transitionPayment(payB, 'disputed')
    await store.webhookStore.resolveDispute(payB, 2000)
    assert.equal(await statusOf(payB), 'refunded')
  })

  await t.test('an OAuth state works once, for its user and team, and not after it expires', async () => {
    const exchange = async () => tokens('mp-a2')
    const can = async () => true
    const state = await store.createOAuthState('owner-a', 'team-a')
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM public."marketplace_oauth_states" WHERE "stateHash" = $1`, [state])).rows[0].n, 0, 'the raw state is not stored')
    assert.equal(await completeMercadoPagoOAuth({ state, code: 'c', userId: 'owner-b', canManageTeam: can }, exchange), 'invalid_state', 'another user')
    assert.equal(await completeMercadoPagoOAuth({ state: 'forged', code: 'c', userId: 'owner-a', canManageTeam: can }, exchange), 'invalid_state', 'forged')
    assert.equal(await completeMercadoPagoOAuth({ state, code: 'c', userId: 'owner-a', canManageTeam: can }, exchange), 'connected')
    assert.equal(await completeMercadoPagoOAuth({ state, code: 'c', userId: 'owner-a', canManageTeam: can }, exchange), 'invalid_state', 'replay')
    assert.equal((await store.findAccount('team-a', 'mercadopago'))?.providerAccountId, 'mp-a2')

    const late = await store.createOAuthState('owner-a', 'team-a')
    await owner.query(`UPDATE public."marketplace_oauth_states" SET "expiresAt" = now() - interval '1 second'`)
    assert.equal(await completeMercadoPagoOAuth({ state: late, code: 'c', userId: 'owner-a', canManageTeam: can }, exchange), 'invalid_state', 'expired')

    const lostRole = await store.createOAuthState('owner-a', 'team-a')
    let exchanged = false
    assert.equal(await completeMercadoPagoOAuth({ state: lostRole, code: 'c', userId: 'owner-a', canManageTeam: async () => false }, async () => { exchanged = true; return tokens('z') }), 'forbidden')
    assert.equal(exchanged, false)
  })

  await t.test('a provider account already on another team is refused', async () => {
    await assert.rejects(store.saveMercadoPagoSeller('team-b', tokens('mp-a2')), store.SellerAlreadyConnectedError)
  })

  await t.test('a seller that fails does not fail the scheduled actions, and keeps its credential', async ctx => {
    ctx.mock.method(console, 'error', () => {})
    process.env.MARKETPLACE_MERCADOPAGO_CLIENT_ID = 'cid'
    process.env.MARKETPLACE_MERCADOPAGO_CLIENT_SECRET = 'csecret'
    const stored = async () => (await owner.query(`SELECT "accessTokenEnc" AS a, "refreshTokenEnc" AS r FROM public."marketplace_seller_credentials" WHERE "accountId" = $1`, [accountB])).rows[0]
    const before = await stored()
    try {
      await owner.query(`UPDATE public."marketplace_seller_credentials" SET "expiresAt" = now() + interval '1 day' WHERE "accountId" = $1`, [accountB])
      ctx.mock.method(globalThis, 'fetch', async (url: string) =>
        String(url).endsWith('/oauth/token') ? new Response(JSON.stringify({ error: 'invalid_grant' }), { status: 400 }) : new Response(JSON.stringify({ country_id: 'AR' }), { status: 200 })
      )
      await runRefreshTokensAction()
      assert.deepEqual(await stored(), before)
      assert.equal((await store.findAccount('team-b', 'mercadopago'))?.status, 'active')

      await owner.query(`UPDATE public."marketplace_seller_credentials" SET "accessTokenEnc" = 'v1.gone.x.x.x' WHERE "accountId" = $1`, [accountB])
      await runRotateTokenKeysAction()
    } finally {
      await owner.query(`UPDATE public."marketplace_seller_credentials" SET "accessTokenEnc" = $2 WHERE "accountId" = $1`, [accountB, before.a])
      delete process.env.MARKETPLACE_MERCADOPAGO_CLIENT_ID
      delete process.env.MARKETPLACE_MERCADOPAGO_CLIENT_SECRET
    }
  })

  await t.test('the token refresh saves the new pair encrypted, and a revoked grant disconnects the seller', async () => {
    await owner.query(`UPDATE public."marketplace_seller_credentials" SET "expiresAt" = now() + interval '1 day'`)
    const renewed = { accessToken: 'plain-new', refreshToken: 'plain-new-r', providerAccountId: 'x', expiresAt: new Date(Date.now() + 180 * 86400000) }
    const summary = await refreshExpiringMercadoPagoTokens(store.tokenRefreshStore, {
      refreshAccessToken: async token => {
        if (token.includes('mp-b')) throw new ProviderApiError('mercadopago', 400, 'invalid_grant')
        return renewed
      },
      getAccountStatus: async seller => {
        assert.equal(seller.accessToken, 'plain-access-mp-b')
        assert.equal(seller.providerAccountId, 'mp-b')
        return { status: 'disconnected', chargesEnabled: false, payoutsEnabled: false }
      },
    })
    assert.deepEqual(summary, { refreshed: 1, revoked: 1, failed: 0 })
    assert.equal(await store.getSellerAccessToken(accountA), 'plain-new')
    const { rows } = await owner.query(`SELECT "accessTokenEnc" FROM public."marketplace_seller_credentials" WHERE "accountId" = $1`, [accountA])
    assert.ok(!rows[0].accessTokenEnc.includes('plain'))
    assert.equal(await store.getSellerAccessToken(accountB), null)
    assert.equal((await store.findAccount('team-b', 'mercadopago'))?.status, 'disconnected')
  })

  await t.test('a checkout computes the commission on the server and refuses a seller that is not ready', async () => {
    const seen: { amountCents: number; commissionCents: number; paymentId: string }[] = []
    const gateway = {
      provider: 'stripe' as const,
      startOnboarding: async () => ({ redirectUrl: '' }),
      getAccountStatus: async () => ({ status: 'active' as const, chargesEnabled: true, payoutsEnabled: true }),
      createSplitCheckout: async (params: { amountCents: number; commissionCents: number; paymentId: string }) => { seen.push(params); return { checkoutUrl: 'https://pay.test/1', providerCheckoutId: 'cs_x' } },
      refund: async () => ({ providerRefundId: 're_1' }),
    }
    const params = { sellerTeamId: 'team-a', provider: 'stripe' as const, amountCents: 3333, currency: 'usd', description: 'Order', successUrl: 'https://app.test/ok', cancelUrl: 'https://app.test/no' }
    const { paymentId, checkoutUrl } = await createMarketplaceCheckout(params, gateway)
    assert.equal(checkoutUrl, 'https://pay.test/1')
    assert.equal(seen[0].commissionCents, 500) // 15% of 33.33 is 4.9995: rounds to 500
    const { rows } = await owner.query(`SELECT "amountCents"::int AS a, "commissionCents"::int AS c, currency, "providerCheckoutId" AS k FROM public."marketplace_payments" WHERE id = $1`, [paymentId])
    assert.deepEqual(rows[0], { a: 3333, c: 500, currency: 'USD', k: 'cs_x' })

    await assert.rejects(createMarketplaceCheckout({ ...params, sellerTeamId: 'team-b', provider: 'mercadopago' }, gateway), SellerNotReadyError)
    await assert.rejects(createMarketplaceCheckout({ ...params, amountCents: 1.5 }, gateway), RangeError)

    const failing = { ...gateway, createSplitCheckout: async () => { throw new Error('stripe down') } }
    await assert.rejects(createMarketplaceCheckout(params, failing as never), /stripe down/)
    assert.equal((await owner.query(`SELECT count(*)::int AS n FROM public."marketplace_payments" WHERE "teamId" = 'team-a' AND status = 'failed'`)).rows[0].n, 1)

    await assert.rejects(refundMarketplacePayment({ paymentId, idempotencyKey: 'k' }, gateway), /cannot be refunded yet/)

    await owner.query(`UPDATE public."marketplace_payments" SET "providerPaymentId" = 'pi_refund' WHERE id = $1`, [paymentId])
    assert.deepEqual(await refundMarketplacePayment({ paymentId, idempotencyKey: 'k' }, gateway), { providerRefundId: 're_1' })
    await store.upsertAccount({ teamId: 'team-a', provider: 'stripe', providerAccountId: 'acct_new', status: 'active', chargesEnabled: true, payoutsEnabled: true })
    await assert.rejects(refundMarketplacePayment({ paymentId, idempotencyKey: 'k2' }, gateway), SellerAccountChangedError)
    assert.equal((await store.findPayment(paymentId))?.providerAccountId, 'acct_a')
  })

  await t.test('the links the plugin builds carry the base path', () => {
    process.env.NEXT_PUBLIC_APP_URL = 'https://app.test'
    process.env.__NEXT_ROUTER_BASEPATH = '/shop'
    try {
      assert.equal(appLink('/dashboard/settings/marketplace'), 'https://app.test/shop/dashboard/settings/marketplace')
      assert.equal(mercadoPagoNotificationUrl('p1'), 'https://app.test/shop/api/plugins/marketplace-payments/webhooks/mercadopago?ref=p1&source_news=webhooks')
    } finally {
      delete process.env.__NEXT_ROUTER_BASEPATH
      delete process.env.NEXT_PUBLIC_APP_URL
    }
  })

  await t.test('reconnecting a disconnected Stripe seller saves the state the provider reports', async () => {
    await store.disconnectTeamSeller('team-a', 'stripe')
    const gateway = {
      provider: 'stripe' as const,
      startOnboarding: async () => ({ redirectUrl: 'https://connect.test/x' }),
      getAccountStatus: async () => ({ status: 'active' as const, chargesEnabled: true, payoutsEnabled: true, country: 'US' }),
      createSplitCheckout: async () => ({ checkoutUrl: '', providerCheckoutId: '' }),
      refund: async () => ({ providerRefundId: '' }),
    }
    await startSellerOnboarding({ provider: 'stripe', teamId: 'team-a', userId: 'owner-a' }, gateway)
    const account = await store.findAccount('team-a', 'stripe')
    assert.deepEqual([account?.status, account?.chargesEnabled, account?.payoutsEnabled, account?.country], ['active', true, true, 'US'])
  })

  await t.test('disconnecting keeps the payments and removes the token', async () => {
    await store.disconnectTeamSeller('team-a', 'mercadopago')
    assert.equal(await store.getSellerAccessToken(accountA), null)
    assert.equal((await store.findAccount('team-a', 'mercadopago'))?.status, 'disconnected')
    await store.webhookStore.updateSellerStatus('mercadopago', 'mp-a2', { status: 'active', chargesEnabled: true, payoutsEnabled: true })
    assert.equal((await store.findAccount('team-a', 'mercadopago'))?.status, 'disconnected', 'a webhook does not bring it back')
  })
})

test('every webhook route goes through its verifying handler, with the webhook rate limit; no route takes an amount', () => {
  const api = path.join(HERE, '../api')
  const routes: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (entry.name === 'route.ts') routes.push(file)
    }
  }
  walk(api)
  const hooks = routes.filter(file => file.includes('/webhooks/'))
  assert.equal(hooks.length, 2)
  for (const file of hooks) {
    const source = fs.readFileSync(file, 'utf8')
    assert.match(source, /handle(Stripe|MercadoPago)Webhook\(request,/, file)
    assert.match(source, /'webhook'\s*\)/, file)
  }
  for (const file of routes) {
    assert.doesNotMatch(fs.readFileSync(file, 'utf8'), /amount|commission/i, file)
  }
})
