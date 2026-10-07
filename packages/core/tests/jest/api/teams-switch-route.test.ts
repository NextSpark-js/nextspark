/**
 * POST /api/v1/teams/switch: a body that is empty or cut off (the browser aborts the request when the page
 * navigates away mid-flight) is a 400 the caller can read, not a 500 with a stack trace in the server log.
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ success: true, type: 'session', sessionId: 'session-1', user: { id: 'user-1' } }),
  createAuthFailureResponse: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
const switchActive = jest.fn().mockResolvedValue(undefined)
jest.mock('@nextsparkjs/core/lib/services', () => ({ TeamService: { switchActive: (...args: unknown[]) => switchActive(...args) } }))

import { POST } from '../../../src/routes/api/v1/teams/switch/route'

const post = (body?: string) =>
  POST(new NextRequest('http://localhost:3000/api/v1/teams/switch', { method: 'POST', headers: { 'content-type': 'application/json' }, body }), undefined as never)

describe('POST /api/v1/teams/switch', () => {
  beforeEach(() => {
    switchActive.mockClear()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
  })
  afterEach(() => jest.restoreAllMocks())

  it('answers 400 INVALID_JSON for a body cut off mid-way, without logging an error', async () => {
    const response = await post('{"teamI')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_JSON' })
    expect(console.error).not.toHaveBeenCalled()
    expect(switchActive).not.toHaveBeenCalled()
  })

  it('answers 400 INVALID_JSON for a body with no JSON in it, without logging an error', async () => {
    // Node's Request.json() throws on an empty body; Jest's NextRequest only throws on a blank one
    const response = await post(' ')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ code: 'INVALID_JSON' })
    expect(console.error).not.toHaveBeenCalled()
    expect(switchActive).not.toHaveBeenCalled()
  })

  it('still switches the team for a valid body', async () => {
    const response = await post(JSON.stringify({ teamId: 'team-1' }))
    expect(response.status).toBe(200)
    expect(switchActive).toHaveBeenCalledWith('user-1', 'team-1')
  })
})
