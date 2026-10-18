import { test } from 'node:test'
import assert from 'node:assert/strict'
import http from 'node:http'
import { grantedIn, isVendorUrl, startNonceProxy, strictPolicy, vendorOf } from './consent-browser-check.mjs'

test('isVendorUrl and vendorOf recognise Plausible and Google hosts, and nothing of the app', () => {
  for (const url of ['https://plausible.io/js/script.js', 'https://plausible.io/api/event', 'https://www.googletagmanager.com/gtag/js?id=G-1', 'https://region1.google-analytics.com/g/collect', 'https://www.google-analytics.com/collect', 'https://stats.g.doubleclick.net.analytics.google.com/x']) {
    assert.equal(isVendorUrl(url), true, url)
  }
  for (const url of ['http://localhost:4790/', 'https://example.com/plausible.io', 'https://notplausible.io/x', 'https://googletagmanager.com.evil.example/x']) {
    assert.equal(isVendorUrl(url), false, url)
  }
  assert.equal(vendorOf('https://plausible.io/js/script.js'), 'plausible')
  assert.equal(vendorOf('https://www.googletagmanager.com/gtag/js'), 'google')
  assert.equal(vendorOf('http://localhost/'), null)
})

test('grantedIn reads the granted categories of a consent cookie value, null for anything else', () => {
  assert.deepEqual(grantedIn(encodeURIComponent('{"v":"1:analytics","g":["analytics"],"t":1}')), ['analytics'])
  assert.deepEqual(grantedIn(encodeURIComponent('{"g":[]}')), [])
  assert.equal(grantedIn('nope'), null)
  assert.equal(grantedIn(''), null)
})

test('the strict policy allows only nonce\'d scripts and the vendor connect origins', () => {
  const policy = strictPolicy('abc')
  assert.match(policy, /script-src 'nonce-abc' 'strict-dynamic'/)
  assert.doesNotMatch(policy, /unsafe-inline|unsafe-eval/)
  assert.match(policy, /connect-src 'self' https:\/\/plausible\.io/)
})

test('the nonce proxy forwards a per-request nonce and adds the policy next to the one the app sends', async () => {
  let seen
  const upstream = http.createServer((req, res) => {
    seen = req.headers
    res.writeHead(200, { 'content-security-policy': "default-src 'self'", 'content-type': 'text/plain' })
    res.end('ok')
  })
  await new Promise((r) => upstream.listen(0, '127.0.0.1', r))
  const proxy = await startNonceProxy(0, upstream.address().port)
  try {
    const get = () => fetch(`http://127.0.0.1:${proxy.server.address().port}/`)
    const first = await get()
    const second = await get()
    assert.equal(await first.text(), 'ok')
    const nonce = seen['x-nonce']
    assert.ok(nonce)
    assert.equal(seen['content-security-policy'], strictPolicy(nonce))
    assert.match(first.headers.get('content-security-policy'), /default-src 'self'/)
    assert.match(first.headers.get('content-security-policy'), /strict-dynamic/)
    assert.equal(proxy.nonces.length, 2)
    assert.notEqual(proxy.nonces[0], proxy.nonces[1])
    await second.text()
  } finally {
    proxy.server.close()
    upstream.close()
  }
})
