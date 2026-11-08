import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { STRIPE_API_VERSION } from '../lib/stripe/api-version'
import { createStripeConnectGateway, stripeAccountStatus, stripeFormEncode } from '../lib/stripe/gateway'
import { ProviderApiError } from '../lib/provider-error'

const SECRET = 'sk_test_do_not_log'

function fakeFetch(responses: unknown[], status = 200) {
  const calls: { url: string; init: RequestInit; form: URLSearchParams }[] = []
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init, form: new URLSearchParams(String(init.body ?? '')) })
    return new Response(JSON.stringify(responses[calls.length - 1]), { status })
  }) as unknown as typeof fetch
  return { calls, impl }
}

test('the form encoding nests objects and arrays and leaves out undefined', () => {
  const form = new URLSearchParams(stripeFormEncode({ a: { b: [{ c: 1 }] }, skip: undefined, d: true }))
  assert.equal(form.get('a[b][0][c]'), '1')
  assert.equal(form.get('d'), 'true')
  assert.equal(form.has('skip'), false)
})

test('onboarding creates an Express account once and returns its link', async () => {
  const { calls, impl } = fakeFetch([{ id: 'acct_1' }, { url: 'https://connect.stripe.test/x' }])
  const gateway = createStripeConnectGateway({ secretKey: SECRET, fetch: impl })
  const result = await gateway.startOnboarding({ teamId: 'team-a', email: 'a@b.test', country: 'US', returnUrl: 'https://app.test/r', refreshUrl: 'https://app.test/f' })
  assert.deepEqual(result, { redirectUrl: 'https://connect.stripe.test/x', providerAccountId: 'acct_1' })
  assert.equal(calls[0].url, 'https://api.stripe.com/v1/accounts')
  assert.equal(calls[0].form.get('type'), 'express')
  assert.equal(calls[0].form.get('capabilities[transfers][requested]'), 'true')
  assert.equal(calls[0].form.get('metadata[teamId]'), 'team-a')
  assert.equal((calls[0].init.headers as Record<string, string>)['Idempotency-Key'], 'marketplace-account-team-a')
  assert.equal(calls[1].form.get('account'), 'acct_1')
  assert.equal(calls[1].form.get('type'), 'account_onboarding')
  assert.equal(calls[1].form.get('refresh_url'), 'https://app.test/f')
})

test('onboarding resumes an existing account without creating another', async () => {
  const { calls, impl } = fakeFetch([{ url: 'https://connect.stripe.test/y' }])
  const gateway = createStripeConnectGateway({ secretKey: SECRET, fetch: impl })
  const result = await gateway.startOnboarding({ teamId: 't', returnUrl: 'https://app.test/r', providerAccountId: 'acct_9' })
  assert.equal(calls.length, 1)
  assert.match(calls[0].url, /account_links/)
  assert.equal(result.providerAccountId, undefined)
})

test('a checkout is a destination charge with the computed fee', async () => {
  const { calls, impl } = fakeFetch([{ id: 'cs_1', url: 'https://checkout.stripe.test/1' }])
  const gateway = createStripeConnectGateway({ secretKey: SECRET, fetch: impl })
  const result = await gateway.createSplitCheckout(
    { paymentId: 'pay-1', amountCents: 10000, commissionCents: 1500, currency: 'USD', description: 'Order', successUrl: 'https://app.test/ok', cancelUrl: 'https://app.test/no' },
    { providerAccountId: 'acct_1' }
  )
  assert.deepEqual(result, { checkoutUrl: 'https://checkout.stripe.test/1', providerCheckoutId: 'cs_1' })
  const { form, init } = calls[0]
  assert.equal(form.get('mode'), 'payment')
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '10000')
  assert.equal(form.get('line_items[0][price_data][currency]'), 'usd')
  assert.equal(form.get('payment_intent_data[application_fee_amount]'), '1500')
  assert.equal(form.get('payment_intent_data[transfer_data][destination]'), 'acct_1')
  assert.equal(form.get('client_reference_id'), 'pay-1')
  assert.equal(form.get('payment_intent_data[metadata][marketplacePaymentId]'), 'pay-1')
  assert.equal((init.headers as Record<string, string>)['Idempotency-Key'], 'marketplace-checkout-pay-1')
})

test('a commission of zero leaves the fee field out, which Stripe requires', async () => {
  const { calls, impl } = fakeFetch([{ id: 'cs', url: 'u' }])
  await createStripeConnectGateway({ secretKey: SECRET, fetch: impl }).createSplitCheckout(
    { paymentId: 'p', amountCents: 100, commissionCents: 0, currency: 'usd', description: 'd', successUrl: 's', cancelUrl: 'c' },
    { providerAccountId: 'a' }
  )
  assert.equal(calls[0].form.has('payment_intent_data[application_fee_amount]'), false)
})

test('a refund reverses the transfer and returns the fee', async () => {
  const { calls, impl } = fakeFetch([{ id: 're_1' }])
  const result = await createStripeConnectGateway({ secretKey: SECRET, fetch: impl }).refund(
    { providerPaymentId: 'pi_1', amountCents: 500, currency: 'usd', idempotencyKey: 'k1' },
    { providerAccountId: 'a' }
  )
  assert.deepEqual(result, { providerRefundId: 're_1' })
  assert.equal(calls[0].form.get('reverse_transfer'), 'true')
  assert.equal(calls[0].form.get('refund_application_fee'), 'true')
  assert.equal(calls[0].form.get('amount'), '500')
})

test('the status of an account follows charges, payouts and requirements', () => {
  assert.equal(stripeAccountStatus({ charges_enabled: true, payouts_enabled: true }).status, 'active')
  assert.equal(stripeAccountStatus({ charges_enabled: true, payouts_enabled: false }).status, 'pending')
  assert.equal(stripeAccountStatus({ requirements: { disabled_reason: 'rejected.fraud' } }).status, 'restricted')
  assert.equal(stripeAccountStatus({}).status, 'pending')
})

test('every call sends the pinned API version and the secret only in the Authorization header', async () => {
  const { calls, impl } = fakeFetch([{ charges_enabled: true, payouts_enabled: true, country: 'US' }])
  const status = await createStripeConnectGateway({ secretKey: SECRET, fetch: impl }).getAccountStatus({ providerAccountId: 'acct/../x' })
  assert.equal(status.status, 'active')
  const headers = calls[0].init.headers as Record<string, string>
  assert.equal(headers['Stripe-Version'], STRIPE_API_VERSION)
  assert.equal(headers.Authorization, `Bearer ${SECRET}`)
  assert.ok(!calls[0].url.includes(SECRET))
  assert.ok(calls[0].url.endsWith('/v1/accounts/acct%2F..%2Fx'))
})

test('an API error carries the status and code, and never the secret or the body', async () => {
  const { impl } = fakeFetch([{ error: { code: 'account_invalid', message: `key ${SECRET} leaked` } }], 400)
  await assert.rejects(
    createStripeConnectGateway({ secretKey: SECRET, fetch: impl }).getAccountStatus({ providerAccountId: 'a' }),
    (error: ProviderApiError) => {
      assert.equal(error.status, 400)
      assert.equal(error.code, 'account_invalid')
      assert.ok(!error.message.includes(SECRET) && !JSON.stringify(error).includes(SECRET))
      return true
    }
  )
})

test('the Stripe API version is written in one place only', () => {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const found: string[] = []
  const walk = (dir: string): void => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', 'tests', 'docs'].includes(entry.name)) continue
      const file = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(file)
      else if (/\.tsx?$/.test(entry.name) && /\b20\d\d-\d\d-\d\d\.[a-z]+\b/.test(fs.readFileSync(file, 'utf8'))) found.push(path.relative(root, file))
    }
  }
  walk(root)
  assert.deepEqual(found, ['lib/stripe/api-version.ts'])
})
