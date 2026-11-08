/** The team name createTeam derives from its owner (#279). */
import { describe, test, expect, jest } from '@jest/globals'

const mockQueryOneWithRLS = jest.fn<() => Promise<unknown>>()
const mockTxQuery = jest.fn(async (..._args: unknown[]) => [{ id: 'team-1' }])

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  queryOneWithRLS: mockQueryOneWithRLS,
  getServiceTransactionClient: jest.fn(async () => ({ query: mockTxQuery, commit: jest.fn(), rollback: jest.fn() })),
}))

import { createTeam } from '@/core/lib/teams/actions'

describe('createTeam', () => {
  test('a name without a last name leaves no stray space in the team name', async () => {
    jest.spyOn(console, 'log').mockImplementation(() => {})
    mockQueryOneWithRLS.mockResolvedValue({ id: 'u1', email: 'ada@example.test', name: 'Ada ' })
    await createTeam('u1')
    expect((mockTxQuery.mock.calls[0][1] as unknown[])[0]).toBe("Ada's Team")
  })
})
