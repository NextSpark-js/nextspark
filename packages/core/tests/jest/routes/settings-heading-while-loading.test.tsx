/**
 * /dashboard/settings/password and /dashboard/settings/teams paint their heading before their data loads (#565): the h1
 * and the static description used to wait behind a spinner for the profile and the team context.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

const mockProfile = { hasPassword: true, isLoading: true }
const mockTeams = { userTeams: [], currentTeam: null, isLoading: true, appRole: null }

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn(), replace: jest.fn() }) }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/hooks/useUserProfile', () => ({ useUserProfile: () => mockProfile }))
jest.mock('@nextsparkjs/core/hooks/useAuth', () => ({ useAuth: () => ({ user: null, changePassword: jest.fn() }) }))
jest.mock('@nextsparkjs/core/contexts/TeamContext', () => ({ useTeamContext: () => mockTeams }))
jest.mock('@nextsparkjs/core/hooks/useTeamsConfig', () => ({ useTeamsConfig: () => ({ mode: 'multi-tenant', canCreate: true, canSwitch: true }) }))
jest.mock('@nextsparkjs/core/lib/permissions/app-role-bypass', () => ({ hasTeamPermission: () => true }))
jest.mock('@nextsparkjs/core/components/teams/TeamMembersList', () => ({ TeamMembersList: () => null }))
jest.mock('@nextsparkjs/core/components/teams/TeamPendingInvitations', () => ({ TeamPendingInvitations: () => null }))
jest.mock('@nextsparkjs/core/components/teams/LeaveTeamButton', () => ({ LeaveTeamButton: () => null }))
jest.mock('@nextsparkjs/core/components/teams/CreateTeamDialog', () => ({ CreateTeamDialog: () => null }))
jest.mock('@nextsparkjs/core/components/teams/InlineEditableField', () => ({ InlineEditableField: () => null }))

import PasswordPage from '../../../src/routes/dashboard/settings/password/page'
import TeamsPage from '../../../src/routes/dashboard/settings/teams/page'

test('the password heading and description are there while the profile loads, with the spinner behind them', () => {
  const { container } = render(<PasswordPage />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('password.title')
  expect(screen.getByText('password.description')).not.toBeNull()
  expect(container.querySelector('.animate-spin')).not.toBeNull()
  expect(screen.queryByLabelText('password.form.currentPassword')).toBeNull()
})

test('the teams heading and description are there while the teams load, with the status behind them', () => {
  const { container } = render(<TeamsPage />)
  expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('teams.title')
  expect(screen.getByText('teams.description')).not.toBeNull()
  expect(container.querySelector('[role="status"]')).not.toBeNull()
  // the card header (the largest text of the page) is there too; only the team rows wait
  expect(screen.getByText('teams.yourTeamsDescription')).not.toBeNull()
  expect(screen.queryByText('teams.noTeams')).toBeNull()
})
