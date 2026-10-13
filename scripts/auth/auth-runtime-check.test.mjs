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
      if (n > 3 && broken !== 'rate-limit') return send(429, { message: 'Too many requests' })
      if (!data.email.endsWith('@example.com') && broken !== 'blocked-domain') return send(403, { code: 'DOMAIN_NOT_ALLOWED' })
      send(200, { success: true })
      if (broken !== 'otp-mail') await fetch(process.env.RESEND_BASE_URL + '/emails', { method: 'POST', body: JSON.stringify({ to: [data.email], subject: '123456 is your code' }) })
      return
    }
    if (url === '/api/auth/sign-in/email-otp') {
      if (data.otp !== '123456') return send(400, { code: 'INVALID_OTP' })
      signedIn = true
      return send(200, { ok: true }, { 'set-cookie': 'better-auth.session_token=tok; Path=/; HttpOnly' })
    }
    if (url === '/api/auth/get-session') return send(200, signedIn && broken !== 'get-session' ? { user: { email: 'auth-runtime@example.com' } } : null)
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
;['otp-mail', 'get-session', 'blocked-domain', 'sign-out', 'rate-limit'].forEach((step, i) => {
  test(`a break in ${step} exits 1 and names the step`, () => {
    const r = run(['--app', fakeProject(), '--port', String(39560 + i * 2), '--allowed-domain', 'example.com'], { FAKE_BREAK: step })
    assert.equal(r.status, 1, r.stdout + r.stderr)
    assert.match(r.stderr, new RegExp(`step "${step}" failed`))
  })
})
