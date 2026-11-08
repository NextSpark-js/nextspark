/**
 * verifyEmailPageUrl — a clicked verification link goes on to the app's
 * verify-email page, under the base path when the app has one. Next.js hands
 * the route handler the link's URL without the base path.
 */
import { verifyEmailPageUrl } from '@/core/lib/auth/verify-email-link'
import { magicLinkFailurePage } from '@/core/lib/auth/magic-link'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

describe('verifyEmailPageUrl', () => {
  test('sends the link to the verify-email page with its token and callbackURL', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    const page = verifyEmailPageUrl('http://localhost:3191/api/auth/verify-email?token=abc&callbackURL=%2F')
    expect(page).toBe('/verify-email?token=abc&callbackURL=%2F')
  })

  test('keeps the page under the base path', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    const page = verifyEmailPageUrl('http://localhost:3191/api/auth/verify-email?token=abc&callbackURL=%2F')
    expect(page).toBe('/base/verify-email?token=abc&callbackURL=%2F')
  })

  test('leaves out a callbackURL the link does not carry', () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    const page = verifyEmailPageUrl('http://localhost:3191/api/auth/verify-email?token=abc')
    expect(page).toBe('/base/verify-email?token=abc')
  })

  test('returns null for a link without a token', () => {
    expect(verifyEmailPageUrl('http://localhost:3191/api/auth/verify-email')).toBeNull()
  })
})

describe('magicLinkFailurePage', () => {
  const failure = (body: BodyInit | null, status = 403) => new Response(body, { status })

  test('a refusal goes to the error page, relative and under the base path', async () => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    const page = await magicLinkFailurePage(failure(JSON.stringify({ code: 'ACCOUNT_SUSPENDED' })))
    expect(page.status).toBe(302)
    expect(page.headers.get('location')).toBe('/base/auth-error?error=ACCOUNT_SUSPENDED')
  })

  test('a body that is not JSON gets the page without a code; anything under 400 passes through', async () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    expect((await magicLinkFailurePage(failure('oops', 500))).headers.get('location')).toBe('/auth-error')
    const redirect = new Response(null, { status: 302, headers: { location: '/dashboard' } })
    expect(await magicLinkFailurePage(redirect)).toBe(redirect)
  })
})
