/**
 * Runs the registration steps of REGISTRATION_GATES_STEPS through core's real auth routes and Better Auth (no mocks),
 * and prints one `RESULT <json>` line per step. Only Google's token endpoint is stubbed: it answers with an id token
 * for the step's address. Started by registration-gates.test.ts under tsx with this folder's tsconfig.
 */
import { NextRequest } from 'next/server'

type Step =
  | { op: 'password'; email: string; inviteToken?: string }
  | { op: 'otp'; email: string }
  | { op: 'google'; email: string; emailVerified?: boolean }
  | { op: 'invite'; email: string; token: string }

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const authRoute = await import(new URL('routes/api/auth/[...all]/route.ts', CORE_SRC).href)
const inviteRoute = await import(new URL('routes/api/v1/auth/signup-with-invite/route.ts', CORE_SRC).href)
const { auth } = await import(new URL('lib/auth.ts', CORE_SRC).href)

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
const realFetch = globalThis.fetch
globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
  const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
  if (url.startsWith('https://oauth2.googleapis.com/token')) {
    const part = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url')
    const idToken = `${part({ alg: 'none', typ: 'JWT' })}.${part({ sub: `google-${googleEmail}`, email: googleEmail, email_verified: googleEmailVerified, name: 'Google User', iss: 'https://accounts.google.com', aud: process.env.GOOGLE_CLIENT_ID, exp: Math.floor(Date.now() / 1000) + 600, iat: Math.floor(Date.now() / 1000) })}.`
    return new Response(JSON.stringify({ access_token: 'stub-access', id_token: idToken, token_type: 'Bearer', expires_in: 600, scope: 'openid email profile' }), { headers: { 'content-type': 'application/json' } })
  }
  return realFetch(input, init)
}) as typeof fetch

async function run(step: Step) {
  switch (step.op) {
    case 'password': {
      const query = step.inviteToken ? `?inviteToken=${step.inviteToken}` : ''
      const headers: Record<string, string> = step.inviteToken ? { 'x-invite-token': step.inviteToken } : {}
      return outcome(await authRoute.POST(json(`/api/auth/sign-up/email${query}`, { email: step.email, password: PASSWORD, name: 'Password User' }, headers)))
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
      const start = await authRoute.POST(json('/api/auth/sign-in/social', { provider: 'google', callbackURL: '/dashboard' }))
      const { url } = await start.json() as { url: string }
      const state = new URL(url).searchParams.get('state')!
      const cookie = start.headers.getSetCookie().map(c => c.split(';')[0]).join('; ')
      const callback = new NextRequest(`${ORIGIN}/api/auth/callback/google?code=stub-code&state=${encodeURIComponent(state)}`, { headers: { cookie } })
      return outcome(await authRoute.GET(callback, { params: Promise.resolve({ all: ['callback', 'google'] }) }))
    }
    case 'invite':
      return outcome(await inviteRoute.POST(json('/api/v1/auth/signup-with-invite', { email: step.email, password: PASSWORD, firstName: 'Invited', inviteToken: step.token })))
  }
}

for (const step of JSON.parse(process.env.REGISTRATION_GATES_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ ...step, ...(await run(step)) })}`)
}
process.exit(0)
