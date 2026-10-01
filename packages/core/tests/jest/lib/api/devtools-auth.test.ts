/**
 * The devtools APIs (/api/v1/devtools/*) follow the rule of the /devtools pages and /api/devtools/*: developer only.
 */
import { canAccessDevtoolsApi, createDevtoolsAccessDeniedResponse } from '@nextsparkjs/core/lib/api/auth/devtools-auth'
import type { DualAuthResult } from '@nextsparkjs/core/lib/api/auth/dual-auth'

const session = (role: string) => ({ success: true, type: 'session', user: { id: 'u', role } }) as unknown as DualAuthResult

it.each([
  ['developer', true],
  ['superadmin', false],
  ['member', false],
  ['admin', false],
])('%s: %s', (role, allowed) => {
  expect(canAccessDevtoolsApi(session(role))).toBe(allowed)
})

it('refuses a failed authentication', () => {
  expect(canAccessDevtoolsApi({ success: false, type: 'none', user: null } as unknown as DualAuthResult)).toBe(false)
})

it('names the developer role in the 403', async () => {
  const response = createDevtoolsAccessDeniedResponse()
  expect(response.status).toBe(403)
  expect((await response.json()).error.details.requiredRoles).toEqual(['developer'])
})
