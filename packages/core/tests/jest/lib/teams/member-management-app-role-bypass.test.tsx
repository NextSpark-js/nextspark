/**
 * teams.appRoleBypass reaches the member-management checks that used to compare against a fixed role list (#458).
 *
 * For each value of the setting (and no value) and an owner, an admin, a member, a developer who is a member and a
 * superadmin who is a member, three paths give the same answer on editing the team, inviting, removing and changing
 * a role:
 * - the UI: the controls TeamMembersList, TeamPendingInvitations and the teams settings page show
 * - the server actions: updateTeam, inviteMember, removeMember, updateMemberRole
 * - the API routes: PATCH /teams/:id, POST /teams/:id/members, DELETE and PATCH /teams/:id/members/:memberId
 *
 * The expected answers are written out here, not derived from the code under test. The role hierarchy still holds:
 * an admin removes or re-roles only roles below admin, a member manages nobody, nobody removes the owner; an app role
 * the setting lets skip ranks as the owner.
 */
import React from 'react'
import { render, screen, within, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { routeHarness, makeReq, asJson, idParams, sessionAs } from '../../api/input-validation/__helpers__/route-harness'
import { teamPermissionsFor } from '@/core/lib/permissions/app-role-bypass'
import { canInviteToRole } from '@/core/lib/teams/permissions'

const TEAM_ID = 'team-1'

// Who is who in the team: the actors and the members they act on
const PEOPLE: Record<string, { teamRole: string; appRole: string }> = {
  owner: { teamRole: 'owner', appRole: 'member' },
  admin: { teamRole: 'admin', appRole: 'member' },
  member: { teamRole: 'member', appRole: 'member' },
  'developer (team member)': { teamRole: 'member', appRole: 'developer' },
  'superadmin (team member)': { teamRole: 'member', appRole: 'superadmin' },
  't-owner': { teamRole: 'owner', appRole: 'member' },
  't-admin': { teamRole: 'admin', appRole: 'member' },
  't-member': { teamRole: 'member', appRole: 'member' },
}

// MembershipService.get as it builds a membership (the real class; the app role and the permissions by the #457
// rule: app-role-bypass.test.tsx checks the real get() sets both)
function membershipFor(userId: string) {
  const { TeamMembership } = jest.requireActual('@/core/lib/services/membership.service')
  const person = PEOPLE[userId]
  return new TeamMembership({
    userId,
    teamId: TEAM_ID,
    role: person?.teamRole ?? null,
    appRole: person?.appRole ?? null,
    hierarchy: 0,
    permissions: person ? teamPermissionsFor(person.appRole, person.teamRole) : [],
    subscription: null,
    features: [],
    quotas: {},
  })
}

const mockTeamServiceUpdate = jest.fn()
const mockMemberRemove = jest.fn()
const mockMemberUpdateRole = jest.fn()
jest.mock('@/core/lib/services/membership.service', () => ({
  ...jest.requireActual('@/core/lib/services/membership.service'),
  MembershipService: { get: async (userId: string) => membershipFor(userId) },
}))
jest.mock('@/core/lib/services/team-member.service', () => ({
  TeamMemberService: {
    getRole: async (_teamId: string, userId: string) => PEOPLE[userId]?.teamRole ?? null,
    remove: (...a: unknown[]) => mockMemberRemove(...a),
    updateRole: (...a: unknown[]) => mockMemberUpdateRole(...a),
  },
}))
jest.mock('@/core/lib/services/team.service', () => ({
  TeamService: { update: (...a: unknown[]) => mockTeamServiceUpdate(...a), isSlugAvailable: async () => true },
}))
jest.mock('@/core/lib/services', () => ({
  MembershipService: { get: async (userId: string) => membershipFor(userId) },
  TeamService: { isSlugAvailable: async () => true },
  TeamDeleteVetoedError: class extends Error {},
  TeamMemberService: {},
  TeamInvitationService: jest.requireActual('@/core/lib/services/team-invitation.service').TeamInvitationService,
}))
jest.mock('@/core/lib/email/factory', () => ({ EmailFactory: { getInstance: () => ({ send: jest.fn(async () => ({ success: true })) }) } }))
jest.mock('@/core/lib/email/send', () => ({ sendTeamInvitationEmail: jest.fn().mockResolvedValue({ subject: 's', html: 'h' }) }))
jest.mock('@/core/lib/actions/rate-limit', () => ({ actionRateLimitError: jest.fn().mockResolvedValue(null) }))
jest.mock('next/cache', () => ({ revalidatePath: jest.fn() }))
jest.mock('next/headers', () => ({ headers: async () => new Headers(), cookies: async () => ({ get: () => undefined }) }))
let mockActor = 'owner'
jest.mock('@/core/lib/auth/authorization-session', () => ({
  getAuthorizationSession: async () => ({ user: { id: mockActor, email: `${mockActor}@test.com` } }),
}))

// The UI
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))
jest.mock('sonner', () => ({ toast: Object.assign(jest.fn(), { success: jest.fn(), error: jest.fn() }) }))
jest.mock('@/core/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: mockActor } }) }))
jest.mock('@/core/hooks/useTeam', () => ({ useTeam: () => ({ team: { id: TEAM_ID } }) }))
const mockMembers = () =>
  Object.entries(PEOPLE)
    .filter(([id]) => id === mockActor || id.startsWith('t-'))
    .map(([id, p]) => ({ id, userId: id, role: p.teamRole, user: { name: id, email: `${id}@test.com` }, joinedAt: '2026-01-01' }))
jest.mock('@/core/hooks/useTeamMembers', () => ({
  useTeamMembers: () => ({ members: mockMembers(), isLoading: false, updateMemberRole: jest.fn(), removeMember: jest.fn(), transferOwnershipAsync: jest.fn(), isTransferringOwnership: false }),
}))
const mockTeamContext = () => ({
  appRole: PEOPLE[mockActor].appRole,
  currentTeam: { id: TEAM_ID },
  userTeams: [{ team: { id: TEAM_ID, name: 'Team', slug: 'team', description: null }, role: PEOPLE[mockActor].teamRole }],
  isLoading: false,
})
jest.mock('@/core/contexts/TeamContext', () => ({ useTeamContext: () => mockTeamContext(), useOptionalTeamContext: () => mockTeamContext() }))
jest.mock('@/core/hooks/useTeamsConfig', () => ({ useTeamsConfig: () => ({ mode: 'multi-tenant', canCreate: false, canSwitch: true }) }))
// Menus and dialogs render their content inline, so the test reads what a menu would offer
jest.mock('@/core/components/ui/dropdown-menu', () => {
  const Pass = ({ children }: { children?: React.ReactNode }) => <>{children}</>
  const Item = ({ children, onClick, ...rest }: { children?: React.ReactNode; onClick?: () => void; 'data-cy'?: string }) => <button data-cy={rest['data-cy']} onClick={onClick}>{children}</button>
  return { DropdownMenu: Pass, DropdownMenuTrigger: Pass, DropdownMenuContent: Pass, DropdownMenuItem: Item }
})
// The dialog offers getInvitableRoles() filtered by canInviteToRole(currentUserRole, role)
jest.mock('@/core/components/teams/InviteMemberDialog', () => ({
  InviteMemberDialog: ({ currentUserRole }: { currentUserRole: string }) => <div data-cy="invite-dialog" data-role={currentUserRole} />,
}))
jest.mock('@/core/components/teams/InlineEditableField', () => ({
  InlineEditableField: ({ fieldType, disabled }: { fieldType: string; disabled?: boolean }) => <div data-cy={`edit-${fieldType}`} data-disabled={String(!!disabled)} />,
}))
jest.mock('@/core/components/teams/CreateTeamDialog', () => ({ CreateTeamDialog: () => null }))

import { TEAMS_CONFIG } from '@/core/lib/config/config-client'
import { updateTeam, inviteMember, removeMember, updateMemberRole } from '@/core/lib/actions/team.actions'
import { PATCH as patchTeam } from '@/app/api/v1/teams/[teamId]/route'
import { POST as postMember } from '@/app/api/v1/teams/[teamId]/members/route'
import { PATCH as patchMember, DELETE as deleteMember } from '@/app/api/v1/teams/[teamId]/members/[memberId]/route'
import { TeamMembersList } from '@/core/components/teams/TeamMembersList'
import { TeamPendingInvitations } from '@/core/components/teams/TeamPendingInvitations'
import TeamsSettingsPage from '@/core/routes/dashboard/settings/teams/page'

const { mocks } = routeHarness

type Op = 'edit' | 'inviteAdmin' | 'inviteMember' | 'removeAdmin' | 'removeMember' | 'removeOwner' | 'promote' | 'demote' | 'toViewer'
const OPS: Op[] = ['edit', 'inviteAdmin', 'inviteMember', 'removeAdmin', 'removeMember', 'removeOwner', 'promote', 'demote', 'toViewer']

const T = true
const F = false
// [edit, inviteAdmin, inviteMember, removeAdmin, removeMember, removeOwner, promote member→admin, demote admin→member, member→viewer]
const AS_OWNER = [T, T, T, T, T, F, T, T, T]
const AS_ADMIN = [T, F, T, F, T, F, F, F, T]
const NOTHING = [F, F, F, F, F, F, F, F, F]

type Actor = 'owner' | 'admin' | 'member' | 'developer (team member)' | 'superadmin (team member)'
const BASE: Record<Actor, boolean[]> = {
  owner: AS_OWNER,
  admin: AS_ADMIN,
  member: NOTHING,
  'developer (team member)': NOTHING,
  'superadmin (team member)': NOTHING,
}
const EXPECTED: Record<string, Record<Actor, boolean[]>> = {
  none: BASE,
  developer: { ...BASE, 'developer (team member)': AS_OWNER },
  'developer-and-superadmin': { ...BASE, 'developer (team member)': AS_OWNER, 'superadmin (team member)': AS_OWNER },
}
EXPECTED['(not set)'] = EXPECTED.developer

function setSetting(value: string) {
  const teams = TEAMS_CONFIG as unknown as Record<string, unknown>
  if (value === '(not set)') delete teams.appRoleBypass
  else teams.appRoleBypass = value
}

const OP_TARGET: Record<Op, { target: string; role?: string }> = {
  edit: { target: '' },
  inviteAdmin: { target: '', role: 'admin' },
  inviteMember: { target: '', role: 'member' },
  removeAdmin: { target: 't-admin' },
  removeMember: { target: 't-member' },
  removeOwner: { target: 't-owner' },
  promote: { target: 't-member', role: 'admin' },
  demote: { target: 't-admin', role: 'member' },
  toViewer: { target: 't-member', role: 'viewer' },
}

// The invitation service reached its first query after the permission and hierarchy checks
const invitationPassedChecks = () =>
  (mocks.queryOneWithRLS.mock.calls as Array<[string]>).some(([sql]) => sql.includes('FROM "users" WHERE email'))

async function viaAction(op: Op): Promise<boolean> {
  const { target, role } = OP_TARGET[op]
  if (op === 'edit') {
    await updateTeam(TEAM_ID, { name: 'New name' })
    return mockTeamServiceUpdate.mock.calls.length > 0
  }
  if (op.startsWith('invite')) {
    await inviteMember(TEAM_ID, 'new@test.com', role as never)
    return invitationPassedChecks()
  }
  if (op.startsWith('remove')) {
    await removeMember(TEAM_ID, target)
    return mockMemberRemove.mock.calls.length > 0
  }
  await updateMemberRole(TEAM_ID, target, role as never)
  return mockMemberUpdateRole.mock.calls.length > 0
}

const writes = (pattern: string) => (mocks.mutateWithRLS.mock.calls as Array<[string]>).some(([sql]) => sql.includes(pattern))

async function viaApi(op: Op): Promise<boolean> {
  const { target, role } = OP_TARGET[op]
  mocks.authenticateRequest.mockResolvedValue(sessionAs({ id: mockActor, email: `${mockActor}@test.com`, role: PEOPLE[mockActor].appRole }))
  mocks.queryOneWithRLS.mockImplementation(async (sql: string, params: string[]) =>
    sql.includes('FROM "team_members" WHERE id = $1') && PEOPLE[params[0]] ? { id: params[0], teamId: TEAM_ID, role: PEOPLE[params[0]].teamRole } : null
  )
  mocks.mutateWithRLS.mockResolvedValue({ rows: [{ id: 'x' }], rowCount: 1 })
  if (op === 'edit') {
    await patchTeam(makeReq('PATCH', `/api/v1/teams/${TEAM_ID}`, asJson({ name: 'New name' })), idParams({ teamId: TEAM_ID }))
    return writes('UPDATE "teams"')
  }
  if (op.startsWith('invite')) {
    await postMember(makeReq('POST', `/api/v1/teams/${TEAM_ID}/members`, asJson({ email: 'new@test.com', role })), idParams({ teamId: TEAM_ID }))
    return invitationPassedChecks()
  }
  if (op.startsWith('remove')) {
    await deleteMember(makeReq('DELETE', `/api/v1/teams/${TEAM_ID}/members/${target}`), idParams({ teamId: TEAM_ID, memberId: target }))
    return writes('DELETE FROM "team_members"')
  }
  await patchMember(makeReq('PATCH', `/api/v1/teams/${TEAM_ID}/members/${target}`, asJson({ role })), idParams({ teamId: TEAM_ID, memberId: target }))
  return writes('UPDATE "team_members"')
}

/** What the UI offers for each operation: the members list, the pending invitations and the settings page. */
async function viaUi(): Promise<Record<Op, boolean> & { cancelInvitation: boolean; transfer: boolean }> {
  const list = render(<TeamMembersList teamId={TEAM_ID} />)
  const inviteButton = list.container.querySelector('[data-cy="invite-member-button"]') !== null
  const dialogRole = list.container.querySelector('[data-cy="invite-dialog"]')?.getAttribute('data-role') ?? ''
  const row = (id: string) => list.container.querySelector(`[data-cy="member-row-${id}"]`) as HTMLElement
  const offers = (id: string, action: string) => within(row(id)).queryByText((_, el) => el?.getAttribute('data-cy') === action) !== null
  const ui = {
    inviteAdmin: inviteButton && canInviteToRole(dialogRole, 'admin'),
    inviteMember: inviteButton && canInviteToRole(dialogRole, 'member'),
    removeAdmin: offers('t-admin', 'remove-member-action'),
    removeMember: offers('t-member', 'remove-member-action'),
    removeOwner: offers('t-owner', 'remove-member-action'),
    promote: offers('t-member', 'make-admin-action'),
    demote: offers('t-admin', 'make-member-action'),
    toViewer: offers('t-member', 'make-viewer-action'),
    transfer: list.container.querySelector('[data-cy="transfer-ownership-action"]') !== null,
  }
  list.unmount()

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ data: [{ id: 'inv-1', teamId: TEAM_ID, email: 'x@test.com', role: 'member', status: 'pending', expiresAt: '2099-01-01', createdAt: '2026-01-01' }] }),
  })) as unknown as typeof fetch
  const invitations = render(<QueryClientProvider client={queryClient}><TeamPendingInvitations teamId={TEAM_ID} /></QueryClientProvider>)
  await waitFor(() => expect(invitations.container.querySelector('[data-cy="invitation-row-inv-1"]')).not.toBeNull())
  const cancelInvitation = invitations.container.querySelector('[data-cy="cancel-invitation-inv-1"]') !== null
  invitations.unmount()

  const page = render(<QueryClientProvider client={queryClient}><TeamsSettingsPage /></QueryClientProvider>)
  fireEvent.click(screen.getByText('Team'))
  const nameEditable = page.container.querySelector('[data-cy="edit-name"]')?.getAttribute('data-disabled') === 'false'
  const descriptionEditable = page.container.querySelector('[data-cy="edit-description"]')?.getAttribute('data-disabled') === 'false'
  expect(nameEditable).toBe(descriptionEditable)
  page.unmount()

  return { edit: nameEditable, ...ui, cancelInvitation }
}

beforeEach(() => {
  routeHarness.reset()
  mockTeamServiceUpdate.mockReset().mockResolvedValue({ id: TEAM_ID, name: 'New name' })
  mockMemberRemove.mockReset().mockResolvedValue(undefined)
  mockMemberUpdateRole.mockReset().mockResolvedValue({ id: 'x', role: 'member' })
})
afterAll(() => setSetting('(not set)'))

const ACTORS = Object.keys(BASE) as Actor[]

describe.each(Object.keys(EXPECTED))('teams.appRoleBypass = %s', setting => {
  beforeEach(() => setSetting(setting))

  describe.each(ACTORS)('%s', actor => {
    beforeEach(() => {
      mockActor = actor
    })

    test('the UI shows the controls the server allows', async () => {
      const ui = await viaUi()
      const want = Object.fromEntries(OPS.map((op, i) => [op, EXPECTED[setting][actor][i]]))
      expect(Object.fromEntries(OPS.map(op => [op, ui[op]]))).toEqual(want)
      // Cancelling an invitation takes the invite permission: whoever invites a member cancels
      expect(ui.cancelInvitation).toBe(want.inviteMember)
      // Transferring ownership stays with the team's owner: an app role that skips team permissions does not get it
      expect(ui.transfer).toBe(actor === 'owner')
    })

    test.each(OPS)('%s: the server action and the API route agree with the expected answer', async op => {
      const want = EXPECTED[setting][actor][OPS.indexOf(op)]
      expect(await viaAction(op)).toBe(want)
      routeHarness.reset()
      expect(await viaApi(op)).toBe(want)
    })
  })
})
