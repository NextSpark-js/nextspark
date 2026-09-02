/**
 * Unit Tests: security-notifications dispatcher (issue #75)
 *
 * The dispatcher's collaborators are mocked (db, scheduler, auth session, config)
 * so these tests assert its decision logic:
 *   - which event a path maps to
 *   - reading the user from the RESPONSE body for login/password
 *   - reading the SESSION (old email) for change-email
 *   - new vs known device (email only for new)
 *   - the config kill switch and per-event flags
 *   - never notifying on a non-2xx response
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

// --- Mocks (must be declared before importing the module under test) --------
jest.mock('@/core/lib/config', () => ({
  AUTH_CONFIG: {
    securityNotifications: {
      enabled: true,
      events: { newDeviceLogin: true, passwordChanged: true, emailChanged: true },
      fingerprintTtlDays: null,
    },
  },
  I18N_CONFIG: { defaultLocale: 'en' },
  APP_NAME: 'TestApp',
}))

jest.mock('@/core/lib/db', () => ({
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
}))

jest.mock('@/core/lib/scheduled-actions', () => ({
  scheduleAction: jest.fn(),
  isActionRegistered: jest.fn(() => true),
}))

jest.mock('@/core/lib/scheduled-actions/handlers/security-notification', () => ({
  registerSecurityNotificationAction: jest.fn(),
}))

jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: jest.fn() } },
}))

import { dispatchSecurityNotificationsForRequest } from '@/core/lib/auth/security-notifications/dispatcher'
import { queryWithRLS, mutateWithRLS } from '@/core/lib/db'
import { scheduleAction } from '@/core/lib/scheduled-actions'
import { auth } from '@/core/lib/auth'
import { AUTH_CONFIG } from '@/core/lib/config'

const mockQuery = queryWithRLS as jest.MockedFunction<typeof queryWithRLS>
const mockMutate = mutateWithRLS as jest.MockedFunction<typeof mutateWithRLS>
const mockSchedule = scheduleAction as jest.MockedFunction<typeof scheduleAction>
const mockGetSession = auth.api.getSession as unknown as jest.Mock

function makeReq(
  path: string,
  opts: { headers?: Record<string, string>; body?: unknown } = {},
): any {
  return {
    url: `http://localhost${path}`,
    headers: new Headers(opts.headers || {}),
    json: async () => opts.body ?? {},
  }
}

function makeRes(status: number, body: unknown): any {
  return {
    status,
    clone: () => ({ json: async () => body }),
  }
}

const SIGN_IN = '/api/auth/sign-in/email'
const CHANGE_PW = '/api/auth/change-password'
const CHANGE_EMAIL = '/api/auth/change-email'

describe('dispatchSecurityNotificationsForRequest', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    mockMutate.mockResolvedValue({ rows: [], rowCount: 1 })
    // Reset config to all-enabled defaults (tests mutate it).
    AUTH_CONFIG.securityNotifications = {
      enabled: true,
      events: { newDeviceLogin: true, passwordChanged: true, emailChanged: true },
      fingerprintTtlDays: null,
    }
  })

  afterEach(() => jest.clearAllMocks())

  describe('new-device login', () => {
    const signInRes = makeRes(200, {
      user: { id: 'u1', email: 'u1@example.com', firstName: 'Ada', language: 'en' },
    })
    const signInReq = () =>
      makeReq(SIGN_IN, {
        headers: { 'user-agent': 'Chrome/120.0.6099.1', 'x-forwarded-for': '203.0.113.5' },
      })

    test('regression: a cloned NextRequest whose `nextUrl` getter throws is still classified via req.url', async () => {
      mockQuery.mockResolvedValue([]) // never seen
      const req = signInReq()
      Object.defineProperty(req, 'nextUrl', {
        get() {
          throw new TypeError('Cannot create proxy with a non-object as target or handler')
        },
      })

      await dispatchSecurityNotificationsForRequest(req, signInRes)

      expect(mockMutate).toHaveBeenCalledTimes(1)
      expect(mockSchedule).toHaveBeenCalledTimes(1)
    })

    test('unknown fingerprint → logs event (isNew=true) AND queues email', async () => {
      mockQuery.mockResolvedValue([]) // never seen

      await dispatchSecurityNotificationsForRequest(signInReq(), signInRes)

      // Inserted a login_events row flagged new.
      expect(mockMutate).toHaveBeenCalledTimes(1)
      const insertParams = mockMutate.mock.calls[0][1] as unknown[]
      expect(insertParams[0]).toBe('u1') // userId
      expect(insertParams[4]).toBe(true) // isNew

      // Queued the new-device email.
      expect(mockSchedule).toHaveBeenCalledTimes(1)
      const [actionType, payload] = mockSchedule.mock.calls[0] as [string, any]
      expect(actionType).toBe('auth:security-notification')
      expect(payload).toMatchObject({
        type: 'newDeviceLogin',
        to: 'u1@example.com',
        appName: 'TestApp',
        userName: 'Ada',
        ipAddress: '203.0.113.5',
      })
    })

    test('known fingerprint → logs event (isNew=false), NO email', async () => {
      mockQuery.mockResolvedValue([{ id: 'existing' }])

      await dispatchSecurityNotificationsForRequest(signInReq(), signInRes)

      expect(mockMutate).toHaveBeenCalledTimes(1)
      const insertParams = mockMutate.mock.calls[0][1] as unknown[]
      expect(insertParams[4]).toBe(false) // isNew
      expect(mockSchedule).not.toHaveBeenCalled()
    })

    test('applies fingerprintTtlDays to the lookup when configured', async () => {
      AUTH_CONFIG.securityNotifications!.fingerprintTtlDays = 30
      mockQuery.mockResolvedValue([])

      await dispatchSecurityNotificationsForRequest(signInReq(), signInRes)

      const [sql, params] = mockQuery.mock.calls[0] as [string, unknown[]]
      expect(sql).toContain('make_interval')
      expect(params).toContain(30)
    })
  })

  describe('password changed', () => {
    test('queues a passwordChanged email from the response body user', async () => {
      const res = makeRes(200, {
        user: { id: 'u2', email: 'u2@example.com', firstName: 'Bob' },
      })
      await dispatchSecurityNotificationsForRequest(makeReq(CHANGE_PW), res)

      expect(mockMutate).not.toHaveBeenCalled() // no login_events write
      expect(mockSchedule).toHaveBeenCalledTimes(1)
      expect(mockSchedule.mock.calls[0][1]).toMatchObject({
        type: 'passwordChanged',
        to: 'u2@example.com',
      })
    })
  })

  describe('email changed', () => {
    test('reads the SESSION for the OLD address and queues to it', async () => {
      mockGetSession.mockResolvedValue({
        user: { id: 'u3', email: 'old@example.com', firstName: 'Cleo', language: 'es' },
      })
      const req = makeReq(CHANGE_EMAIL, { body: { newEmail: 'new@example.com' } })
      const res = makeRes(200, { status: true }) // no user in body

      await dispatchSecurityNotificationsForRequest(req, res)

      expect(mockGetSession).toHaveBeenCalledTimes(1)
      expect(mockSchedule).toHaveBeenCalledTimes(1)
      expect(mockSchedule.mock.calls[0][1]).toMatchObject({
        type: 'emailChanged',
        to: 'old@example.com', // OLD address, deliberate
        newEmail: 'new@example.com',
        locale: 'es',
      })
    })
  })

  describe('guards / no-ops', () => {
    test('does nothing when securityNotifications.enabled is false', async () => {
      AUTH_CONFIG.securityNotifications!.enabled = false
      mockQuery.mockResolvedValue([])

      await dispatchSecurityNotificationsForRequest(
        makeReq(SIGN_IN),
        makeRes(200, { user: { id: 'u1', email: 'u1@example.com' } }),
      )

      expect(mockQuery).not.toHaveBeenCalled()
      expect(mockMutate).not.toHaveBeenCalled()
      expect(mockSchedule).not.toHaveBeenCalled()
    })

    test('does nothing when the specific event flag is off', async () => {
      AUTH_CONFIG.securityNotifications!.events.newDeviceLogin = false

      await dispatchSecurityNotificationsForRequest(
        makeReq(SIGN_IN),
        makeRes(200, { user: { id: 'u1', email: 'u1@example.com' } }),
      )

      expect(mockMutate).not.toHaveBeenCalled()
      expect(mockSchedule).not.toHaveBeenCalled()
    })

    test('does nothing on a non-2xx auth response', async () => {
      await dispatchSecurityNotificationsForRequest(
        makeReq(SIGN_IN),
        makeRes(401, { message: 'invalid credentials' }),
      )
      expect(mockSchedule).not.toHaveBeenCalled()
    })

    test('ignores unrelated auth paths', async () => {
      await dispatchSecurityNotificationsForRequest(
        makeReq('/api/auth/get-session'),
        makeRes(200, { user: { id: 'u1' } }),
      )
      expect(mockSchedule).not.toHaveBeenCalled()
    })

    test('a thrown collaborator never propagates (auth response is safe)', async () => {
      mockQuery.mockRejectedValue(new Error('db exploded'))
      await expect(
        dispatchSecurityNotificationsForRequest(
          makeReq(SIGN_IN, { headers: { 'user-agent': 'x' } }),
          makeRes(200, { user: { id: 'u1', email: 'u1@example.com' } }),
        ),
      ).resolves.toBeUndefined()
    })
  })
})
