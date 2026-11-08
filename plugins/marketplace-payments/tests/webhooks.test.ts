import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHmac } from 'node:crypto'
import { STRIPE_SIGNATURE_TOLERANCE_SECONDS, WebhookSignatureError, verifyMercadoPagoSignature, verifyStripeSignature } from '../lib/webhooks/signature'
import { handleMercadoPagoWebhook, handleStripeWebhook, type StoredPayment, type WebhookDedupe, type WebhookStore } from '../lib/webhooks/handler'
import type { MercadoPagoPayment } from '../lib/mercadopago/gateway'
import { PAYMENT_STATUS_SOURCES } from '../lib/payment-status'
import type { PaymentStatus } from '../lib/gateway'

const SECRET = 'whsec_test_secret'
const hmac = (secret: string, payload: string) => createHmac('sha256', secret).update(payload).digest('hex')
const nowS = () => Math.floor(Date.now() / 1000)
const stripeHeader = (body: string, { secret = SECRET, t = nowS() } = {}) => `t=${t},v1=${hmac(secret, `${t}.${body}`)}`

test('Stripe: a correct signature passes, over the exact bytes', () => {
  const body = Buffer.from('{"id":"evt_é"}')
  const t = nowS()
  verifyStripeSignature(body, `t=${t},v1=${createHmac('sha256', SECRET).update(`${t}.`).update(body).digest('hex')}`, [SECRET])
})

test('Stripe: every malformed or wrong signature is refused', () => {
  const body = '{"id":"evt_1"}'
  const raw = Buffer.from(body)
  const t = nowS()
  const good = hmac(SECRET, `${t}.${body}`)
  const cases: [string, string | undefined][] = [
    ['no header', undefined],
    ['empty', ''],
    ['no timestamp', `v1=${good}`],
    ['no v1', `t=${t}`],
    ['only v0', `t=${t},v0=${good}`],
    ['bad timestamp', `t=abc,v1=${good}`],
    ['two timestamps', `t=${t},t=${t},v1=${good}`],
    ['wrong secret', stripeHeader(body, { secret: 'other' })],
    ['short signature', `t=${t},v1=abcd`],
    ['non-hex signature', `t=${t},v1=${'z'.repeat(64)}`],
    ['signature for another timestamp', `t=${t + 1},v1=${good}`],
  ]
  for (const [name, header] of cases) assert.throws(() => verifyStripeSignature(raw, header, [SECRET]), WebhookSignatureError, name)
  assert.throws(() => verifyStripeSignature(Buffer.from(body + ' '), stripeHeader(body), [SECRET]), WebhookSignatureError, 'tampered body')
})

test('Stripe: the timestamp window is enforced on both sides', () => {
  const body = 'x'
  const raw = Buffer.from(body)
  const t = 1_000_000
  verifyStripeSignature(raw, stripeHeader(body, { t }), [SECRET], { nowSeconds: t + STRIPE_SIGNATURE_TOLERANCE_SECONDS })
  assert.throws(() => verifyStripeSignature(raw, stripeHeader(body, { t }), [SECRET], { nowSeconds: t + STRIPE_SIGNATURE_TOLERANCE_SECONDS + 1 }), /tolerance/)
  assert.throws(() => verifyStripeSignature(raw, stripeHeader(body, { t }), [SECRET], { nowSeconds: t - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 1 }), /tolerance/)
})

test('Stripe: with no secret configured nothing passes, and an old and a new secret both work', () => {
  const body = 'x'
  assert.throws(() => verifyStripeSignature(Buffer.from(body), stripeHeader(body), []), /no secret/)
  verifyStripeSignature(Buffer.from(body), stripeHeader(body, { secret: 'old' }), ['new', 'old'])
  // any of several v1 values, as Stripe sends during a secret roll
  const t = nowS()
  verifyStripeSignature(Buffer.from(body), `t=${t},v1=${'0'.repeat(64)},v1=${hmac(SECRET, `${t}.${body}`)}`, [SECRET])
})

const mpSignature = (dataId: string, requestId: string, { secret = SECRET, ts = '1700000000' } = {}) =>
  `ts=${ts},v1=${hmac(secret, `id:${dataId.toLowerCase()};request-id:${requestId};ts:${ts};`)}`

test('MercadoPago: a correct signature passes and the data id goes in lower case', () => {
  assert.equal(verifyMercadoPagoSignature({ signature: mpSignature('123', 'req-1'), requestId: 'req-1', dataId: '123' }, [SECRET]), '123')
  assert.equal(verifyMercadoPagoSignature({ signature: mpSignature('AbC1', 'r'), requestId: 'r', dataId: 'AbC1' }, [SECRET]), 'AbC1')
})

test('MercadoPago: every malformed or wrong signature is refused', () => {
  const good = mpSignature('123', 'req-1')
  const cases: [string, { signature: string | undefined; requestId: string | undefined; dataId: string | null }][] = [
    ['no signature', { signature: undefined, requestId: 'req-1', dataId: '123' }],
    ['no request id', { signature: good, requestId: undefined, dataId: '123' }],
    ['no data id', { signature: good, requestId: 'req-1', dataId: null }],
    ['another data id', { signature: good, requestId: 'req-1', dataId: '124' }],
    ['another request id', { signature: good, requestId: 'req-2', dataId: '123' }],
    ['manifest injection in the data id', { signature: good, requestId: 'req-1', dataId: '123;request-id:x' }],
    ['no ts', { signature: `v1=${'a'.repeat(64)}`, requestId: 'req-1', dataId: '123' }],
    ['no v1', { signature: 'ts=1', requestId: 'req-1', dataId: '123' }],
    ['wrong secret', { signature: mpSignature('123', 'req-1', { secret: 'other' }), requestId: 'req-1', dataId: '123' }],
  ]
  for (const [name, input] of cases) assert.throws(() => verifyMercadoPagoSignature(input, [SECRET]), WebhookSignatureError, name)
  assert.throws(() => verifyMercadoPagoSignature({ signature: good, requestId: 'req-1', dataId: '123' }, []), /no secret/)
})

test('an error never holds the secret or the signature', () => {
  const header = stripeHeader('x', { secret: 'other' })
  assert.throws(
    () => verifyStripeSignature(Buffer.from('x'), header, [SECRET]),
    (error: Error) => !error.message.includes(SECRET) && !error.message.includes(header)
  )
})

const PAYMENT: StoredPayment = { id: 'pay-1', provider: 'stripe', accountId: 'acc-1', providerAccountId: 'acct_1', amountCents: 10000, commissionCents: 1500, currency: 'USD' }
const MP_PAYMENT: StoredPayment = { ...PAYMENT, id: 'pay-2', provider: 'mercadopago', providerAccountId: '42', currency: 'ARS' }

function memoryDeps(payments: StoredPayment[] = [PAYMENT, MP_PAYMENT]) {
  const statuses = new Map<string, PaymentStatus>(payments.map(p => [p.id, 'pending']))
  const refunded = new Map<string, number>()
  const log: string[] = []
  const processed = new Set<string>()
  const store: WebhookStore = {
    findPayment: async id => payments.find(p => p.id === id) ?? null,
    findPaymentByProviderPaymentId: async (_provider, pid) => (pid === 'pi_1' ? PAYMENT : null),
    transitionPayment: async (id, status, fields) => {
      log.push(`transition:${id}:${status}`)
      if (PAYMENT_STATUS_SOURCES[status].includes(statuses.get(id)!)) statuses.set(id, status)
      if (fields?.refundedCents !== undefined) refunded.set(id, Math.max(refunded.get(id) ?? 0, fields.refundedCents))
    },
    updateSellerStatus: async (_p, id, s) => void log.push(`seller:${id}:${s.status}`),
    disconnectSeller: async (_p, id) => void log.push(`disconnect:${id}`),
    getSellerAccessToken: async () => 'seller-token',
  }
  const dedupe: WebhookDedupe = async (gateway, id, _type, handle) => {
    const key = `${gateway}:${id}`
    log.push(`dedupe:${key}`)
    if (processed.has(key)) return Response.json({ received: true, status: 'duplicate' })
    await handle()
    processed.add(key)
    return Response.json({ received: true })
  }
  return { store, dedupe, log, statuses, refunded }
}

function stripeRequest(event: object, headerFor: (body: string) => string = stripeHeader) {
  const body = JSON.stringify({ livemode: false, ...event })
  return new Request('https://app.test/hook', { method: 'POST', body, headers: { 'stripe-signature': headerFor(body) } })
}

const session = (over = {}) => ({ id: 'cs_1', payment_status: 'paid', amount_total: 10000, currency: 'usd', payment_intent: 'pi_1', metadata: { marketplacePaymentId: 'pay-1' }, ...over })
const completed = (object = session(), id = 'evt_1') => ({ id, type: 'checkout.session.completed', data: { object } })

const silenced = (t: { mock: { method: (o: object, m: never, f: () => void) => unknown } }) => {
  t.mock.method(console, 'warn' as never, () => {})
  t.mock.method(console, 'error' as never, () => {})
}

test('Stripe webhook: a bad signature stops before the store and the dedupe', async t => {
  silenced(t as never)
  const { store, dedupe, log } = memoryDeps()
  for (const request of [
    stripeRequest(completed(), () => 'nonsense'),
    stripeRequest(completed(), body => stripeHeader(body, { secret: 'other' })),
    stripeRequest(completed(), body => stripeHeader(body, { t: nowS() - STRIPE_SIGNATURE_TOLERANCE_SECONDS - 5 })),
    new Request('https://app.test/hook', { method: 'POST', body: '{}' }),
  ]) {
    assert.equal((await handleStripeWebhook(request, { secrets: [SECRET], livemode: false, store, dedupe })).status, 400)
  }
  assert.equal((await handleStripeWebhook(stripeRequest(completed()), { secrets: [], livemode: false, store, dedupe })).status, 400)
  assert.deepEqual(log, [])
})

test('Stripe webhook: a paid checkout completes the payment and a repeated event does nothing', async () => {
  const { store, dedupe, log, statuses } = memoryDeps()
  const deps = { secrets: [SECRET], livemode: false, store, dedupe }
  assert.equal((await handleStripeWebhook(stripeRequest(completed()), deps)).status, 200)
  assert.equal(statuses.get('pay-1'), 'succeeded')
  const second = await handleStripeWebhook(stripeRequest(completed()), deps)
  assert.deepEqual(await second.json(), { received: true, status: 'duplicate' })
  assert.equal(log.filter(entry => entry.startsWith('transition')).length, 1)
})

test('Stripe webhook: an amount or currency other than the server computed is not marked as paid', async t => {
  silenced(t as never)
  for (const object of [session({ amount_total: 1 }), session({ currency: 'eur' })]) {
    const { store, dedupe, statuses } = memoryDeps()
    await handleStripeWebhook(stripeRequest(completed(object)), { secrets: [SECRET], livemode: false, store, dedupe })
    assert.equal(statuses.get('pay-1'), 'pending', JSON.stringify(object))
  }
})

test('Stripe webhook: an event of another environment, or a payment event with an account, changes nothing', async () => {
  const { store, dedupe, log, statuses } = memoryDeps()
  const deps = { secrets: [SECRET], livemode: false, store, dedupe }
  for (const event of [{ ...completed(), livemode: true }, { ...completed(), account: 'acct_other' }, { id: 'e9', type: 'charge.refunded', account: 'acct_other', data: { object: { payment_intent: 'pi_1', amount: 10000, amount_refunded: 10000 } } }]) {
    assert.deepEqual(await (await handleStripeWebhook(stripeRequest(event), deps)).json(), { received: true, status: 'ignored' }, JSON.stringify(event))
  }
  assert.deepEqual(log, [])
  assert.equal(statuses.get('pay-1'), 'pending')
  // the same event on a live deployment
  await handleStripeWebhook(stripeRequest({ ...completed(), livemode: true }), { ...deps, livemode: true })
  assert.equal(statuses.get('pay-1'), 'succeeded')
  // a seller lifecycle event still carries its account
  await handleStripeWebhook(stripeRequest({ id: 'e10', type: 'account.application.deauthorized', account: 'acct_1', data: { object: {} } }), deps)
  assert.ok(log.includes('disconnect:acct_1'))
})

test('Stripe webhook: an unpaid checkout waits for the async result', async () => {
  const { store, dedupe, statuses } = memoryDeps()
  const deps = { secrets: [SECRET], livemode: false, store, dedupe }
  await handleStripeWebhook(stripeRequest(completed(session({ payment_status: 'unpaid' }))), deps)
  assert.equal(statuses.get('pay-1'), 'pending')
  await handleStripeWebhook(stripeRequest({ id: 'e2', type: 'checkout.session.async_payment_failed', data: { object: session() } }), deps)
  assert.equal(statuses.get('pay-1'), 'failed')
})

test('Stripe webhook: refunds, disputes and sellers', async () => {
  const { store, dedupe, statuses, refunded, log } = memoryDeps()
  const deps = { secrets: [SECRET], livemode: false, store, dedupe }
  const event = (id: string, type: string, object: object, extra = {}) => stripeRequest({ id, type, data: { object }, ...extra })
  await handleStripeWebhook(stripeRequest(completed()), deps)
  await handleStripeWebhook(event('e2', 'charge.refunded', { payment_intent: 'pi_1', amount: 10000, amount_refunded: 2500 }), deps)
  assert.equal(statuses.get('pay-1'), 'partially_refunded')
  assert.equal(refunded.get('pay-1'), 2500)
  await handleStripeWebhook(event('e3', 'charge.dispute.created', { payment_intent: 'pi_1' }), deps)
  assert.equal(statuses.get('pay-1'), 'disputed')
  await handleStripeWebhook(event('e4', 'charge.dispute.closed', { payment_intent: 'pi_1', status: 'won' }), deps)
  assert.equal(statuses.get('pay-1'), 'succeeded')
  await handleStripeWebhook(event('e5', 'charge.refunded', { payment_intent: 'pi_1', amount: 10000, amount_refunded: 10000 }), deps)
  assert.equal(statuses.get('pay-1'), 'refunded')
  // final: a late approval changes nothing
  await handleStripeWebhook(stripeRequest(completed(session(), 'e6')), deps)
  assert.equal(statuses.get('pay-1'), 'refunded')

  await handleStripeWebhook(event('e7', 'account.updated', { id: 'acct_1', charges_enabled: true, payouts_enabled: true }), deps)
  await handleStripeWebhook(event('e8', 'account.application.deauthorized', {}, { account: 'acct_1' }), deps)
  assert.ok(log.includes('seller:acct_1:active'))
  assert.ok(log.includes('disconnect:acct_1'))
})

test('Stripe webhook: a failure in processing answers 500 without the error text', async t => {
  silenced(t as never)
  const { store, dedupe } = memoryDeps()
  const broken = { ...store, transitionPayment: async () => { throw new Error('token sk_live_x') } }
  const response = await handleStripeWebhook(stripeRequest(completed()), { secrets: [SECRET], livemode: false, store: broken, dedupe })
  assert.equal(response.status, 500)
  assert.ok(!(await response.text()).includes('sk_live_x'))
})

function mpRequest({ dataId = '555', ref = 'pay-2', type = 'payment', signature }: { dataId?: string; ref?: string | null; type?: string; signature?: string } = {}) {
  const url = new URL('https://app.test/hook')
  url.searchParams.set('data.id', dataId)
  url.searchParams.set('type', type)
  if (ref) url.searchParams.set('ref', ref)
  return new Request(url, { method: 'POST', body: '{"user_id":1}', headers: { 'x-signature': signature ?? mpSignature(dataId, 'req-1'), 'x-request-id': 'req-1' } })
}

const remote = (over: Partial<MercadoPagoPayment> = {}): MercadoPagoPayment => ({
  id: 555,
  status: 'approved',
  date_last_updated: '2026-01-01T00:00:00.000Z',
  external_reference: 'pay-2',
  collector_id: 42,
  transaction_amount: 100,
  currency_id: 'ARS',
  fee_details: [{ type: 'application_fee', amount: 15 }, { type: 'mercadopago_fee', amount: 3 }],
  ...over,
})

function mpDeps(payment = remote()) {
  const memory = memoryDeps()
  const fetched: [string, string][] = []
  return { ...memory, fetched, deps: { secrets: [SECRET], livemode: false, store: memory.store, dedupe: memory.dedupe, getPayment: async (id: string, token: string) => { fetched.push([id, token]); return payment } } }
}

test('MercadoPago webhook: a bad signature stops before the API, the store and the dedupe', async t => {
  silenced(t as never)
  const { deps, log, fetched } = mpDeps()
  for (const request of [mpRequest({ signature: 'nonsense' }), mpRequest({ signature: mpSignature('555', 'req-1', { secret: 'x' }) }), mpRequest({ dataId: '556', signature: mpSignature('555', 'req-1') })]) {
    assert.equal((await handleMercadoPagoWebhook(request, deps)).status, 400)
  }
  assert.equal((await handleMercadoPagoWebhook(mpRequest(), { ...deps, secrets: [] })).status, 400)
  assert.deepEqual(log, [])
  assert.deepEqual(fetched, [])
})

test('MercadoPago webhook: the payment is read with the seller token, and a repeat of the same state is a duplicate', async () => {
  const { deps, statuses, log, fetched } = mpDeps()
  assert.equal((await handleMercadoPagoWebhook(mpRequest(), deps)).status, 200)
  assert.deepEqual(fetched, [['555', 'seller-token']])
  assert.equal(statuses.get('pay-2'), 'succeeded')
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(log.filter(entry => entry.startsWith('transition')).length, 1)
  assert.deepEqual(log.filter(entry => entry.startsWith('dedupe')), ['dedupe:marketplace:mercadopago:payment:555:approved:0:2026-01-01T00:00:00.000Z', 'dedupe:marketplace:mercadopago:payment:555:approved:0:2026-01-01T00:00:00.000Z'])
})

test('MercadoPago webhook: a payment that returns to a status it had is processed again', async () => {
  let current = remote()
  const { deps, statuses } = mpDeps()
  deps.getPayment = async () => current
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'succeeded')
  current = remote({ status: 'in_mediation', date_last_updated: '2026-01-02T00:00:00.000Z' })
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'disputed')
  current = remote({ date_last_updated: '2026-01-03T00:00:00.000Z' })
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'succeeded')
})

test('MercadoPago webhook: another notification of a new state is processed', async () => {
  let current = remote()
  const { deps, statuses, refunded } = mpDeps()
  deps.getPayment = async () => current
  await handleMercadoPagoWebhook(mpRequest(), deps)
  current = remote({ transaction_amount_refunded: 25 })
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'partially_refunded')
  assert.equal(refunded.get('pay-2'), 2500)
  current = remote({ status: 'refunded', transaction_amount_refunded: 100 })
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'refunded')
})

test('MercadoPago webhook: a payment that is not ours for this reference, amount or fee changes nothing', async t => {
  silenced(t as never)
  for (const payment of [
    remote({ external_reference: 'other' }),
    remote({ collector_id: 99 }),
    remote({ transaction_amount: 1 }),
    remote({ currency_id: 'BRL' }),
    remote({ fee_details: [{ type: 'application_fee', amount: 1 }] }),
    remote({ fee_details: [] }),
    remote({ fee_details: undefined }),
  ]) {
    const { deps, statuses } = mpDeps(payment)
    assert.equal((await handleMercadoPagoWebhook(mpRequest(), deps)).status, 200)
    assert.equal(statuses.get('pay-2'), 'pending', JSON.stringify(payment))
  }
})

test('MercadoPago webhook: other types, a missing reference and an unknown or foreign payment are acknowledged and ignored', async () => {
  for (const request of [mpRequest({ type: 'mp-connect' }), mpRequest({ ref: null }), mpRequest({ ref: 'nope' }), mpRequest({ ref: 'pay-1' })]) {
    const { deps, fetched, log } = mpDeps()
    assert.equal((await handleMercadoPagoWebhook(request, deps)).status, 200)
    assert.deepEqual(fetched, [])
    assert.deepEqual(log, [])
  }
})

test('MercadoPago webhook: an API failure answers 500 so the provider retries', async t => {
  silenced(t as never)
  const { deps, log } = mpDeps()
  deps.getPayment = async () => { throw new Error('boom') }
  assert.equal((await handleMercadoPagoWebhook(mpRequest(), deps)).status, 500)
  assert.deepEqual(log, [])
})

test('MercadoPago webhook: statuses map, and a late rejection does not undo an approval', async () => {
  let current = remote()
  const { deps, statuses } = mpDeps()
  deps.getPayment = async () => current
  await handleMercadoPagoWebhook(mpRequest(), deps)
  current = remote({ status: 'rejected' })
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'succeeded')
  current = remote({ status: 'charged_back' })
  await handleMercadoPagoWebhook(mpRequest(), deps)
  assert.equal(statuses.get('pay-2'), 'disputed')
})
