#!/usr/bin/env node
/**
 * Auth check of a built NextSpark starter, on the real Better Auth.
 *
 * Core's Jest maps `better-auth` to a mock, so a Better Auth upgrade can break every auth request with every suite
 * green. This starts the built project (`next start`) with a local stand-in for the Resend API, as axe-scan does, and
 * walks the auth flow over HTTP:
 *
 *   otp-send      POST /api/auth/email-otp/send-verification-otp answers 200
 *   otp-mail      the sign-in code reaches the stand-in mailbox (polled: core sends it after answering)
 *   otp-verify    POST /api/auth/sign-in/email-otp with that code answers 200 and sets a session cookie
 *   get-session   GET /api/auth/get-session (database read) returns that user
 *   blocked-domain  with --allowed-domain: a code for another domain answers 403 DOMAIN_NOT_ALLOWED and sends no mail
 *   sign-out      POST /api/auth/sign-out answers 200 and the old cookie then reads no session
 *   rate-limit    the code send answers 429 within a few calls (DISABLE_RATE_LIMITING is removed from the environment)
 *
 *   node scripts/auth/auth-runtime-check.mjs --app <built project dir> [--port 3970] [--allowed-domain example.com]
 *        [--request-timeout 30000]
 *
 * The project needs a migrated database (DATABASE_URL in its .env) and a production build made with
 * NEXTSPARK_AUTH_RUNTIME_ONLY=email,google. --allowed-domain is the project's `auth.registration.allowedDomains`
 * entry under `mode: 'domain-open'`; without it the blocked-domain step is skipped and says so.
 * A request that fails or gets no answer within --request-timeout (ms) fails the step it belongs to.
 * Exit 0 all steps passed, 1 a step failed (the message names it), 2 usage or environment error.
 */
import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import { startFakeResend, waitFor, waitForMail } from '../accessibility/axe-scan.mjs'

/** A failed check. `step` names it in the message the run ends with. */
export class StepError extends Error {
  constructor(step, message) {
    super(`step "${step}" failed: ${message}`)
    this.step = step
  }
}

/** The six-digit sign-in code at the start of a mail subject, or undefined. */
export function otpFromMail(mail) {
  return /^(\d{6})\b/.exec(mail?.subject ?? '')?.[1]
}

/** `jar` (name -> value) after the Set-Cookie headers of one response: an empty value or Max-Age=0 removes the cookie. */
export function updateJar(jar, setCookies) {
  for (const cookie of setCookies) {
    const [pair] = cookie.split(';')
    const i = pair.indexOf('=')
    const name = pair.slice(0, i)
    const value = pair.slice(i + 1)
    if (value === '' || /max-age=0/i.test(cookie)) jar.delete(name)
    else jar.set(name, value)
  }
  return jar
}

export const cookieHeader = (jar) => [...jar].map(([k, v]) => `${k}=${v}`).join('; ')

async function main() {
  const { values } = parseArgs({
    options: { app: { type: 'string' }, port: { type: 'string', default: '3970' }, 'allowed-domain': { type: 'string' }, 'request-timeout': { type: 'string', default: '30000' } },
  })
  if (!values.app) {
    console.error('usage: auth-runtime-check.mjs --app <built project dir> [--port 3970] [--allowed-domain example.com]')
    process.exit(2)
  }
  const port = Number(values.port)
  const resendPort = port + 1
  const requestTimeout = Number(values['request-timeout'])
  const origin = `http://localhost:${port}`
  const api = `http://127.0.0.1:${port}`
  const allowed = values['allowed-domain']
  const email = `auth-runtime@${allowed ?? 'example.com'}`

  let resend, serverProc
  let serverLog = ''
  try {
    resend = await startFakeResend(resendPort)
    const app = path.resolve(values.app)
    const nextBin = path.join(app, 'node_modules/next/dist/bin/next')
    if (!existsSync(nextBin)) throw new Error(`${nextBin} not found: --app must be an installed, built project`)
    // The rate limiter stays on: whatever the caller exported is dropped
    const { DISABLE_RATE_LIMITING: _off, ...env } = process.env
    serverProc = spawn(process.execPath, [nextBin, 'start', '-H', '127.0.0.1', '-p', String(port)], {
      cwd: app,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...env,
        NODE_ENV: 'production',
        BETTER_AUTH_URL: origin,
        NEXT_PUBLIC_APP_URL: origin,
        NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,google',
        RESEND_API_KEY: 're_authruntimeauthruntimeauthruntime',
        EMAIL_FROM: 'noreply@example.com',
        RESEND_BASE_URL: `http://127.0.0.1:${resendPort}`,
      },
    })
    serverProc.stdout.on('data', (c) => (serverLog += c))
    serverProc.stderr.on('data', (c) => (serverLog += c))
    if (!(await waitFor(`${api}/login`, 120_000))) throw new Error('the project did not start')

    // The step running now: a request that fails or hangs is that step's failure (exit 1), not an environment error
    let step = 'otp-send'
    const call = async (method, route, { body, jar } = {}) => {
      let res, text
      try {
        res = await fetch(api + route, {
          method,
          redirect: 'manual',
          headers: { origin, ...(body ? { 'content-type': 'application/json' } : {}), ...(jar?.size ? { cookie: cookieHeader(jar) } : {}) },
          body: body ? JSON.stringify(body) : undefined,
          signal: AbortSignal.timeout(requestTimeout),
        })
        text = await res.text()
      } catch (e) {
        throw new StepError(step, `${method} ${route} got no answer within ${requestTimeout} ms: ${e.cause?.code ?? e.message} (did the server crash or hang?)`)
      }
      let json = null
      try { json = JSON.parse(text) } catch { /* not JSON */ }
      return { status: res.status, json, setCookies: res.headers.getSetCookie() }
    }
    const sendCode = (to) => call('POST', '/api/auth/email-otp/send-verification-otp', { body: { email: to, type: 'sign-in' } })
    // A get-session body carries the session token: it never goes into a message
    const seen = (r) => `${r.status} ${JSON.stringify(r.json, (k, v) => (k === 'token' ? '[redacted]' : v))?.slice(0, 200)}`
    const expect = (step, ok, what) => { if (!ok) throw new StepError(step, what) }
    const ran = []
    const done = (step, note = '') => { ran.push(step); console.log(`auth-runtime: ok   ${step}${note ? ` (${note})` : ''}`) }

    const jar = new Map()
    const before = resend.mails.length
    const send = await sendCode(email)
    expect('otp-send', send.status === 200, `the code send answered ${seen(send)}, expected 200`)
    done('otp-send')

    step = 'otp-mail'
    const mail = await waitForMail(resend.mails, email, { from: before })
    expect('otp-mail', mail, 'no mail to the user reached the stand-in Resend within 15 s')
    const otp = otpFromMail(mail)
    expect('otp-mail', otp, `the mail to the user has no six-digit code in its subject ("${String(mail.subject).slice(0, 60)}")`)
    done('otp-mail')

    step = 'otp-verify'
    const signIn = await call('POST', '/api/auth/sign-in/email-otp', { body: { email, otp }, jar })
    updateJar(jar, signIn.setCookies)
    expect('otp-verify', signIn.status === 200, `sign-in with the code answered ${seen(signIn)}, expected 200`)
    expect('otp-verify', [...jar.keys()].some((n) => n.endsWith('better-auth.session_token')), 'no session_token cookie was set')
    done('otp-verify')

    // disableCookieCache: the session is read from the database, not from the signed cookie
    step = 'get-session'
    const session = await call('GET', '/api/auth/get-session?disableCookieCache=true', { jar })
    expect('get-session', session.status === 200 && session.json?.user?.email === email, `get-session answered ${seen(session)}, expected the signed-in user`)
    done('get-session')

    if (allowed) {
      step = 'blocked-domain'
      const blockedMails = resend.mails.length
      const blocked = await sendCode('someone@blocked.test')
      expect('blocked-domain', blocked.status === 403 && blocked.json?.code === 'DOMAIN_NOT_ALLOWED', `a code for a domain outside allowedDomains answered ${seen(blocked)}, expected 403 DOMAIN_NOT_ALLOWED`)
      await new Promise((r) => setTimeout(r, 1500)) // mail is sent after the answer: give it time to show up
      expect('blocked-domain', resend.mails.length === blockedMails, `${resend.mails.length - blockedMails} mail(s) were sent for the blocked domain, expected none`)
      done('blocked-domain')
    } else {
      console.log('auth-runtime: skip blocked-domain (no --allowed-domain: the project is not in domain-open mode)')
    }

    step = 'sign-out'
    const out = await call('POST', '/api/auth/sign-out', { body: {}, jar })
    expect('sign-out', out.status === 200, `sign-out answered ${seen(out)}, expected 200`)
    // The cookie from before the sign-out must read no session: the server ended it, not just the browser's copy
    const gone = await call('GET', '/api/auth/get-session?disableCookieCache=true', { jar })
    expect('sign-out', gone.status === 200 && gone.json === null, `the old cookie still reads a session after sign-out: ${seen(gone)}`)
    done('sign-out')

    // Other steps already sent to the same address: the limit is reached within a couple of calls
    step = 'rate-limit'
    const statuses = []
    for (let i = 0; i < 7 && !statuses.includes(429); i++) statuses.push((await sendCode(`limits@${allowed ?? 'example.com'}`)).status)
    expect('rate-limit', statuses.includes(429), `7 code sends answered ${statuses.join(',')}, expected a 429`)
    done('rate-limit', statuses.join(','))
    console.log(`auth-runtime: ${ran.length} step(s) passed`)
  } catch (error) {
    const isStep = error instanceof StepError
    console.error(`auth-runtime: ${error.message}${serverLog ? `\n--- server log ---\n${serverLog.slice(-3000)}` : ''}`)
    process.exitCode = isStep ? 1 : 2
  } finally {
    serverProc?.kill()
    resend?.server.close()
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await main().catch((error) => {
    console.error(`auth-runtime: ${error.message}`)
    process.exitCode = 2
  })
}
