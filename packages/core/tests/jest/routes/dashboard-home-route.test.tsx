/**
 * The dashboard index sends the user to the landing route configured for their role (dashboard.homeRoute of
 * app.config); without the option, with an error in the URL, or when the landing route is the index itself, it stays.
 */
import React from 'react'
import { render } from '@testing-library/react'

const mockReplace = jest.fn()
const mockAuth: { user: { role?: string } | null } = { user: { role: 'member' } }
const mockConfig: { dashboard: { homeRoute?: unknown } | undefined } = { dashboard: undefined }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: mockReplace }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({
  useUserProfile: () => ({ user: mockAuth.user && { id: 'u1', firstName: 'A', email: 'a@example.com' }, isLoading: false }),
}))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuth: () => ({ user: mockAuth.user }) }))
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({
  get DASHBOARD_HOME_CONFIG() {
    return mockConfig.dashboard
  },
}))

import DashboardIndex from '../../../src/routes/dashboard/(main)/page'

function open(search = '') {
  window.history.replaceState({}, '', `/dashboard${search}`)
  render(<DashboardIndex />)
}

beforeEach(() => {
  mockReplace.mockReset()
  mockAuth.user = { role: 'member' }
  mockConfig.dashboard = undefined
})

describe('dashboard index landing route', () => {
  test('without the option it stays', () => {
    open()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test('a string landing route redirects', () => {
    mockConfig.dashboard = { homeRoute: '/dashboard/tasks' }
    open()
    expect(mockReplace).toHaveBeenCalledWith('/dashboard/tasks')
  })

  test('a map follows the role and a role missing from it stays', () => {
    mockConfig.dashboard = { homeRoute: { superadmin: '/superadmin' } }
    mockAuth.user = { role: 'superadmin' }
    open()
    expect(mockReplace).toHaveBeenCalledWith('/superadmin')
    mockReplace.mockReset()
    mockAuth.user = { role: 'member' }
    open()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test('stays when the page carries an error, such as access denied', () => {
    mockConfig.dashboard = { homeRoute: '/dashboard/tasks' }
    open('?error=access_denied')
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test('stays when the landing route is the index with a query (no loop)', () => {
    mockConfig.dashboard = { homeRoute: '/dashboard?view=mine' }
    open()
    expect(mockReplace).not.toHaveBeenCalled()
  })

  test('a landing route outside the app is never followed', () => {
    mockConfig.dashboard = { homeRoute: 'https://evil.example/x' }
    open()
    expect(mockReplace).not.toHaveBeenCalled()
  })
})
