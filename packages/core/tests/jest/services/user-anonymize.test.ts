/**
 * UserService.anonymizeAccount: one service transaction anonymizes the user, deletes their sessions and credentials,
 * deactivates their API keys and removes their team memberships; the deactivated keys leave the key cache. While the
 * user owns a team nothing is written.
 */
const statements: string[] = []
const tx = {
  query: jest.fn(async (sql: string) => {
    statements.push(sql)
    return sql.includes('"api_key"') ? [{ keyHash: 'hash-1' }, { keyHash: 'hash-2' }] : []
  }),
  mutate: jest.fn(async (sql: string) => {
    statements.push(sql)
    return { rows: [], rowCount: 1 }
  }),
  commit: jest.fn(async () => {}),
  rollback: jest.fn(async () => {}),
}

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  getServiceTransactionClient: jest.fn(async () => tx),
}))
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: { getByOwnerId: jest.fn() } }))
jest.mock('@/core/lib/api/auth', () => ({ invalidateApiKeyCache: jest.fn() }))

import { UserService } from '@/core/lib/services/user.service'
import { TeamService } from '@/core/lib/services/team.service'
import { invalidateApiKeyCache } from '@/core/lib/api/auth'
import { mutateWithRLS } from '@/core/lib/db'

const getByOwnerId = TeamService.getByOwnerId as jest.Mock

describe('UserService.anonymizeAccount', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    statements.length = 0
  })

  it('deactivates the API keys and removes the team memberships in the same transaction as the anonymization', async () => {
    getByOwnerId.mockResolvedValue([])

    await UserService.anonymizeAccount('user-1')

    const joined = statements.join('\n')
    expect(joined).toMatch(/UPDATE "users"/)
    expect(joined).toMatch(/DELETE FROM "session"/)
    expect(joined).toMatch(/DELETE FROM "account"/)
    expect(joined).toMatch(/UPDATE "api_key" SET status = 'inactive'/)
    expect(joined).toMatch(/DELETE FROM "team_members" WHERE "userId" = \$1/)
    expect(tx.commit).toHaveBeenCalledTimes(1)
    expect(tx.rollback).not.toHaveBeenCalled()
    // nothing outside the transaction
    expect(mutateWithRLS).not.toHaveBeenCalled()
    expect(invalidateApiKeyCache).toHaveBeenCalledWith('hash-1')
    expect(invalidateApiKeyCache).toHaveBeenCalledWith('hash-2')
  })

  it('rolls everything back when a step fails, and keeps the keys cached as they are', async () => {
    getByOwnerId.mockResolvedValue([])
    tx.query.mockImplementationOnce(async () => [])
    tx.query.mockImplementationOnce(async () => { throw new Error('boom') })

    await expect(UserService.anonymizeAccount('user-1')).rejects.toThrow('boom')
    expect(tx.rollback).toHaveBeenCalledTimes(1)
    expect(tx.commit).not.toHaveBeenCalled()
    expect(invalidateApiKeyCache).not.toHaveBeenCalled()
  })

  it('writes nothing while the user owns a team', async () => {
    getByOwnerId.mockResolvedValue([{ id: 'team-1' }])

    await expect(UserService.anonymizeAccount('user-1')).rejects.toMatchObject({ code: 'OWNS_TEAMS' })
    expect(statements).toEqual([])
  })
})
