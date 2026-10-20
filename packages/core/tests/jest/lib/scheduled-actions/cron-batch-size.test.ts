/**
 * The cron route processes scheduledActions.batchSize actions per run, not a fixed number (#313).
 * The processor is real; only the database and the config are mocked.
 */
import { NextRequest } from 'next/server'
import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { GET } from '../../../../src/routes/api/v1/cron/process/route'

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn().mockResolvedValue([]),
  mutateWithRLS: jest.fn().mockResolvedValue({ rowCount: 0, rows: [] }),
}))

jest.mock('@/core/lib/config', () => ({
  APP_CONFIG_MERGED: { scheduledActions: { batchSize: 25, defaultTimeout: 30000, concurrencyLimit: 1 } },
}))

describe('GET /api/v1/cron/process batch size', () => {
  const saved = process.env.CRON_SECRET
  beforeEach(() => {
    process.env.CRON_SECRET = 'a-cron-secret-of-reasonable-length'
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
    process.env.CRON_SECRET = saved
  })

  it('fetches scheduledActions.batchSize (25) actions', async () => {
    const response = await GET(new NextRequest('http://localhost:3000/api/v1/cron/process', {
      headers: { 'x-cron-secret': 'a-cron-secret-of-reasonable-length' },
    }))
    expect(response.status).toBe(200)
    expect((queryWithRLS as jest.Mock).mock.calls[0][1][0]).toBe(25)
    expect(mutateWithRLS).toHaveBeenCalled() // cleanup ran too, so the whole route went through
  })
})
