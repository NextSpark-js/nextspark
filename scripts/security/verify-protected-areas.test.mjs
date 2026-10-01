import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'

import { bodyRedirect, expectationFor, judge, verifyProtectedAreas } from './verify-protected-areas.mjs'

const LOGIN = { allowed: false, target: '/login' }
const DENIED = { allowed: false, target: '/dashboard?error=access_denied' }

test('expectations follow core proxy template rules', () => {
  assert.deepEqual(expectationFor('anonymous', '/devtools/api'), LOGIN)
  assert.deepEqual(expectationFor('member', '/superadmin'), DENIED)
  assert.deepEqual(expectationFor('superadmin', '/superadmin/docs/a/b'), { allowed: true })
  assert.deepEqual(expectationFor('superadmin', '/devtools'), DENIED)
  assert.deepEqual(expectationFor('developer', '/devtools'), { allowed: true })
  assert.throws(() => expectationFor('anonymous', '/superadmin-guide'), /in no protected area/)
})

test('a client redirect is read from a meta refresh or from the RSC redirect digest', () => {
  assert.equal(bodyRedirect('<meta http-equiv="refresh" content="1;url=/login?callbackUrl=%2Fsuperadmin"/>'), '/login?callbackUrl=%2Fsuperadmin')
  assert.equal(bodyRedirect('4:E{"digest":"NEXT_REDIRECT;replace;/dashboard?error=access_denied;307;"}'), '/dashboard?error=access_denied')
  assert.equal(bodyRedirect('<h1>nothing</h1>'), null)
})

test('a refusal is a 307 to the target, or a 200 carrying the client redirect; never with the area in it', () => {
  const ok = response => judge({ response, expectation: LOGIN, forbid: ['Admin Configuration'] })
  assert.equal(ok({ status: 307, location: '/login?callbackUrl=%2Fsuperadmin', body: '' }).form, '307')
  assert.equal(ok({ status: 200, location: null, body: '<meta http-equiv="refresh" content="1;url=/login?callbackUrl=%2Fsuperadmin"/>' }).form, '200 + client redirect')
  const leaked = ok({ status: 307, location: '/login', body: '<h1>Admin Configuration</h1>' })
  assert.equal(leaked.ok, false)
  assert.match(leaked.problems[0], /contains "Admin Configuration"/)
  assert.equal(ok({ status: 200, location: null, body: '<h1>page</h1>' }).ok, false, 'a plain 200 is a breach')
  assert.equal(judge({ response: { status: 200, location: null, body: '0:E{"digest":"NEXT_REDIRECT;replace;/login?callbackUrl=%2Fsuperadmin;307;"}' }, expectation: LOGIN }).form, '200 + client redirect', 'an RSC payload carries the digest')
  assert.equal(judge({ response: { status: 307, location: '/login', body: '' }, expectation: DENIED }).ok, false, 'the wrong target')
  assert.equal(judge({ response: { status: 200, location: null, body: '<h1>ok</h1>' }, expectation: { allowed: true } }).form, 'served')
  assert.equal(judge({ response: { status: 307, location: '/login', body: '' }, expectation: { allowed: true } }).ok, false)
})

test('probes every path for every identity, document and RSC, against a running server', async t => {
  // A fake app: the proxy check is missing, the server-side check answers like core's
  const server = createServer((req, res) => {
    const role = /role=(\w+)/.exec(req.headers.cookie ?? '')?.[1]
    const area = req.url.startsWith('/devtools') ? 'devtools' : 'superadmin'
    const allowed = role === 'developer' || (area === 'superadmin' && role === 'superadmin')
    if (allowed) return res.writeHead(200).end('<h1>Admin Configuration</h1>')
    res.writeHead(307, { location: role ? '/dashboard?error=access_denied' : `/login?callbackUrl=${encodeURIComponent(req.url)}` }).end()
  })
  await new Promise(resolve => server.listen(0, resolve))
  t.after(() => server.close())
  const baseUrl = `http://localhost:${server.address().port}`
  const cookies = { member: 'role=member', superadmin: 'role=superadmin', developer: 'role=developer' }
  const result = await verifyProtectedAreas({ baseUrl, cookies, paths: ['/superadmin/docs/a/b', '/devtools/api'], forbid: ['Admin Configuration'] })
  assert.equal(result.rows.length, 2 * 4 * 2)
  assert.equal(result.ok, true, JSON.stringify(result.rows.filter(row => !row.ok)))
})
