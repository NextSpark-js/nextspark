/**
 * GET /api/v1/devtools/docs authenticates like its devtools siblings (blocks, features, flows): no session or API key is a
 * 401, a role other than developer a 403 (superadmin included, as on the /devtools pages), and only then is the requested
 * path looked at.
 */
import { NextRequest } from 'next/server'

const authenticateRequest = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => authenticateRequest(...args),
  createAuthFailureResponse: () => new Response(JSON.stringify({ success: false }), { status: 401 }),
}))

import { GET } from '@/app/api/v1/devtools/docs/route'

const request = (query = '') => new NextRequest(`http://localhost/api/v1/devtools/docs${query}`)
const as = (role: string | null) =>
  authenticateRequest.mockResolvedValue(role ? { success: true, type: 'session', user: { id: 'u', role } } : { success: false, type: 'none', user: null })
const handler = GET as unknown as (request: NextRequest) => Promise<Response>

beforeEach(() => authenticateRequest.mockReset())

it('refuses a request without a session or API key before reading the path', async () => {
  as(null)
  const response = await handler(request('?path=api/x/docs.md'))
  expect(response.status).toBe(401)
  expect(authenticateRequest).toHaveBeenCalledWith(expect.anything(), { requiredScope: 'admin:devtools' })
})

it.each(['member', 'superadmin'])('refuses a %s', async role => {
  as(role)
  const response = await handler(request('?path=api/x/docs.md'))
  expect(response.status).toBe(403)
  expect((await response.json()).error.code).toBe('DEVTOOLS_ACCESS_DENIED')
})

it('lets a developer through to the path checks', async () => {
  as('developer')
  expect((await handler(request())).status).toBe(400)
  expect((await handler(request('?path=../etc/passwd.md'))).status).toBe(400)
})
