/**
 * UserService.updateUser writes profile fields only: `role` is not one of them (roles change through the routes that
 * check who may assign them, lib/auth/assignable-roles.ts).
 */
const mutateWithRLS = jest.fn(async () => ({ rows: [{ id: 'u1' }], rowCount: 1 }))
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: (...args: unknown[]) => mutateWithRLS(...(args as [])),
}))

import { UserService } from '@/core/lib/services/user.service'

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => {})
})

it('ignores role, alone or with a profile field', async () => {
  await expect(UserService.updateUser('u1', { role: 'superadmin' } as never, 'u1')).rejects.toThrow(/No valid fields/)
  expect(mutateWithRLS).not.toHaveBeenCalled()

  await UserService.updateUser('u1', { firstName: 'A', role: 'developer' } as never, 'u1')
  const [[sql, values]] = mutateWithRLS.mock.calls as unknown as [string, unknown[]][]
  expect(sql).not.toMatch(/\brole\s*=/)
  expect(values).not.toContain('developer')
})
