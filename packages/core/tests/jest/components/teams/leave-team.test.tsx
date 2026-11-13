/**
 * "Leave team" on the teams settings page (#459): shown for an admin, a member and a viewer in multi-tenant mode,
 * disabled with the reason for the owner, absent in single-tenant mode; confirming calls
 * DELETE /api/v1/teams/:teamId/members/me, and leaving the current team switches to the user's earliest-joined other
 * team, or clears the current team when there is none.
 */
import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: Record<string, string>) => (values?.name ? `${key}:${values.name}` : key),
  useLocale: () => 'en',
}))
const mockToast = { success: jest.fn(), error: jest.fn() }
jest.mock('sonner', () => ({ toast: mockToast }))

// The dialog renders its content inline while open
jest.mock('@/core/components/ui/alert-dialog', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  return {
    AlertDialog: ({ open, children }: { open: boolean; children?: React.ReactNode }) => (open ? <>{children}</> : null),
    AlertDialogContent: ({ children, ...rest }: { children?: React.ReactNode; 'data-cy'?: string }) => <div data-cy={rest['data-cy']}>{children}</div>,
    AlertDialogHeader: Pass,
    AlertDialogFooter: Pass,
    AlertDialogTitle: Pass,
    AlertDialogDescription: Pass,
    AlertDialogCancel: ({ children }: { children?: React.ReactNode }) => <button>{children}</button>,
    AlertDialogAction: ({ children, onClick, ...rest }: { children?: React.ReactNode; onClick?: (e: { preventDefault: () => void }) => void; 'data-cy'?: string }) => (
      <button data-cy={rest['data-cy']} onClick={() => onClick?.({ preventDefault: () => undefined })}>{children}</button>
    ),
  }
})

type Membership = { team: { id: string; name: string; slug: string; description: null }; role: string; joinedAt: string }
const membership = (id: string, role: string, joinedAt: string): Membership => ({ team: { id, name: `Team ${id}`, slug: id, description: null }, role, joinedAt })

let mockTeams: Membership[] = []
let mockCurrent = 'a'
const mockSwitchTeam = jest.fn(async () => undefined)
const mockRefreshTeams = jest.fn(async () => undefined)
const mockContext = () => ({
  appRole: 'member',
  currentTeam: mockTeams.find(m => m.team.id === mockCurrent)?.team ?? null,
  userTeams: mockTeams,
  isLoading: false,
  switchTeam: mockSwitchTeam,
  refreshTeams: mockRefreshTeams,
})
jest.mock('@/core/contexts/TeamContext', () => ({ useTeamContext: () => mockContext(), useOptionalTeamContext: () => mockContext() }))
let mockMode = 'multi-tenant'
jest.mock('@/core/hooks/useTeamsConfig', () => ({
  useTeamsConfig: () => ({ mode: mockMode, canCreate: mockMode === 'multi-tenant', canSwitch: mockMode === 'multi-tenant' }),
}))
jest.mock('@/core/components/teams/TeamMembersList', () => ({ TeamMembersList: () => null }))
jest.mock('@/core/components/teams/TeamPendingInvitations', () => ({ TeamPendingInvitations: () => null }))
jest.mock('@/core/components/teams/InlineEditableField', () => ({ InlineEditableField: () => null }))
jest.mock('@/core/components/teams/CreateTeamDialog', () => ({ CreateTeamDialog: () => null }))

import TeamsSettingsPage from '@/core/routes/dashboard/settings/teams/page'

const fetchMock = jest.fn()

function openTeam(id: string) {
  const view = render(<TeamsSettingsPage />)
  fireEvent.click(view.container.querySelector(`[data-cy="team-item-${id}"]`)!)
  return view
}
const leaveButton = (view: ReturnType<typeof render>) => view.container.querySelector('[data-cy="leave-team-button"]') as HTMLButtonElement | null

async function confirmLeave(view: ReturnType<typeof render>) {
  fireEvent.click(leaveButton(view)!)
  fireEvent.click(view.container.querySelector('[data-cy="leave-team-confirm"]')!)
  await waitFor(() => expect(mockToast.success.mock.calls.length + mockToast.error.mock.calls.length).toBe(1))
}

beforeEach(() => {
  jest.clearAllMocks()
  localStorage.clear()
  mockMode = 'multi-tenant'
  mockCurrent = 'a'
  fetchMock.mockResolvedValue({ ok: true, json: async () => ({ success: true }) })
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('Leave team on the teams settings page', () => {
  it.each(['admin', 'member', 'viewer'])('a %s sees it enabled', role => {
    mockTeams = [membership('a', role, '2026-01-01')]
    const view = openTeam('a')
    expect(leaveButton(view)).not.toBeNull()
    expect(leaveButton(view)!.disabled).toBe(false)
  })

  it('the owner sees it disabled, with the reason', () => {
    mockTeams = [membership('a', 'owner', '2026-01-01')]
    const view = openTeam('a')
    expect(leaveButton(view)!.disabled).toBe(true)
    expect(screen.getByText('errors.cannotLeaveOwner')).toBeTruthy()
  })

  it('in single-tenant mode it is not there', () => {
    mockMode = 'single-tenant'
    mockTeams = [membership('a', 'member', '2026-01-01')]
    const view = openTeam('a')
    expect(leaveButton(view)).toBeNull()
  })

  it('confirming leaves through the route; leaving the current team switches to the earliest-joined other team', async () => {
    mockTeams = [membership('c', 'owner', '2026-03-01'), membership('a', 'member', '2026-02-01'), membership('b', 'admin', '2026-01-15')]
    const view = openTeam('a')
    await confirmLeave(view)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/teams/a/members/me', { method: 'DELETE' })
    expect(mockToast.success).toHaveBeenCalledWith('leave.success:Team a')
    await waitFor(() => expect(mockSwitchTeam).toHaveBeenCalledWith('b'))
  })

  it('leaving the only team clears the stored team and refreshes into the no-team state', async () => {
    mockTeams = [membership('a', 'viewer', '2026-01-01')]
    localStorage.setItem('activeTeamId', 'a')
    const view = openTeam('a')
    await confirmLeave(view)

    await waitFor(() => expect(mockRefreshTeams).toHaveBeenCalled())
    expect(mockSwitchTeam).not.toHaveBeenCalled()
    expect(localStorage.getItem('activeTeamId')).toBeNull()
  })

  it('leaving another team than the current one only refreshes the list', async () => {
    mockTeams = [membership('a', 'owner', '2026-01-01'), membership('b', 'member', '2026-02-01')]
    const view = openTeam('b')
    await confirmLeave(view)

    expect(fetchMock).toHaveBeenCalledWith('/api/v1/teams/b/members/me', { method: 'DELETE' })
    await waitFor(() => expect(mockRefreshTeams).toHaveBeenCalled())
    expect(mockSwitchTeam).not.toHaveBeenCalled()
  })

  it.each([
    ['the API gives a reason: it is shown', { ok: false, json: async () => ({ code: 'SYSTEM_TEAM_LEAVE_DISABLED', error: "Membership of the system admin team follows the user's role" }) }, "Membership of the system admin team follows the user's role"],
    ['the API gives none: the generic message', { ok: false, json: async () => ({ code: 'X' }) }, 'leave.error'],
    ['the body is not JSON: the generic message', { ok: false, json: async () => { throw new Error('not json') } }, 'leave.error'],
  ])('a refusal where %s, and no team changes', async (_label, reply, message) => {
    fetchMock.mockResolvedValue(reply)
    mockTeams = [membership('a', 'member', '2026-01-01'), membership('b', 'member', '2026-02-01')]
    const view = openTeam('a')
    await confirmLeave(view)

    expect(mockToast.error).toHaveBeenCalledWith(message)
    expect(mockSwitchTeam).not.toHaveBeenCalled()
    expect(mockRefreshTeams).not.toHaveBeenCalled()
  })

  it('a network failure shows the generic message', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'))
    mockTeams = [membership('a', 'member', '2026-01-01')]
    const view = openTeam('a')
    await confirmLeave(view)

    expect(mockToast.error).toHaveBeenCalledWith('leave.error')
  })
})
