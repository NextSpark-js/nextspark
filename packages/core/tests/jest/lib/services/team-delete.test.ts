/**
 * Team deletion lifecycle (#314): soft delete, revoked access, hooks, purge after the retention.
 */
const mockQueryOneWithRLS = jest.fn()
const mockQueryWithRLS = jest.fn()
const mockMutateWithRLS = jest.fn()
const mockTx = { query: jest.fn(), queryOne: jest.fn(), mutate: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
const mockScheduleAction = jest.fn()
const mockTeamsConfig: { options?: { deletedRetentionDays?: unknown } } = {}

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: (...args: unknown[]) => mockQueryOneWithRLS(...args),
  queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
  getServiceTransactionClient: async () => mockTx,
}))
jest.mock('@/core/lib/config', () => ({ TEAMS_CONFIG: mockTeamsConfig }))
jest.mock('@/core/lib/scheduled-actions/scheduler', () => ({
  scheduleAction: (...args: unknown[]) => mockScheduleAction(...args),
}))

import { getGlobalHooks } from '@/core/lib/plugins/hook-system'
import {
  TeamService,
  TeamDeleteVetoedError,
  TEAM_BEFORE_DELETE_HOOK,
  TEAM_DELETED_HOOK,
  PURGE_DELETED_TEAMS_ACTION,
} from '@/core/lib/services/team.service'
import { getActionHandler, clearActionRegistry } from '@/core/lib/scheduled-actions/registry'
import { registerCoreHandlers } from '@/core/lib/scheduled-actions/handlers'

const team = { id: 'team-1', ownerId: 'owner-1', name: 'Acme' }
const sqlOf = (mock: jest.Mock) => mock.mock.calls.map(([text]) => String(text)).join('\n')

beforeEach(() => {
  jest.clearAllMocks()
  delete mockTeamsConfig.options
  mockQueryOneWithRLS.mockResolvedValue(team)
  mockTx.mutate.mockResolvedValue({ rowCount: 1 })
  mockTx.query.mockResolvedValue([])
  mockScheduleAction.mockResolvedValue('action-1')
  getGlobalHooks().clear()
})

describe('TeamService.delete', () => {
  test('marks deletedAt instead of removing the row, and revokes memberships and pending invitations', async () => {
    await TeamService.delete('team-1', 'owner-1')

    expect(mockTx.mutate.mock.calls[0][0]).toMatch(/UPDATE "teams" SET "deletedAt" = NOW\(\)/)
    expect(sqlOf(mockTx.query)).toContain('DELETE FROM "team_members" WHERE "teamId" = $1')
    expect(sqlOf(mockTx.query)).toContain(`DELETE FROM "team_invitations" WHERE "teamId" = $1 AND status = 'pending'`)
    expect(sqlOf(mockTx.query) + sqlOf(mockTx.mutate)).not.toContain('DELETE FROM "teams"')
    expect(mockTx.commit).toHaveBeenCalledTimes(1)
    expect(mockTx.rollback).not.toHaveBeenCalled()
  })

  test('schedules the purge for the end of the retention (30 days by default, configurable)', async () => {
    const before = Date.now()
    await TeamService.delete('team-1', 'owner-1')
    let [action, , options] = mockScheduleAction.mock.calls[0]
    expect(action).toBe(PURGE_DELETED_TEAMS_ACTION)
    expect(options.scheduledAt.getTime() - before).toBeGreaterThanOrEqual(30 * 86_400_000 - 1000)
    expect(options.scheduledAt.getTime() - before).toBeLessThan(30 * 86_400_000 + 5000)

    mockScheduleAction.mockClear()
    mockTeamsConfig.options = { deletedRetentionDays: 7 }
    const now = Date.now()
    await TeamService.delete('team-1', 'owner-1')
    ;[, , options] = mockScheduleAction.mock.calls[0]
    expect(options.scheduledAt.getTime() - now).toBeLessThan(7 * 86_400_000 + 5000)
  })

  test('a failed purge scheduling does not undo the deletion', async () => {
    mockScheduleAction.mockRejectedValue(new Error('queue down'))
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect(TeamService.delete('team-1', 'owner-1')).resolves.toBeUndefined()
    expect(mockTx.commit).toHaveBeenCalled()
    errors.mockRestore()
  })

  test('only the owner deletes, and an already deleted team is not found', async () => {
    await expect(TeamService.delete('team-1', 'someone-else')).rejects.toThrow('Only team owner can delete the team')
    expect(mockTx.mutate).not.toHaveBeenCalled()

    mockQueryOneWithRLS.mockResolvedValue(null)
    await expect(TeamService.delete('team-1', 'owner-1')).rejects.toThrow('Team not found')
    expect(mockQueryOneWithRLS.mock.calls[0][0]).toContain('"deletedAt" IS NULL')
  })

  test('rolls back when the team was deleted or handed over between the check and the update', async () => {
    mockTx.mutate.mockResolvedValue({ rowCount: 0 })
    await expect(TeamService.delete('team-1', 'owner-1')).rejects.toThrow('Team not found')
    expect(mockTx.rollback).toHaveBeenCalled()
    expect(mockTx.commit).not.toHaveBeenCalled()
  })

  test('the single-tenant global team and the system admin team cannot be deleted', async () => {
    mockQueryOneWithRLS.mockResolvedValue({ ...team, isGlobal: true })
    await expect(TeamService.delete('team-1', 'owner-1')).rejects.toThrow('The global team cannot be deleted')

    mockQueryOneWithRLS.mockResolvedValue({ ...team, isGlobal: false, metadata: { systemAdmin: true } })
    await expect(TeamService.delete('team-1', 'owner-1')).rejects.toThrow('The system admin team cannot be deleted')

    expect(mockTx.mutate).not.toHaveBeenCalled()
  })

  test('team.before_delete can veto with a message and leaves the team intact', async () => {
    const after = jest.fn()
    getGlobalHooks().addFilter(TEAM_BEFORE_DELETE_HOOK, async () => {
      throw new Error('The team still has an active contract')
    })
    getGlobalHooks().addAction(TEAM_DELETED_HOOK, after)

    const error = await TeamService.delete('team-1', 'owner-1').catch(e => e)

    expect(error).toBeInstanceOf(TeamDeleteVetoedError)
    expect(error.message).toBe('The team still has an active contract')
    expect(error.code).toBe('TEAM_DELETE_VETOED')
    expect(mockTx.mutate).not.toHaveBeenCalled()
    expect(mockTx.commit).not.toHaveBeenCalled()
    expect(mockScheduleAction).not.toHaveBeenCalled()
    expect(after).not.toHaveBeenCalled()
  })

  test('team.before_delete receives the team and the user, and a hook that allows lets the deletion run', async () => {
    const before = jest.fn().mockResolvedValue(undefined)
    getGlobalHooks().addFilter(TEAM_BEFORE_DELETE_HOOK, before)

    await TeamService.delete('team-1', 'owner-1')

    expect(before).toHaveBeenCalledWith(expect.objectContaining({ teamId: 'team-1', userId: 'owner-1', team }))
    expect(mockTx.commit).toHaveBeenCalled()
  })

  test('team.deleted runs after the commit, and its failure does not fail the deletion', async () => {
    const order: string[] = []
    mockTx.commit.mockImplementation(async () => { order.push('commit') })
    getGlobalHooks().addAction(TEAM_DELETED_HOOK, async () => {
      order.push('after')
      throw new Error('cleanup failed')
    })
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {})

    await expect(TeamService.delete('team-1', 'owner-1')).resolves.toBeUndefined()

    expect(order).toEqual(['commit', 'after'])
    errors.mockRestore()
  })
})

describe('readers hide a deleted team', () => {
  test.each([
    ['getById', () => TeamService.getById('team-1')],
    ['getBySlug', () => TeamService.getBySlug('acme')],
    ['getGlobal', () => TeamService.getGlobal()],
    ['getWithMemberCount', () => TeamService.getWithMemberCount('team-1', 'user-1')],
    ['getOwner', () => TeamService.getOwner('team-1')],
    ['exists', () => TeamService.exists('team-1')],
    ['isBootstrapDone', () => TeamService.isBootstrapDone()],
  ])('%s asks only for teams without deletedAt', async (_name, call) => {
    mockQueryOneWithRLS.mockResolvedValue(null)
    await call()
    expect(String(mockQueryOneWithRLS.mock.calls[0][0])).toMatch(/"deletedAt" IS NULL/)
  })

  test.each([
    ['getUserTeams', () => TeamService.getUserTeams('user-1')],
    ['getByOwnerId', () => TeamService.getByOwnerId('user-1')],
  ])('%s lists only teams without deletedAt', async (_name, call) => {
    mockQueryWithRLS.mockResolvedValue([])
    await call()
    expect(String(mockQueryWithRLS.mock.calls[0][0])).toMatch(/"deletedAt" IS NULL/)
  })

  test('update does not touch a deleted team', async () => {
    mockQueryOneWithRLS.mockResolvedValue(null)
    await expect(TeamService.update('team-1', { name: 'x' }, 'owner-1')).rejects.toThrow('Team not found')
    expect(String(mockQueryOneWithRLS.mock.calls[0][0])).toMatch(/"deletedAt" IS NULL/)
  })

  test('switchActive refuses a deleted team', async () => {
    mockQueryOneWithRLS.mockResolvedValue(null)
    await expect(TeamService.switchActive('user-1', 'team-1')).rejects.toThrow('User is not a member of this team')
    expect(String(mockQueryOneWithRLS.mock.calls[0][0])).toMatch(/t\."deletedAt" IS NULL/)
  })
})

describe('purge of deleted teams', () => {
  test('deletes only teams whose deletedAt is older than the retention', async () => {
    mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 2 })

    expect(await TeamService.purgeDeleted()).toBe(2)

    const [sql, params, userId] = mockMutateWithRLS.mock.calls[0]
    expect(sql).toContain('"deletedAt" IS NOT NULL')
    expect(sql).toContain(`"deletedAt" < NOW() - make_interval(secs => $1::float8 * 86400)`)
    expect(params).toEqual([30])
    expect(userId).toBeNull()
  })

  test('the retention comes from teams.options.deletedRetentionDays; anything but a number >= 0 falls back to 30', async () => {
    mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 0 })
    for (const [configured, expected] of [[7, 7], [0, 0], [-1, 30], ['10', 30], [NaN, 30], [undefined, 30]] as const) {
      mockMutateWithRLS.mockClear()
      mockTeamsConfig.options = { deletedRetentionDays: configured }
      await TeamService.purgeDeleted()
      expect(mockMutateWithRLS.mock.calls[0][1]).toEqual([expected])
    }
  })

  test('getNextPurgeAt is the oldest deletion plus the retention, or null when nothing waits', async () => {
    mockQueryOneWithRLS.mockResolvedValue({ deletedAt: '2026-01-01T00:00:00.000Z' })
    expect((await TeamService.getNextPurgeAt(10))?.toISOString()).toBe('2026-01-11T00:00:00.000Z')

    mockQueryOneWithRLS.mockResolvedValue({ deletedAt: null })
    expect(await TeamService.getNextPurgeAt()).toBeNull()
  })
})

describe('teams:purge-deleted scheduled action', () => {
  const run = async () => getActionHandler(PURGE_DELETED_TEAMS_ACTION)!.handler({}, {} as never)

  beforeEach(() => {
    clearActionRegistry()
    jest.spyOn(console, 'log').mockImplementation(() => {})
    jest.spyOn(console, 'info').mockImplementation(() => {})
    registerCoreHandlers()
    mockMutateWithRLS.mockResolvedValue({ rows: [], rowCount: 1 })
  })
  afterEach(() => jest.restoreAllMocks())

  test('core registers it, so any cron instance runs it', () => {
    expect(getActionHandler(PURGE_DELETED_TEAMS_ACTION)).toBeDefined()
  })

  test('purges, and schedules the next run for the next expiry while teams still wait', async () => {
    const next = new Date('2026-02-01T00:00:00.000Z')
    mockQueryOneWithRLS.mockResolvedValueOnce({ deletedAt: next.toISOString() }) // getNextPurgeAt
    mockQueryOneWithRLS.mockResolvedValueOnce(null) // no run pending

    await run()

    expect(mockMutateWithRLS).toHaveBeenCalledTimes(1)
    expect(mockScheduleAction).toHaveBeenCalledWith(PURGE_DELETED_TEAMS_ACTION, {}, { scheduledAt: new Date('2026-03-03T00:00:00.000Z') })
  })

  test('does not stack runs: a pending one already waits', async () => {
    mockQueryOneWithRLS.mockResolvedValueOnce({ deletedAt: '2026-02-01T00:00:00.000Z' })
    mockQueryOneWithRLS.mockResolvedValueOnce({ id: 'pending-run' })

    await run()

    expect(mockScheduleAction).not.toHaveBeenCalled()
  })

  test('ends the chain when no deleted team is left', async () => {
    mockQueryOneWithRLS.mockResolvedValueOnce({ deletedAt: null })

    await run()

    expect(mockScheduleAction).not.toHaveBeenCalled()
  })
})
