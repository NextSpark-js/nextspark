/**
 * Runs the registration steps of REGISTRATION_GATES_STEPS through core's real auth routes and Better Auth (no mocks),
 * and prints one `RESULT <json>` line per step. Only the providers' endpoints are stubbed: Google's and Apple's token
 * endpoints answer with an id token for the step's address, GitHub's and Discord's token and user API with the step's profile, and
 * a `send-code` step replaces the email provider with one that sends, answers { success: false } or throws.
 * Started by registration-gates.test.ts and social-providers.test.ts under tsx with this folder's tsconfig.
 */
import { createPrivateKey, createPublicKey, sign } from 'node:crypto'
import { createServer } from 'node:net'
import { NextRequest } from 'next/server'

type Step =
  | { op: 'password'; email: string; inviteToken?: string; name?: string; firstName?: string }
  | { op: 'otp'; email: string }
  | { op: 'google'; email: string; emailVerified?: boolean; name?: string }
  | { op: 'invite'; email: string; token: string }
  // emails: the /user/emails answer (none: no address at all)
  | { op: 'github'; email: string; emailVerified?: boolean; name?: string | null; noEmail?: boolean; id?: number }
  // Apple posts its answer back (form_post) with the name on the first consent only
  | { op: 'apple'; email: string; emailVerified?: boolean; firstName?: string; lastName?: string }
  // A provider enabled only through the auth.providers map: no readiness check, no button, no mapping of its own
  | { op: 'discord'; email: string; emailVerified?: boolean; id?: string }
  // A native app's Sign in with Apple: /sign-in/social with an id token signed by APPLE_PRIVATE_KEY (Apple's keys are stubbed with its public half)
  | { op: 'apple-id-token'; email: string; emailVerified: boolean }
  // POST /email-otp/send-verification-otp with an email provider that sends, fails or throws
  | { op: 'send-code'; email: string; type?: 'sign-in' | 'email-verification' | 'forget-password'; provider: 'ok' | 'fail' | 'throw' }
  // POST /sign-in/magic-link with a provider that sends, fails or throws, or (smtp) the real SMTP provider against a fake server; the link is kept per address
  | { op: 'magic-send'; email: string; provider: 'ok' | 'fail' | 'throw' | 'smtp'; callbackURL?: string }
  // Opens the address's kept link as a browser would; callbackURL rewrites it in the link
  | { op: 'magic-open'; email: string; callbackURL?: string; signupIntent?: string }
  | { op: 'wait'; email: string; ms: number }

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const authRoute = await import(new URL('routes/api/auth/[...all]/route.ts', CORE_SRC).href)
const inviteRoute = await import(new URL('routes/api/v1/auth/signup-with-invite/route.ts', CORE_SRC).href)
const { auth } = await import(new URL('lib/auth.ts', CORE_SRC).href)
const { EmailFactory } = await import(new URL('lib/email/factory.ts', CORE_SRC).href)

const ORIGIN = process.env.NEXT_PUBLIC_APP_URL!
const PASSWORD = 'correct-horse-battery-staple'

const json = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new NextRequest(`${ORIGIN}${path}`, { method: 'POST', headers: { 'content-type': 'application/json', origin: ORIGIN, ...headers }, body: JSON.stringify(body) })

async function outcome(res: Response) {
  const text = await res.text()
  let code: string | undefined
  try { code = JSON.parse(text)?.code ?? JSON.parse(text)?.error?.code } catch { /* not JSON */ }
  return { status: res.status, code, location: res.headers.get('location') ?? undefined }
}

// Google's token exchange: an unsigned id token for the address of the current step
let googleEmail = ''
let googleEmailVerified = true
let googleName = 'Google User'
let github: Extract<Step, { op: 'github' }> | null = null
let apple: Extract<Step, { op: 'apple' }> | null = null
// What Apple's token endpoint received as client_secret
let appleClientSecret: string | undefined
const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
const jsonResponse = (body: unknown) => new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json' } })
let discord: Extract<Step, { op: 'discord' }> | null = null
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  // the verification email of a password sign-up
  if (url.startsWith('https://api.resend.com/')) return jsonResponse({ id: 'stub-email' })
  if (url.startsWith('https://github.com/login/oauth/access_token')) {
    return jsonResponse({ access_token: 'stub-github-access', token_type: 'bearer', scope: 'read:user,user:email' })
  }
  if (url === 'https://api.github.com/user') {
    return jsonResponse({ id: github!.id ?? 4242, login: 'octo-user', name: github!.name === undefined ? 'Octo Cat User' : github!.name, email: null, avatar_url: 'https://avatars.example/octo' })
  }
  if (url === 'https://api.github.com/user/emails') {
    return jsonResponse(github!.noEmail ? [] : [{ email: github!.email, primary: true, verified: github!.emailVerified ?? true }])
  }
  if (url.startsWith('https://discord.com/api/oauth2/token')) {
    return jsonResponse({ access_token: 'stub-discord-access', token_type: 'Bearer', expires_in: 600, scope: 'identify email' })
  }
  if (url === 'https://discord.com/api/users/%40me') { // how Better Auth's fetch writes /users/@me
    return jsonResponse({ id: discord!.id ?? '80351110224678912', username: 'nelly', global_name: 'Nelly Bly', discriminator: '0', avatar: 'abc', email: discord!.email, verified: discord!.emailVerified ?? true })
  }
  if (url.startsWith('https://appleid.apple.com/auth/token')) {
    appleClientSecret = new URLSearchParams(String(init?.body ?? '')).get('client_secret') ?? undefined
    const now = Math.floor(Date.now() / 1000)
    const idToken = `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: `apple-${apple!.email}`, email: apple!.email, email_verified: apple!.emailVerified ?? true, is_private_email: apple!.email.endsWith('privaterelay.appleid.com'), iss: 'https://appleid.apple.com', aud: process.env.APPLE_CLIENT_ID, exp: now + 600, iat: now })}.`
    return jsonResponse({ access_token: 'stub-apple-access', id_token: idToken, token_type: 'Bearer', expires_in: 600 })
  }
  if (url === 'https://appleid.apple.com/auth/keys') {
    const jwk = createPublicKey(createPrivateKey(process.env.APPLE_PRIVATE_KEY!)).export({ format: 'jwk' })
    return jsonResponse({ keys: [{ ...jwk, kid: 'stub-apple-kid', alg: 'ES256', use: 'sig' }] })
  }
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const idToken = `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: `google-${googleEmail}`, email: googleEmail, email_verified: googleEmailVerified, name: googleName, iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) })}.`
    return new Response(JSON.stringify({ access_token: 'stub-access', id_token: idToken, token_type: 'Bearer', expires_in: 600, scope: 'openid email profile' }), { headers: { 'content-type': 'application/json' } })
  }
  return realFetch(input, init)
}) as typeof fetch

/** Starts the provider's sign-in and returns its state and the cookies the browser keeps. */
async function startSocial(provider: string) {
  // Next.js hands the routes URLs without the base path; the client's callbackURL carries it
  const start = await authRoute.POST(json('/api/auth/sign-in/social', { provider, callbackURL: `${process.env.__NEXT_ROUTER_BASEPATH ?? ''}/dashboard` }))
  const { url } = await start.json() as { url: string }
  return {
    authorizationUrl: url,
    state: new URL(url).searchParams.get('state')!,
    cookie: start.headers.getSetCookie().map(c => c.split(';')[0]).join('; '),
  }
}

const callbackGet = (url: string, cookie: string) =>
  authRoute.GET(new NextRequest(url, { headers: { cookie } }), { params: Promise.resolve({ all: ['callback', new URL(url).pathname.split('/').pop()!] }) })

// A minimal SMTP server, for the steps that go through the real provider: it keeps the text of each message
const smtpMessages: string[] = []
if (process.env.EMAIL_PROVIDER === 'smtp') {
  createServer((socket) => {
    let inData = false
    let data = ''
    let line = ''
    socket.write('220 fake\r\n')
    socket.on('error', () => {})
    socket.on('data', (chunk) => {
      if (inData) {
        data += chunk.toString()
        if (data.endsWith('\r\n.\r\n')) {
          inData = false
          smtpMessages.push(data)
          data = ''
          socket.write('250 ok\r\n')
        }
        return
      }
      line += chunk.toString()
      if (!line.endsWith('\r\n')) return
      const command = line.slice(0, 4).toUpperCase()
      line = ''
      if (command === 'DATA') {
        inData = true
        socket.write('354 go\r\n')
      } else if (command === 'QUIT') {
        socket.end('221 bye\r\n')
      } else {
        socket.write('250 ok\r\n')
      }
    })
  }).listen(Number(process.env.SMTP_PORT), '127.0.0.1')
}

/** The link of a sent message, whose body may be quoted-printable. */
const hrefIn = (message: string) => {
  const text = message.replace(/=\r\n/g, '').replace(/=([0-9A-F]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
  return /href="([^"]+)"/.exec(text)?.[1]
}

const magicLinks = new Map<string, string>()

async function run(step: Step) {
  switch (step.op) {
    case 'password': {
      const query = step.inviteToken ? `?inviteToken=${step.inviteToken}` : ''
      const headers: Record<string, string> = step.inviteToken ? { 'x-invite-token': step.inviteToken } : {}
      return outcome(await authRoute.POST(json(`/api/auth/sign-up/email${query}`, { email: step.email, password: PASSWORD, name: step.name ?? 'Password User', ...(step.firstName ? { firstName: step.firstName } : {}) }, headers)))
    }
    case 'otp': {
      // the stored sign-in code, as send-verification-otp writes it (Better Auth stores codes in plain text by default)
      const { internalAdapter } = await auth.$context
      await internalAdapter.createVerificationValue({ identifier: `sign-in-otp-${step.email}`, value: '123456:0', expiresAt: new Date(Date.now() + 300_000) })
      return outcome(await authRoute.POST(json('/api/auth/sign-in/email-otp', { email: step.email, otp: '123456' })))
    }
    case 'google': {
      googleEmail = step.email
      googleEmailVerified = step.emailVerified ?? true
      googleName = step.name ?? 'Google User'
      const start = await authRoute.POST(json('/api/auth/sign-in/social', { provider: 'google', callbackURL: '/dashboard' }))
      const { url } = await start.json() as { url: string }
      const state = new URL(url).searchParams.get('state')!
      const cookie = start.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
      const callback = new NextRequest(`${ORIGIN}/api/auth/callback/google?code=stub-code&state=${encodeURIComponent(state)}`, { headers: { cookie } })
      return outcome(await authRoute.GET(callback, { params: Promise.resolve({ all: ['callback', 'google'] }) }))
    }
    case 'github': {
      github = step
      const { state, cookie, authorizationUrl } = await startSocial('github')
      const result = await outcome(await callbackGet(`${ORIGIN}/api/auth/callback/github?code=stub-code&state=${encodeURIComponent(state)}`, cookie))
      return { ...result, redirectUri: new URL(authorizationUrl).searchParams.get('redirect_uri') }
    }
    case 'discord': {
      discord = step
      const { state, cookie } = await startSocial('discord')
      return outcome(await callbackGet(`${ORIGIN}/api/auth/callback/discord?code=stub-code&state=${encodeURIComponent(state)}`, cookie))
    }
    case 'apple': {
      apple = step
      appleClientSecret = undefined
      const { state, cookie, authorizationUrl } = await startSocial('apple')
      const responseMode = new URL(authorizationUrl).searchParams.get('response_mode')
      // Apple's form_post: a cross-site POST, so the browser sends none of the lax cookies
      const form = new URLSearchParams({ code: 'stub-code', state })
      if (step.firstName) form.set('user', JSON.stringify({ name: { firstName: step.firstName, lastName: step.lastName ?? '' }, email: step.email }))
      const posted = await authRoute.POST(new NextRequest(`${ORIGIN}/api/auth/callback/apple`, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded', origin: 'https://appleid.apple.com' },
        body: form.toString(),
      }))
      const redirect = posted.headers.get('location') ?? ''
      // then the top-level GET it redirects to, which carries them
      const result = await outcome(await callbackGet(redirect, cookie))
      return { ...result, responseMode, postStatus: posted.status, postLocation: redirect, appleClientSecret }
    }
    case 'apple-id-token': {
      const now = Math.floor(Date.now() / 1000)
      const input = `${part({ alg: 'ES256', kid: 'stub-apple-kid', typ: 'JWT' })}.${part({ iss: 'https://appleid.apple.com', aud: process.env.APPLE_CLIENT_ID, sub: `apple-native-${step.email}`, email: step.email, email_verified: step.emailVerified, iat: now, exp: now + 600 })}`
      const signature = sign('sha256', Buffer.from(input), { key: createPrivateKey(process.env.APPLE_PRIVATE_KEY!), dsaEncoding: 'ieee-p1363' }).toString('base64url')
      const res = await authRoute.POST(json('/api/auth/sign-in/social', { provider: 'apple', idToken: { token: `${input}.${signature}` } }))
      const text = await res.clone().text()
      return { ...(await outcome(res)), body: text.slice(0, 300), setsSession: res.headers.getSetCookie().some(c => c.includes('session_token')) }
    }
    case 'send-code': {
      let sends = 0
      const provider = step.provider
      EmailFactory.create = () => ({
        send: async () => {
          sends++
          if (provider === 'throw') throw new Error('stub provider detail: connection reset')
          return provider === 'ok' ? { id: 'stub', success: true } : { id: '', success: false, error: 'stub provider detail: domain not verified' }
        },
        verify: async () => true,
      })
      const res = await authRoute.POST(json('/api/auth/email-otp/send-verification-otp', { email: step.email, type: step.type ?? 'sign-in' }))
      const body = await res.clone().text()
      // a send handed to the background (a verification or reset code) settles after the response
      await new Promise(resolve => setTimeout(resolve, 200))
      return { ...(await outcome(res)), body, sends }
    }
    case 'magic-send': {
      let sends = 0
      const { provider, email } = step
      if (provider !== 'smtp') {
        EmailFactory.create = () => ({
          send: async (message: { html: string }) => {
            sends++
            if (provider === 'throw') throw new Error('stub provider detail: connection reset')
            if (provider === 'fail') return { id: '', success: false, error: 'stub provider detail: domain not verified' }
            magicLinks.set(email, hrefIn(message.html)!)
            return { id: 'stub', success: true }
          },
          verify: async () => true,
        })
      }
      const before = smtpMessages.length
      const res = await authRoute.POST(json('/api/auth/sign-in/magic-link', { email, callbackURL: step.callbackURL ?? '/dashboard', errorCallbackURL: '/auth-error' }))
      const body = await res.clone().text()
      if (provider === 'smtp' && smtpMessages.length > before) {
        sends = smtpMessages.length - before
        magicLinks.set(email, hrefIn(smtpMessages.at(-1)!)!)
      }
      return { ...(await outcome(res)), body, sends, link: magicLinks.get(email) }
    }
    case 'magic-open': {
      const link = new URL(magicLinks.get(step.email)!)
      if (step.callbackURL) link.searchParams.set('callbackURL', step.callbackURL)
      const res = await callbackGet(link.href, step.signupIntent ? `signup-intent=${step.signupIntent}` : '')
      return { ...(await outcome(res)), setsSession: res.headers.getSetCookie().some(c => c.includes('session_token')) }
    }
    case 'wait':
      await new Promise(resolve => setTimeout(resolve, step.ms))
      return { status: 0 }
    case 'invite':
      return outcome(await inviteRoute.POST(json('/api/v1/auth/signup-with-invite', { email: step.email, password: PASSWORD, firstName: 'Invited', inviteToken: step.token })))
  }
}

for (const step of JSON.parse(process.env.REGISTRATION_GATES_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ ...step, ...(await run(step)) })}`)
}
process.exit(0)
