/**
 * GET /api/v1/cron/process reads request.headers: under Cache Components the prerender interrupts the route right
 * there. The catch around the processing used to answer that interruption with a 500 and log it as a processing
 * error; Next has to see it (unstable_rethrow), while every real error still answers 500.
 */
import { NextRequest } from 'next/server'

const processPendingActions = jest.fn()
jest.mock('@nextsparkjs/core/lib/scheduled-actions', () => ({
  processPendingActions: (...args: unknown[]) => processPendingActions(...args),
  cleanupOldActions: jest.fn().mockResolvedValue(0),
}))

import { GET } from '../../../src/routes/api/v1/cron/process/route'

// What Next throws when dynamic data is read while prerendering
const interruption = () => Object.assign(new Error('Dynamic server usage: request.headers'), { digest: 'DYNAMIC_SERVER_USAGE' })

describe('GET /api/v1/cron/process', () => {
  const secret = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = 'cron-secret'
    processPendingActions.mockReset()
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    process.env.CRON_SECRET = secret
  })

  it("lets Next's prerender interruption through instead of answering 500", async () => {
    const request = new NextRequest('http://localhost:3000/api/v1/cron/process')
    Object.defineProperty(request, 'headers', { get: () => { throw interruption() } })
    await expect(GET(request)).rejects.toMatchObject({ digest: 'DYNAMIC_SERVER_USAGE' })
    expect(console.error).not.toHaveBeenCalled()
  })

  it('still answers 500 when processing fails', async () => {
    processPendingActions.mockRejectedValue(new Error('database down'))
    const response = await GET(new NextRequest('http://localhost:3000/api/v1/cron/process', { headers: { 'x-cron-secret': 'cron-secret' } }))
    expect(response.status).toBe(500)
    expect(await response.json()).toMatchObject({ code: 'PROCESSING_ERROR' })
  })
})

describe('withRateLimit (legacy wrapper)', () => {
  it("lets Next's prerender interruption through instead of running the handler without rate limiting", async () => {
    const { withRateLimit } = await import('../../../src/lib/api/rate-limit')
    const handler = jest.fn().mockResolvedValue(new Response('ok'))
    const request = new NextRequest('http://localhost:3000/api/x')
    Object.defineProperty(request, 'headers', { get: () => { throw interruption() } })
    await expect(withRateLimit(handler as never)(request)).rejects.toMatchObject({ digest: 'DYNAMIC_SERVER_USAGE' })
    expect(handler).not.toHaveBeenCalled()
  })

  it('still runs the handler when rate limiting itself fails', async () => {
    const { withRateLimit } = await import('../../../src/lib/api/rate-limit')
    const handler = jest.fn().mockResolvedValue(new Response('ok'))
    const request = new NextRequest('http://localhost:3000/api/x')
    Object.defineProperty(request, 'headers', { get: () => { throw new Error('boom') } })
    jest.spyOn(console, 'error').mockImplementation(() => undefined)
    await withRateLimit(handler as never)(request)
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
