import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createMercadoPagoGateway } from '../lib/mercadopago/gateway'
import { REFRESH_TOKENS_TIMEOUT_MS, refreshExpiringMercadoPagoTokens, type CredentialUpdate, type LockedCredential, type TokenRefreshStore } from '../lib/mercadopago/refresh'
import { PROVIDER_TIMEOUT_MS, ProviderApiError } from '../lib/provider-error'
import { majorToMinor, minorToMajor } from '../lib/money'

function fakeFetch(responses: { status?: number; body: unknown }[]) {
  const calls: { url: string; init: RequestInit; body: any }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, body: init.body ? JSON.parse(String(init.body)) : undefined })
    const { status = 200, body } = responses[calls.length - 1]
    return new Response(JSON.stringify(body), { status })
  }) as unknown as typeof fetch
  return { calls, impl }
}

const gatewayWith = (impl: typeof fetch, sandbox = false) =>
  createMercadoPagoGateway({ clientId: 'cid', clientSecret: 'csecret', redirectUri: 'https://app.test/cb', sandbox, fetch: impl })

test('money converts at the boundary per currency, and an unknown currency is refused', () => {
  assert.equal(minorToMajor(1234, 'ARS'), 12.34)
  assert.equal(minorToMajor(1234, 'clp'), 1234)
  assert.equal(majorToMinor(12.34, 'BRL'), 1234)
  assert.equal(majorToMinor(1.15, 'MXN'), 115) // 1.15 * 100 is 114.99999999999999
  assert.throws(() => minorToMajor(1, 'XXX'), RangeError)
})

test('onboarding is the OAuth URL with the state and needs one', async () => {
  const gateway = gatewayWith(fakeFetch([]).impl)
  const { redirectUrl } = await gateway.startOnboarding({ teamId: 't', returnUrl: 'r', state: 'st4te' })
  const url = new URL(redirectUrl)
  assert.equal(url.origin + url.pathname, 'https://auth.mercadopago.com/authorization')
  assert.equal(url.searchParams.get('state'), 'st4te')
  assert.equal(url.searchParams.get('client_id'), 'cid')
  assert.equal(url.searchParams.get('redirect_uri'), 'https://app.test/cb')
  await assert.rejects(gateway.startOnboarding({ teamId: 't', returnUrl: 'r' }), /state/)
})

test('the code exchange and the refresh send the right grants', async () => {
  const token = { access_token: 'at', refresh_token: 'rt', user_id: 42, expires_in: 15552000 }
  const { calls, impl } = fakeFetch([{ body: token }, { body: token }])
  const gateway = gatewayWith(impl)
  const before = Date.now()
  const tokens = await gateway.exchangeCode('c0de')
  assert.equal(tokens.providerAccountId, '42')
  assert.ok(tokens.expiresAt.getTime() >= before + 15552000 * 1000)
  assert.deepEqual(calls[0].body, { client_id: 'cid', client_secret: 'csecret', grant_type: 'authorization_code', code: 'c0de', redirect_uri: 'https://app.test/cb' })
  await gateway.refreshAccessToken('old')
  assert.equal(calls[1].body.grant_type, 'refresh_token')
  assert.equal(calls[1].body.refresh_token, 'old')
})

test('a checkout uses the seller token and the computed fee in major units', async () => {
  const { calls, impl } = fakeFetch([{ body: { id: 'pref1', init_point: 'https://mp.test/live', sandbox_init_point: 'https://mp.test/sb' } }])
  const result = await gatewayWith(impl).createSplitCheckout(
    { paymentId: 'pay-1', amountCents: 10050, commissionCents: 1508, currency: 'ars', description: 'Order', successUrl: 'https://app.test/ok', cancelUrl: 'https://app.test/no', notificationUrl: 'https://app.test/hook' },
    { providerAccountId: '42', accessToken: 'seller-token' }
  )
  assert.deepEqual(result, { checkoutUrl: 'https://mp.test/live', providerCheckoutId: 'pref1' })
  assert.equal((calls[0].init.headers as Record<string, string>).Authorization, 'Bearer seller-token')
  assert.equal(calls[0].body.items[0].unit_price, 100.5)
  assert.equal(calls[0].body.items[0].currency_id, 'ARS')
  assert.equal(calls[0].body.marketplace_fee, 15.08)
  assert.equal(calls[0].body.external_reference, 'pay-1')
  assert.equal(calls[0].body.notification_url, 'https://app.test/hook')
  assert.equal(calls[0].body.auto_return, 'approved')
})

test('sandbox mode returns the sandbox link, and a non-https return URL has no auto_return', async () => {
  const { calls, impl } = fakeFetch([{ body: { id: 'p', init_point: 'live', sandbox_init_point: 'sb' } }])
  const result = await gatewayWith(impl, true).createSplitCheckout(
    { paymentId: 'p', amountCents: 100, commissionCents: 10, currency: 'ARS', description: 'd', successUrl: 'http://localhost/ok', cancelUrl: 'http://localhost/no' },
    { providerAccountId: '42', accessToken: 't' }
  )
  assert.equal(result.checkoutUrl, 'sb')
  assert.equal('auto_return' in calls[0].body, false)
})

test('a call that needs the seller token and has none fails before any request', async () => {
  const { calls, impl } = fakeFetch([])
  await assert.rejects(gatewayWith(impl).refund({ providerPaymentId: '1', currency: 'ARS', idempotencyKey: 'k' }, { providerAccountId: '42' }), /seller access token/)
  assert.equal(calls.length, 0)
})

test('a refund is sent in major units with an idempotency key; a full refund has no amount', async () => {
  const { calls, impl } = fakeFetch([{ body: { id: 7 } }, { body: { id: 8 } }])
  const gateway = gatewayWith(impl)
  const seller = { providerAccountId: '42', accessToken: 't' }
  assert.deepEqual(await gateway.refund({ providerPaymentId: '99', amountCents: 250, currency: 'ARS', idempotencyKey: 'k1' }, seller), { providerRefundId: '7' })
  assert.equal(calls[0].url, 'https://api.mercadopago.com/v1/payments/99/refunds')
  assert.deepEqual(calls[0].body, { amount: 2.5 })
  assert.equal((calls[0].init.headers as Record<string, string>)['X-Idempotency-Key'], 'k1')
  await gateway.refund({ providerPaymentId: '99', currency: 'ARS', idempotencyKey: 'k2' }, seller)
  assert.deepEqual(calls[1].body, {})
})

test('a rejected seller token reads as disconnected; another failure throws', async () => {
  const seller = { providerAccountId: '42', accessToken: 't' }
  assert.equal((await gatewayWith(fakeFetch([{ status: 401, body: {} }]).impl).getAccountStatus(seller)).status, 'disconnected')
  await assert.rejects(gatewayWith(fakeFetch([{ status: 500, body: {} }]).impl).getAccountStatus(seller), ProviderApiError)
})

test('an API error never carries the body or the client secret', async () => {
  const { impl } = fakeFetch([{ status: 400, body: { error: 'invalid_grant', message: 'csecret rt-secret' } }])
  await assert.rejects(gatewayWith(impl).exchangeCode('c'), (error: ProviderApiError) => {
    assert.equal(error.code, 'invalid_grant')
    assert.ok(!error.message.includes('csecret') && !JSON.stringify(error).includes('rt-secret'))
    return true
  })
})

function memoryStore(credentials: LockedCredential[]) {
  const updates: Record<string, CredentialUpdate> = {}
  const store: TokenRefreshStore = {
    listMercadoPagoAccountsExpiringBefore: async () => credentials.map(c => c.accountId),
    updateLockedCredential: async (id, decide) => {
      updates[id] = await decide(credentials.find(c => c.accountId === id)!)
    },
  }
  return { store, updates }
}

const NOW = new Date('2026-01-01T00:00:00Z')
const soon = new Date('2026-01-10T00:00:00Z')
const tokens = { accessToken: 'new', refreshToken: 'new-r', providerAccountId: '1', expiresAt: new Date('2026-06-01T00:00:00Z') }

const credential = (accountId: string, refreshToken: string, expiresAt = soon): LockedCredential => ({ accountId, providerAccountId: `mp-${accountId}`, accessToken: `access-${accountId}`, refreshToken, expiresAt })
const invalidGrant = () => new ProviderApiError('mercadopago', 400, 'invalid_grant')
const active = async () => ({ status: 'active' as const, chargesEnabled: true, payoutsEnabled: true })
const refused = async () => ({ status: 'disconnected' as const, chargesEnabled: false, payoutsEnabled: false })

test('the refresh renews what is expiring, and a grant refused along with the access token disconnects only that seller', async () => {
  const { store, updates } = memoryStore([credential('a', 'ok'), credential('b', 'revoked')])
  const asked: string[] = []
  const summary = await refreshExpiringMercadoPagoTokens(
    store,
    {
      refreshAccessToken: async token => { if (token === 'revoked') throw invalidGrant(); return tokens },
      getAccountStatus: async seller => { asked.push(`${seller.providerAccountId}:${seller.accessToken}`); return refused() },
    },
    NOW
  )
  assert.deepEqual(summary, { refreshed: 1, revoked: 1, failed: 0 })
  assert.deepEqual(updates.a, { tokens })
  assert.equal(updates.b, 'revoked')
  assert.deepEqual(asked, ['mp-b:access-b'])
})

test('a refused grant with a working access token keeps the seller and is counted as failed', async t => {
  t.mock.method(console, 'error', () => {})
  const { store, updates } = memoryStore([credential('a', 'x')])
  const summary = await refreshExpiringMercadoPagoTokens(store, { refreshAccessToken: async () => { throw invalidGrant() }, getAccountStatus: active }, NOW)
  assert.deepEqual(summary, { refreshed: 0, revoked: 0, failed: 1 })
  assert.equal('a' in updates, false)
})

test('a refused grant whose confirmation fails keeps the seller and is counted as failed', async t => {
  t.mock.method(console, 'error', () => {})
  const { store, updates } = memoryStore([credential('a', 'x')])
  const summary = await refreshExpiringMercadoPagoTokens(store, { refreshAccessToken: async () => { throw invalidGrant() }, getAccountStatus: async () => { throw new ProviderApiError('mercadopago', 503) } }, NOW)
  assert.deepEqual(summary, { refreshed: 0, revoked: 0, failed: 1 })
  assert.equal('a' in updates, false)
})

test('the refresh action declares a timeout that covers a whole run', () => {
  assert.ok(REFRESH_TOKENS_TIMEOUT_MS >= 25 * 2 * PROVIDER_TIMEOUT_MS)
  const source = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../lib/scheduled-actions.ts'), 'utf8')
  assert.match(source, /timeout: REFRESH_TOKENS_TIMEOUT_MS/)
})

test('a provider outage keeps the seller connected and is counted as failed, not revoked', async (t) => {
  t.mock.method(console, 'error', () => {})
  const { store, updates } = memoryStore([credential('a', 'x')])
  const summary = await refreshExpiringMercadoPagoTokens(store, { refreshAccessToken: async () => { throw new ProviderApiError('mercadopago', 503) }, getAccountStatus: refused }, NOW)
  assert.deepEqual(summary, { refreshed: 0, revoked: 0, failed: 1 })
  assert.equal('a' in updates, false)
})

test('a credential another run already renewed is left alone', async () => {
  const { store, updates } = memoryStore([credential('a', 'x', new Date('2026-05-01T00:00:00Z'))])
  let called = 0
  const summary = await refreshExpiringMercadoPagoTokens(store, { refreshAccessToken: async () => { called++; return tokens }, getAccountStatus: active }, NOW)
  assert.equal(called, 0)
  assert.equal(updates.a, null)
  assert.deepEqual(summary, { refreshed: 0, revoked: 0, failed: 0 })
})
