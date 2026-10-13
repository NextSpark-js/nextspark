import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import { cookieHeader, otpFromMail, updateJar } from './auth-runtime-check.mjs'

test('the code is the six digits that start the subject', () => {
  assert.equal(otpFromMail({ subject: '123456 is your sign-in code' }), '123456')
  assert.equal(otpFromMail({ subject: 'Your code is 123456' }), undefined)
  assert.equal(otpFromMail({ subject: '12345 is short' }), undefined)
  assert.equal(otpFromMail(null), undefined)
})

test('the jar keeps cookies and drops the ones a response clears', () => {
  const jar = updateJar(new Map(), ['a.session_token=abc; Path=/; HttpOnly', 'a.session_data=x=y; Path=/'])
  assert.equal(cookieHeader(jar), 'a.session_token=abc; a.session_data=x=y')
  updateJar(jar, ['a.session_token=; Max-Age=0; Path=/', 'a.session_data=z; Max-Age=0'])
  assert.equal(cookieHeader(jar), '')
})

// A stand-in for `next start`: an auth API that behaves like Better Auth's, with one thing broken on request.
const FAKE_NEXT = `
const http = require('node:http')
const port = Number(process.argv[process.argv.indexOf('-p') + 1])
const broken = process.env.FAKE_BREAK
const sends = new Map()
let signedIn = false
http.createServer((req, res) => {
  let body = ''
  req.on('data', (c) => (body += c))
  req.on('end', async () => {
    const send = (status, json, headers = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...headers }); res.end(JSON.stringify(json)) }
    const url = req.url.split('?')[0]
    const data = body ? JSON.parse(body) : {}
    if (url === '/login') return send(200, {})
    if (url === '/api/auth/email-otp/send-verification-otp') {
      const n = (sends.get('all') ?? 0) + 1
      sends.set('all', n)
      if (broken === 'otp-send') return send(500, {})
      if (n > 3 && broken !== 'rate-limit') return send(429, { message: 'Too many requests' })
      if (!data.email.endsWith('@example.com')) {
        if (broken === 'blocked-domain') { /* answers 200 below */ }
        else if (broken === 'blocked-mail') { send(403, { code: 'DOMAIN_NOT_ALLOWED' }); return fetch(process.env.RESEND_BASE_URL + '/emails', { method: 'POST', body: JSON.stringify({ to: [data.email], subject: '654321 is your code' }) }) }
        else return send(403, { code: 'DOMAIN_NOT_ALLOWED' })
      }
      send(200, { success: true })
      if (broken !== 'otp-mail') await fetch(process.env.RESEND_BASE_URL + '/emails', { method: 'POST', body: JSON.stringify({ to: [data.email], subject: '123456 is your code' }) })
      return
    }
    if (url === '/api/auth/sign-in/email-otp') {
      if (broken === 'crash') process.exit(1)
      if (broken === 'hang') return
      if (broken === 'otp-verify') return send(401, { code: 'INVALID_OTP' })
      if (data.otp !== '123456') return send(400, { code: 'INVALID_OTP' })
      signedIn = true
      if (broken === 'otp-verify-cookie') return send(200, { ok: true })
      return send(200, { ok: true }, { 'set-cookie': 'better-auth.session_token=tok; Path=/; HttpOnly' })
    }
    if (url === '/api/auth/get-session') return send(200, signedIn && broken !== 'get-session' ? { session: { token: 'SECRET-TOKEN-VALUE' }, user: { email: 'auth-runtime@example.com' } } : null)
    if (url === '/api/auth/sign-out') { if (broken !== 'sign-out') signedIn = false; return send(200, { success: true }, { 'set-cookie': 'better-auth.session_token=; Max-Age=0; Path=/' }) }
    send(404, {})
  })
}).listen(port, '127.0.0.1')
`

const script = fileURLToPath(new URL('./auth-runtime-check.mjs', import.meta.url))
const run = (args, env = {}) => spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', env: { ...process.env, ...env } })

function fakeProject() {
  const dir = mkdtempSync(path.join(tmpdir(), 'auth-runtime-'))
  const bin = path.join(dir, 'node_modules/next/dist/bin')
  mkdirSync(bin, { recursive: true })
  writeFileSync(path.join(bin, 'next'), FAKE_NEXT)
  chmodSync(path.join(bin, 'next'), 0o755)
  return dir
}

test('a missing --app exits 2', () => {
  assert.equal(run([]).status, 2)
})

test('an --app that is not a built project exits 2', () => {
  assert.equal(run(['--app', mkdtempSync(path.join(tmpdir(), 'auth-runtime-')), '--port', '39520']).status, 2)
})

test('a working auth API passes every step', () => {
  const r = run(['--app', fakeProject(), '--port', '39530', '--allowed-domain', 'example.com'])
  assert.equal(r.status, 0, r.stderr)
  for (const step of ['otp-send', 'otp-mail', 'otp-verify', 'get-session', 'blocked-domain', 'sign-out', 'rate-limit']) assert.match(r.stdout, new RegExp(`ok   ${step}`))
})

test('without --allowed-domain the blocked-domain step is skipped, with a note', () => {
  const r = run(['--app', fakeProject(), '--port', '39540'])
  assert.equal(r.status, 0, r.stderr)
  assert.match(r.stdout, /skip blocked-domain/)
})

// Each break is one step's behaviour gone wrong; the run must exit 1 and say which step
const BREAKS = [
  ['otp-send', 'otp-send'],
  ['otp-mail', 'otp-mail'],
  ['otp-verify', 'otp-verify'],
  ['otp-verify-cookie', 'otp-verify'],
  ['get-session', 'get-session'],
  ['blocked-domain', 'blocked-domain'],
  ['blocked-mail', 'blocked-domain'],
  ['sign-out', 'sign-out'],
  ['rate-limit', 'rate-limit'],
  ['crash', 'otp-verify'],
  ['hang', 'otp-verify'],
]
BREAKS.forEach(([broken, step], i) => {
  test(`a break in ${broken} exits 1 and names the step ${step}`, () => {
    const r = run(['--app', fakeProject(), '--port', String(39560 + i * 2), '--allowed-domain', 'example.com', '--request-timeout', '1500'], { FAKE_BREAK: broken })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, new RegExp(`step "${step}" failed`))
  })
})

test('a failed message never carries the session token', () => {
  const r = run(['--app', fakeProject(), '--port', '39600', '--allowed-domain', 'example.com'], { FAKE_BREAK: 'sign-out' })
  assert.equal(r.status, 1, r.stdout + r.stderr)
  assert.match(r.stderr, /\[redacted\]/)
  assert.doesNotMatch(r.stdout + r.stderr, /SECRET-TOKEN-VALUE/)
})
