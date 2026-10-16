/**
 * /signup sends people to /login in three cases (passwordless preset, invitation-only after the
 * bootstrap, domain-restricted). The redirect keeps the invitation context (callbackUrl, fromInvite,
 * email) so the invited person returns to /accept-invite/<token>; callbackUrl only as a same-site path.
 */
const redirect = jest.fn((url: string) => {
  throw new Error(`NEXT_REDIRECT:${url}`)
})
const isBootstrapDone = jest.fn()
const authConfig: { registration: { mode: string }; methods?: string[] } = { registration: { mode: 'open' } }

jest.mock('next/navigation', () => ({ redirect: (url: string) => redirect(url) }))
jest.mock('@nextsparkjs/core/components/auth/forms/SignupForm', () => ({ SignupForm: () => null }))
jest.mock('@nextsparkjs/core/lib/config', () => ({ AUTH_CONFIG: authConfig }))
jest.mock('@nextsparkjs/core/lib/services', () => ({ TeamService: { isBootstrapDone: () => isBootstrapDone() } }))

import SignupPage from '../../../src/routes/(auth)/signup/page'

const invite = {
  callbackUrl: '/accept-invite/tok123',
  fromInvite: 'true',
  email: 'a@b.c',
  inviteToken: 'tok123',
}
const kept = '/login?callbackUrl=%2Faccept-invite%2Ftok123&fromInvite=true&email=a%40b.c'

const redirectedTo = async (params?: Record<string, string>) => {
  await expect(SignupPage({ searchParams: Promise.resolve(params ?? {}) })).rejects.toThrow('NEXT_REDIRECT')
  return redirect.mock.calls[0][0]
}

beforeEach(() => {
  redirect.mockClear()
  isBootstrapDone.mockResolvedValue(true)
  authConfig.registration.mode = 'open'
  authConfig.methods = ['email-password']
})

describe.each([
  ['invitation-only after the bootstrap', () => { authConfig.registration.mode = 'invitation-only' }],
  ['domain-restricted', () => { authConfig.registration.mode = 'domain-restricted' }],
  ['passwordless preset without an invite token', () => { authConfig.methods = ['email-otp'] }],
])('%s', (_name, setup) => {
  beforeEach(setup)
  const { inviteToken, ...noToken } = invite

  test('keeps callbackUrl, fromInvite and email, and not inviteToken', async () => {
    expect(await redirectedTo(noToken)).toBe(kept)
  })

  test.each(['https://evil.example/x', '//evil.example/x'])('drops callbackUrl %s', async (callbackUrl) => {
    expect(await redirectedTo({ ...noToken, callbackUrl })).toBe('/login?fromInvite=true&email=a%40b.c')
  })

  test('no query in, no query out', async () => {
    expect(await redirectedTo()).toBe('/login')
  })
})

// What accept-invite sends: the real #263 case. inviteToken skips the passwordless check, so the
// invitation-only redirect is the one that runs; the default methods are the passwordless preset.
test('invitation-only after the bootstrap, with the invite token: keeps the invitation, not the token', async () => {
  authConfig.registration.mode = 'invitation-only'
  delete authConfig.methods
  expect(await redirectedTo(invite)).toBe(kept)
})

test('domain-restricted, with the invite token: keeps the invitation, not the token', async () => {
  authConfig.registration.mode = 'domain-restricted'
  expect(await redirectedTo(invite)).toBe(kept)
})

test('invitation-only before the bootstrap: renders the form, no redirect', async () => {
  authConfig.registration.mode = 'invitation-only'
  isBootstrapDone.mockResolvedValue(false)
  expect(await SignupPage({ searchParams: Promise.resolve(invite) })).toBeTruthy()
  expect(redirect).not.toHaveBeenCalled()
})
