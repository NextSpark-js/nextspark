/**
 * getDashboardTeamId — the team a dashboard request's permissions are checked in.
 */
jest.mock('@/core/lib/db', () => ({ queryOne: jest.fn() }))

// React's request cache as the server build has it: one call per distinct
// arguments. Each test below uses its own user so none reads another's answer.
jest.mock('react', () => ({
  ...jest.requireActual('react'),
  cache: (fn: (...args: unknown[]) => unknown) => {
    const results = new Map<string, unknown>()
    return (...args: unknown[]) => {
      const key = JSON.stringify(args)
      if (!results.has(key)) results.set(key, fn(...args))
      return results.get(key)
    }
  },
}))

import { queryOne } from '@/core/lib/db'
import { getDashboardTeamId } from '@/core/lib/teams/dashboard-team'

const mockQueryOne = queryOne as unknown as jest.Mock

beforeEach(() => mockQueryOne.mockReset())

describe('getDashboardTeamId', () => {
  test('asks for the chosen team among the teams the user still belongs to, falling back to the earliest joined', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-chosen' })

    expect(await getDashboardTeamId('user-1', 'team-chosen')).toBe('team-chosen')
    const [sql, params] = mockQueryOne.mock.calls[0]
    expect(params).toEqual(['user-1', 'team-chosen'])
    expect(sql).toMatch(/"deletedAt" IS NULL/)
    expect(sql).toMatch(/ORDER BY \(tm\."teamId" = \$2\) IS TRUE DESC, tm\."joinedAt" ASC/)
  })

  test('the answer, not the chosen id, is the team: a team the user left gives way to their default', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-default' })

    expect(await getDashboardTeamId('user-2', 'team-removed')).toBe('team-default')
  })

  test('without a chosen team, asks with none', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-default' })

    expect(await getDashboardTeamId('user-3', null)).toBe('team-default')
    expect(mockQueryOne.mock.calls[0][1]).toEqual(['user-3', null])
  })

  test('a user in no team has no team to check', async () => {
    mockQueryOne.mockResolvedValue(null)

    expect(await getDashboardTeamId('user-4', null)).toBeNull()
  })

  test('a failed query rejects instead of reading as a user in no team, whose permissions are not checked', async () => {
    mockQueryOne.mockRejectedValue(new Error('database unavailable'))

    await expect(getDashboardTeamId('user-5', null)).rejects.toThrow('database unavailable')
  })

  test('the dashboard layout and the entity layout under it share one query per request', async () => {
    mockQueryOne.mockResolvedValue({ teamId: 'team-default' })

    // Each layout asks on its own
    await getDashboardTeamId('user-6', 'team-default')
    await getDashboardTeamId('user-6', 'team-default')

    expect(mockQueryOne).toHaveBeenCalledTimes(1)
  })
})
