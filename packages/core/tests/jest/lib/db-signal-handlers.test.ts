/**
 * The SIGTERM/SIGINT listeners lib/db.ts installs close the pools and then hand the signal back: a listener
 * disables Node's default exit, and a `next build` static-generation worker that got SIGTERM would otherwise
 * never end (orphaned, ppid 1). `next start` keeps its own listener, which decides.
 */
jest.mock('pg', () => ({
  Pool: jest.fn(() => ({
    connect: jest.fn(), query: jest.fn(), end: jest.fn().mockResolvedValue(undefined), on: jest.fn(),
    options: { max: 20 }, totalCount: 0, idleCount: 0, waitingCount: 0,
  })),
}))
jest.mock('@/core/lib/api/helpers', () => ({ isValidUUID: () => true }))

describe('db signal handlers', () => {
  let kill: jest.SpyInstance
  beforeEach(() => {
    jest.resetModules()
    kill = jest.spyOn(process, 'kill').mockImplementation(() => true)
    jest.spyOn(console, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => {
    jest.restoreAllMocks()
  })

  it('closes the database, drops its listener and re-raises the signal when nobody else listens', async () => {
    const { createSignalHandler } = await import('../../../src/lib/db')
    const handler = createSignalHandler('SIGTERM')
    process.on('SIGTERM', handler)
    const others = process.listeners('SIGTERM').filter((l) => l !== handler)
    others.forEach((l) => process.removeListener('SIGTERM', l))
    try {
      await handler()
      expect(process.listeners('SIGTERM')).not.toContain(handler)
      expect(kill).toHaveBeenCalledWith(process.pid, 'SIGTERM')
    } finally {
      others.forEach((l) => process.on('SIGTERM', l as () => void))
    }
  })

  it('leaves the exit to another listener (as next start has) and does not re-raise', async () => {
    const { createSignalHandler } = await import('../../../src/lib/db')
    const handler = createSignalHandler('SIGINT')
    const other = jest.fn()
    process.on('SIGINT', handler)
    process.on('SIGINT', other)
    try {
      await handler()
      expect(kill).not.toHaveBeenCalled()
      expect(process.listeners('SIGINT')).toContain(other)
    } finally {
      process.removeListener('SIGINT', other)
    }
  })
})
