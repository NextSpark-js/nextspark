/**
 * POST /api/v1/billing/check-action refuses an action that no mapping of `actionMappings` names (#367): it used to
 * answer `allowed: true`, so a typo in the action passed as a permission. Mapped actions still go to the service.
 */

import { routeHarness, makeReq, asJson, sessionAs, MEMBER } from './input-validation/__helpers__/route-harness'

const mockRegistry = {
  plans: [],
  actionMappings: {
    permissions: { 'team.members.invite': 'team.members.invite' },
    features: { 'analytics.view_advanced': 'advanced_analytics' },
    limits: { 'tasks.create': 'tasks' },
  },
}
jest.mock('@nextsparkjs/registries/billing-registry', () => ({ BILLING_REGISTRY: mockRegistry }))

const mockCanPerformAction = jest.fn()
jest.mock('@/core/lib/services', () => ({
  SubscriptionService: { canPerformAction: (...args: unknown[]) => mockCanPerformAction(...args) },
}))

import { POST as checkAction } from '@/app/api/v1/billing/check-action/route'

const call = (action: string) =>
  checkAction(makeReq('POST', '/api/v1/billing/check-action', asJson({ action }), { 'x-team-id': 'team-1' }), undefined as never)

beforeEach(() => {
  routeHarness.reset()
  mockCanPerformAction.mockReset().mockResolvedValue({ allowed: true })
  routeHarness.mocks.authenticateRequest.mockResolvedValue(sessionAs({ ...MEMBER, defaultTeamId: 'team-1' } as typeof MEMBER))
})

test('an action that is not in actionMappings is refused with reason unknown_action, without asking the service', async () => {
  const response = await call('tasks.crate')
  expect(response.status).toBe(200)
  expect(await response.json()).toMatchObject({ success: true, data: { allowed: false, reason: 'unknown_action' } })
  expect(mockCanPerformAction).not.toHaveBeenCalled()
})

test.each(['team.members.invite', 'analytics.view_advanced', 'tasks.create'])('%s, mapped, goes to the service', async (action) => {
  const response = await call(action)
  expect(await response.json()).toMatchObject({ data: { allowed: true } })
  expect(mockCanPerformAction).toHaveBeenCalledWith(expect.anything(), 'team-1', action)
})
