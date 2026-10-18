/**
 * AmplitudeCore.setOptOut: while opted out nothing is tracked and the queued events are discarded.
 */
const mockQueue = { enqueue: jest.fn().mockResolvedValue('id'), clear: jest.fn(), shutdown: jest.fn() }
jest.mock('../../../../../plugins/amplitude/lib/queue', () => ({ EventQueue: jest.fn(() => mockQueue) }))
jest.mock('../../../../../plugins/amplitude/lib/performance', () => ({ trackPerformanceMetric: jest.fn(), getPerformanceMetrics: jest.fn(() => []) }))
jest.mock('../../../../../plugins/amplitude/lib/security', () => ({
  DataSanitizer: { sanitizeEventProperties: (p: unknown) => p, sanitizeUserProperties: (p: unknown) => p },
}))

import { AmplitudeCore } from '../../../../../plugins/amplitude/lib/amplitude-core'

const apiKey = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6' as never
const config = { apiKey, piiMaskingEnabled: false } as never

beforeEach(async () => {
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.clearAllMocks()
  AmplitudeCore.shutdown()
  await AmplitudeCore.init(apiKey, config)
})
afterEach(() => {
  AmplitudeCore.shutdown()
  jest.restoreAllMocks()
})

describe('AmplitudeCore.setOptOut', () => {
  it('tracks while opted in', async () => {
    await AmplitudeCore.track('signed_up' as never)
    expect(mockQueue.enqueue).toHaveBeenCalledTimes(1)
  })

  it('drops track calls and discards the queue while opted out, and resumes when opted back in', async () => {
    AmplitudeCore.setOptOut(true)
    expect(AmplitudeCore.isOptedOut()).toBe(true)
    expect(mockQueue.clear).toHaveBeenCalledTimes(1)
    await AmplitudeCore.track('signed_up' as never)
    await AmplitudeCore.identify('user-1' as never)
    await AmplitudeCore.setUserProperties({ plan: 'pro' } as never)
    expect(mockQueue.enqueue).not.toHaveBeenCalled()

    AmplitudeCore.setOptOut(false)
    await AmplitudeCore.track('signed_up' as never)
    expect(mockQueue.enqueue).toHaveBeenCalledTimes(1)
  })
})
