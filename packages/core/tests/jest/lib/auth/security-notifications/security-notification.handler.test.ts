/**
 * Unit Tests: auth:security-notification scheduled-action handler (issue #75)
 *
 * The email PROVIDER is mocked (no real send). The template registry is real, so
 * these tests exercise the actual baseline builders AND the theme-override path.
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// --- Mock the email provider (EmailFactory.getInstance().send) --------------
const mockSend = jest.fn()
jest.mock('@/core/lib/email', () => ({
  EmailFactory: {
    getInstance: () => ({ send: mockSend }),
  },
}))

import { registerSecurityNotificationAction } from '@/core/lib/scheduled-actions/handlers/security-notification'
import {
  getActionHandler,
  clearActionRegistry,
} from '@/core/lib/scheduled-actions/registry'
import {
  registerSecurityEmailTemplate,
  clearSecurityEmailTemplates,
} from '@/core/lib/auth/security-notifications/registry'
import type { ScheduledAction } from '@/core/lib/scheduled-actions/types'
import type { SecurityNotificationActionPayload } from '@/core/lib/auth/security-notifications/types'

function makeAction(overrides: Partial<ScheduledAction> = {}): ScheduledAction {
  return {
    id: 'action-1',
    actionType: 'auth:security-notification',
    status: 'running',
    payload: {},
    teamId: null,
    scheduledAt: new Date(),
    startedAt: new Date(),
    completedAt: null,
    errorMessage: null,
    attempts: 1,
    maxRetries: 3,
    recurringInterval: null,
    recurrenceType: null,
    lockGroup: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

/** Register the handler and return its handler fn from the registry. */
function getHandler() {
  registerSecurityNotificationAction()
  const def = getActionHandler('auth:security-notification')
  if (!def) throw new Error('handler not registered')
  return def.handler
}

const basePayload: SecurityNotificationActionPayload = {
  type: 'newDeviceLogin',
  locale: 'en',
  appName: 'Acme',
  to: 'user@example.com',
  userName: 'Ada',
  ipAddress: '203.0.113.42',
  userAgent: 'Chrome/120.0',
  occurredAt: '2026-09-01T12:00:00.000Z',
}

describe('auth:security-notification handler', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    clearActionRegistry()
    clearSecurityEmailTemplates()
    mockSend.mockResolvedValue({ id: 'email-1', success: true })
  })

  afterEach(() => {
    jest.clearAllMocks()
    clearActionRegistry()
    clearSecurityEmailTemplates()
  })

  test('sends using the baseline template (EN) for newDeviceLogin', async () => {
    const handler = getHandler()
    await handler(basePayload, makeAction())

    expect(mockSend).toHaveBeenCalledTimes(1)
    const arg = mockSend.mock.calls[0][0] as {
      to: string
      subject: string
      html: string
    }
    expect(arg.to).toBe('user@example.com')
    expect(arg.subject).toContain('Acme')
    expect(arg.subject.toLowerCase()).toContain('sign-in')
    expect(arg.html).toContain('Acme')
  })

  test('uses the Spanish baseline copy when locale is es', async () => {
    const handler = getHandler()
    await handler({ ...basePayload, locale: 'es' }, makeAction())

    const arg = mockSend.mock.calls[0][0] as { subject: string }
    expect(arg.subject.toLowerCase()).toContain('inicio de sesión')
  })

  test('prefers a theme-registered template over the baseline', async () => {
    registerSecurityEmailTemplate('newDeviceLogin', 'en', (ctx) => ({
      subject: `BRANDED ${ctx.appName}`,
      html: `<b>branded ${ctx.userName}</b>`,
    }))

    const handler = getHandler()
    await handler(basePayload, makeAction())

    const arg = mockSend.mock.calls[0][0] as { subject: string; html: string }
    expect(arg.subject).toBe('BRANDED Acme')
    expect(arg.html).toContain('branded Ada')
  })

  test('passwordChanged and emailChanged route to their own templates', async () => {
    const handler = getHandler()

    await handler({ ...basePayload, type: 'passwordChanged' }, makeAction())
    expect((mockSend.mock.calls[0][0] as { subject: string }).subject.toLowerCase()).toContain(
      'password',
    )

    mockSend.mockClear()
    await handler(
      { ...basePayload, type: 'emailChanged', to: 'old@example.com', newEmail: 'new@example.com' },
      makeAction(),
    )
    const arg = mockSend.mock.calls[0][0] as { to: string; html: string }
    expect(arg.to).toBe('old@example.com') // OLD address
    expect(arg.html).toContain('new@example.com')
  })

  test('throws when the email provider reports failure (so the action retries)', async () => {
    mockSend.mockResolvedValue({ id: '', success: false, error: 'smtp down' })
    const handler = getHandler()

    await expect(handler(basePayload, makeAction())).rejects.toThrow(/smtp down/)
  })

  test('no-ops (no send) on a malformed payload missing "to"', async () => {
    const handler = getHandler()
    await handler({ ...basePayload, to: '' }, makeAction())
    expect(mockSend).not.toHaveBeenCalled()
  })
})
