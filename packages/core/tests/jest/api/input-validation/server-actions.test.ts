/**
 * S192 — input validation of the Server Actions in core (lib/actions): entity, user and team actions.
 *
 * An action answers `{ success: false, error: '<text>' }` instead of an HTTP status: the stable part is
 * `success === false` with a fixed, user-facing text, no internal text in it, and no write reaching the data layer.
 * The entity actions run on the real GenericEntityService with the database mocked.
 */

import { writesFrom } from './__helpers__/clean-rejection'

const mockSession = jest.fn()
jest.mock('@/core/lib/auth/authorization-session', () => ({ getAuthorizationSession: (...a: unknown[]) => mockSession(...a) }))
jest.mock('@/core/lib/actions/rate-limit', () => ({ actionRateLimitError: jest.fn().mockResolvedValue(null) }))
const mockRevalidatePath = jest.fn()
jest.mock('next/cache', () => ({ revalidatePath: (...a: unknown[]) => mockRevalidatePath(...a), revalidateTag: jest.fn() }))
const mockRedirect = jest.fn()
jest.mock('next/navigation', () => ({ redirect: (...a: unknown[]) => mockRedirect(...a) }))
jest.mock('next/headers', () => ({
  headers: async () => new Headers(),
  cookies: async () => ({ get: () => ({ value: 'team-1' }) }),
}))
jest.mock('@/core/lib/teams/active-team-cookie', () => ({ ACTIVE_TEAM_COOKIE: 'team', activeTeamIdForSession: () => 'team-1' }))
const mockCheckPermission = jest.fn()
jest.mock('@/core/lib/permissions/check', () => ({
  checkPermission: (...a: unknown[]) => mockCheckPermission(...a),
  declaredPublishPermission: () => null,
  publishPermissionFor: () => null,
}))

const mockQuery = jest.fn()
const mockQueryOne = jest.fn()
const mockMutate = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryWithRLS: (...a: unknown[]) => mockQuery(...a),
  queryOneWithRLS: (...a: unknown[]) => mockQueryOne(...a),
  mutateWithRLS: (...a: unknown[]) => mockMutate(...a),
  getTransactionClient: async () => ({ mutate: (...a: unknown[]) => mockMutate(...a), commit: async () => undefined, rollback: async () => undefined }),
}))
jest.mock('@/core/lib/cache/public-entity-cache', () => ({ expirePublicEntity: jest.fn() }))
jest.mock('@/core/lib/entities/entity-hooks', () => ({
  beforeEntityCreate: async (_slug: string, data: unknown) => data,
  afterEntityCreate: async () => undefined,
  beforeEntityUpdate: async (_slug: string, _id: string, data: unknown) => data,
  afterEntityUpdate: async () => undefined,
  beforeEntityDelete: async () => true,
  afterEntityDelete: async () => undefined,
}))

const PETS = {
  slug: 'pets',
  tableName: 'pets',
  enabled: true,
  names: { singular: 'Pet', plural: 'Pets' },
  access: { api: true },
  fields: [
    { name: 'name', type: 'text', required: true, maxLength: 100, display: { label: 'Name' }, api: { searchable: true } },
    { name: 'status', type: 'select', display: { label: 'Status' }, options: [{ value: 'active', label: 'Active' }], api: {} },
    { name: 'age', type: 'number', display: { label: 'Age' }, api: {} },
  ],
}
jest.mock('@/core/lib/entities/registry', () => ({ entityRegistry: { get: (slug: string) => (slug === 'pets' ? PETS : undefined) } }))

const mockTeamMember = { hasPermission: jest.fn(), getRole: jest.fn(), remove: jest.fn(), updateRole: jest.fn(), transferOwnership: jest.fn(), getByUserId: jest.fn() }
jest.mock('@/core/lib/services/team-member.service', () => ({ TeamMemberService: new Proxy({}, { get: (_t, name: string) => (mockTeamMember as Record<string, unknown>)[name] }) }))
const mockTeam = { update: jest.fn(), isSlugAvailable: jest.fn() }
jest.mock('@/core/lib/services/team.service', () => ({ TeamService: new Proxy({}, { get: (_t, name: string) => (mockTeam as Record<string, unknown>)[name] }) }))
const mockInvitationCreate = jest.fn()
jest.mock('@/core/lib/services/team-invitation.service', () => ({ TeamInvitationService: { create: (...a: unknown[]) => mockInvitationCreate(...a) } }))
const mockUpdateUser = jest.fn()
jest.mock('@/core/lib/services/user.service', () => ({ UserService: { updateUser: (...a: unknown[]) => mockUpdateUser(...a), anonymizeAccount: jest.fn() } }))
jest.mock('@/core/lib/config/config-sync', () => ({ APP_CONFIG_MERGED: { teams: { roles: { defaultTeamRole: 'member' } } } }))

import {
  createEntity, updateEntity, deleteEntity, getEntity, listEntities, deleteEntities, entityExists, countEntities,
} from '@/core/lib/actions/entity.actions'
import { updateProfile, updateAvatar } from '@/core/lib/actions/user.actions'
import { updateTeam, inviteMember, removeMember, updateMemberRole, transferTeamOwnership } from '@/core/lib/actions/team.actions'
import { MAX_BATCH_DELETE_IDS } from '@/core/lib/actions/types'

type Result = { success: boolean; error?: string; data?: unknown }
const INTERNAL = /\n\s+at\s+\S+.*:\d+:\d+|node_modules|TypeError|ReferenceError|SyntaxError|Cannot read propert|is not a function|invalid input syntax|violates|ECONN/

/** The stable shape of a refused action: success false, a short fixed text, nothing internal in it. */
function expectRefused(result: Result) {
  expect(result.success).toBe(false)
  expect(typeof result.error).toBe('string')
  expect(result.error).not.toBe('')
  expect(result.error).not.toMatch(INTERNAL)
}
const writes = () => [...writesFrom(mockMutate), ...writesFrom(mockQuery), ...writesFrom(mockQueryOne)]
const asAny = (value: unknown) => value as never

beforeEach(() => {
  jest.clearAllMocks()
  jest.spyOn(console, 'error').mockImplementation(() => undefined)
  jest.spyOn(console, 'log').mockImplementation(() => undefined)
  mockSession.mockResolvedValue({ user: { id: 'user-1', email: 'u@test.com' }, session: { id: 's1' } })
  mockCheckPermission.mockResolvedValue(true)
  mockQuery.mockResolvedValue([])
  mockQueryOne.mockResolvedValue(null)
  mockMutate.mockResolvedValue({ rows: [{ id: 'pet-1', name: 'Rex' }], rowCount: 1 })
  mockTeamMember.hasPermission.mockResolvedValue(true)
  mockTeamMember.getRole.mockResolvedValue('owner')
  mockTeam.isSlugAvailable.mockResolvedValue(true)
  mockInvitationCreate.mockResolvedValue({ success: false, error: 'refused', status: 400, code: 'X' })
  mockUpdateUser.mockResolvedValue({ id: 'user-1', email: 'u@test.com' })
})

describe('createEntity', () => {
  test.each([
    ['an entity that is not registered', 'nothing', { name: 'Rex' }],
    ['an empty object', 'pets', {}],
    ['a name that is missing', 'pets', { status: 'active' }],
    ['a name that is empty', 'pets', { name: '' }],
    ['a name given an object', 'pets', { name: { first: 'Rex' } }],
    ['a name given an array', 'pets', { name: ['Rex'] }],
    ['a select value that is not an option', 'pets', { name: 'Rex', status: 'archived' }],
    ['a number field given text', 'pets', { name: 'Rex', age: 'old' }],
    ['a number field given an object', 'pets', { name: 'Rex', age: { years: 3 } }],
  ])('refuses %s and writes nothing', async (_label, slug, data) => {
    expectRefused(await createEntity(slug, asAny(data)) as Result)
    expect(writes()).toEqual([])
  })

  // The service validates with validateEntityData, which does not apply the field's declared maxLength; the API handlers
  // do (through the generated schema). A name over the maximum is stored (finding F24).
  test.failing.each([
    ['a name over the declared maximum', { name: 'x'.repeat(101) }],
    ['a name far over the declared maximum', { name: 'x'.repeat(500_000) }],
  ])('refuses %s and writes nothing', async (_label, data) => {
    expectRefused(await createEntity('pets', data) as Result)
    expect(writes()).toEqual([])
  })

  // data that is not an object reaches the service and is dereferenced there; today the action still answers
  // success:false with the generic fallback, so the shape holds (the raw error is only logged)
  test.each([['null', null], ['text', 'Rex'], ['a number', 42], ['an array', [{ name: 'Rex' }]]])('data given %s is refused with a fixed text and writes nothing', async (_label, data) => {
    expectRefused(await createEntity('pets', asAny(data)) as Result)
    expect(writes()).toEqual([])
  })

  test('fields the entity does not declare are never written', async () => {
    await createEntity('pets', asAny({ name: 'Rex', teamId: 'other-team', userId: 'someone-else', colour: 'brown' }))
    for (const [sql, params] of writes()) {
      expect(sql).not.toContain('colour')
      expect(params).not.toContain('other-team')
      expect(params).not.toContain('someone-else')
    }
  })

  test.each([['accented Latin and CJK', 'Ünïcödé 日本語 ñandú'], ['an emoji ZWJ sequence', 'Rex 🐕‍🦺'], ['right-to-left text', 'ريكس'], ['combining marks', 'Renée']])('stores %s unchanged', async (_label, name) => {
    mockMutate.mockImplementation(async (_sql: string, params: unknown[]) => ({ rows: [{ id: 'pet-1', name: params[2] }], rowCount: 1 }))
    const result = await createEntity<{ name: string }>('pets', { name }) as Result & { data: { name: string } }
    expect(result.success).toBe(true)
    expect(result.data.name).toBe(name)
    expect(writes()[0][1]).toContain(name)
  })

  // The config argument comes from the caller and is used as given: any string is revalidated and redirected to (finding F22).
  test.failing('does not redirect to an address outside the app', async () => {
    await createEntity('pets', { name: 'Rex' }, { redirectTo: 'https://elsewhere.example/landing' })
    expect(mockRedirect).not.toHaveBeenCalledWith('https://elsewhere.example/landing')
  })
})

describe('updateEntity / deleteEntity / getEntity / entityExists — ids', () => {
  const BLANK: Array<[string, unknown]> = [['an empty string', ''], ['whitespace', '   '], ['null', null], ['undefined', undefined]]

  test.each(BLANK)('updateEntity refuses %s as the id', async (_label, id) => {
    expectRefused(await updateEntity('pets', asAny(id), { name: 'Rex' }) as Result)
    expect(writes()).toEqual([])
  })
  test.each(BLANK)('deleteEntity refuses %s as the id', async (_label, id) => {
    expectRefused(await deleteEntity('pets', asAny(id)) as Result)
    expect(writes()).toEqual([])
  })
  test.each(BLANK)('getEntity refuses %s as the id', async (_label, id) => {
    expectRefused(await getEntity('pets', asAny(id)) as Result)
  })
  test.each(BLANK)('entityExists refuses %s as the id', async (_label, id) => {
    expectRefused(await entityExists('pets', asAny(id)) as Result)
  })

  // Ids of another type are read with `id?.trim()`, which throws for a number or an object; the action answers success:false
  test.each([['a number', 5], ['an object', { id: 'x' }], ['an array', ['x']]])('every id action refuses %s as the id with a fixed text', async (_label, id) => {
    for (const result of [
      await updateEntity('pets', asAny(id), { name: 'Rex' }),
      await deleteEntity('pets', asAny(id)),
      await getEntity('pets', asAny(id)),
      await entityExists('pets', asAny(id)),
    ]) expectRefused(result as Result)
    expect(writes()).toEqual([])
  })

  test.each([['text', 'not-a-uuid'], ['an over-long string', 'a'.repeat(5000)], ['non-ASCII text', 'mascota-日本語']])('an id of %s that matches nothing is answered without a server error', async (_label, id) => {
    mockQueryOne.mockResolvedValue(null)
    mockMutate.mockResolvedValue({ rows: [], rowCount: 0 })
    for (const result of [await getEntity('pets', id), await deleteEntity('pets', id), await entityExists('pets', id)]) {
      expect(typeof (result as Result).success).toBe('boolean')
      if (!(result as Result).success) expectRefused(result as Result)
    }
  })

  test.each([
    ['null', null],
    ['an empty object', {}],
    ['text', 'Rex'],
    ['a name given an object', { name: { a: 1 } }],
    ['a select value that is not an option', { status: 'archived' }],
    ['a number field given text', { age: 'old' }],
  ])('updateEntity refuses data given as %s and writes nothing', async (_label, data) => {
    expectRefused(await updateEntity('pets', 'pet-1', asAny(data)) as Result)
    expect(writes()).toEqual([])
  })
})

describe('listEntities / countEntities — options', () => {
  test.each([
    ['a filter on a field the entity does not have', { where: { colour: 'brown' } }],
    ['a search string far over any sane length', { search: 'x'.repeat(500_000) }],
    ['an order field that does not exist', { orderBy: 'password' }],
    ['an order direction that does not exist', { orderDir: 'sideways' as never }],
  ])('listEntities answers %s with a fixed result and no server text', async (_label, options) => {
    const result = await listEntities('pets', options) as Result
    if (!result.success) expectRefused(result)
  })

  // limit and offset are handed to LIMIT / OFFSET as given by GenericEntityService.list (finding F3)
  test.failing.each([
    ['a negative limit', { limit: -5 }],
    ['a limit of NaN', { limit: Number.NaN }],
    ['a limit far over any sane maximum', { limit: 10_000_000 }],
    ['a negative offset', { offset: -5 }],
    ['an offset of NaN', { offset: Number.NaN }],
  ])('listEntities passes %s on as a sane window (positive, finite, capped)', async (_label, options) => {
    await listEntities('pets', options)
    const call = (mockQuery.mock.calls as Array<[string, unknown[]]>).find(([sql]) => sql.includes('LIMIT'))
    expect(call).toBeDefined()
    const [limit, offset] = call![1].slice(-2) as number[]
    expect(Number.isFinite(limit) && limit > 0 && limit <= 100).toBe(true)
    expect(Number.isFinite(offset) && offset >= 0).toBe(true)
  })

  test('countEntities refuses a filter on a field the entity does not have, with a fixed text', async () => {
    const result = await countEntities('pets', { colour: 'brown' }) as Result
    if (!result.success) expectRefused(result)
  })

  test('an entity that is not registered is refused', async () => {
    expectRefused(await listEntities('nothing') as Result)
    expectRefused(await countEntities('nothing') as Result)
  })
})

describe('deleteEntities — ids list', () => {
  const ids = (n: number) => Array.from({ length: n }, (_, i) => `id-${i}`)

  test.each([
    ['an empty list', []],
    ['null', null],
    ['undefined', undefined],
    ['a list one over the maximum', ids(MAX_BATCH_DELETE_IDS + 1)],
    ['a list far over the maximum', ids(MAX_BATCH_DELETE_IDS * 100)],
  ])('refuses %s and deletes nothing', async (_label, list) => {
    expectRefused(await deleteEntities('pets', asAny(list)) as Result)
    expect(writes()).toEqual([])
  })

  test('accepts a list of exactly the maximum', async () => {
    mockMutate.mockResolvedValue({ rows: ids(MAX_BATCH_DELETE_IDS).map(id => ({ id })), rowCount: MAX_BATCH_DELETE_IDS })
    expect(((await deleteEntities('pets', ids(MAX_BATCH_DELETE_IDS))) as Result).success).toBe(true)
  })

  test.each([
    ['numbers', [1, 2, 3]],
    ['nulls', [null]],
    ['empty strings', ['', '  ']],
    ['objects', [{ id: 'x' }]],
  ])('refuses a list of %s and deletes nothing', async (_label, list) => {
    expectRefused(await deleteEntities('pets', asAny(list)) as Result)
    expect(writes()).toEqual([])
  })
})

describe('updateProfile', () => {
  test.each([
    ['undefined', undefined],
    ['null', null],
    ['an empty object', {}],
    ['a first name given a number', { firstName: 5 }],
    ['a first name that is empty', { firstName: '' }],
    ['a first name over 100 characters', { firstName: 'x'.repeat(101) }],
    ['a last name given an object', { lastName: { a: 1 } }],
    ['a language that is not a language tag', { language: 'not a language' }],
    ['a country of three letters', { country: 'ARG' }],
    ['a timezone that does not exist', { timezone: 'Mars/Olympus' }],
    ['a timezone far over any sane length', { timezone: 'x'.repeat(5000) }],
    ['only fields the profile does not have', { colour: 'brown' }],
  ])('refuses %s with a fixed text and writes nothing', async (_label, data) => {
    expectRefused(await updateProfile(asAny(data)) as Result)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  test.each([['accented Latin', 'María José'], ['CJK', '太郎'], ['right-to-left', 'محمد'], ['emoji', 'Ana 🐕‍🦺']])('stores a %s first name unchanged', async (_label, firstName) => {
    mockUpdateUser.mockImplementation(async (_id: string, payload: { firstName: string }) => ({ id: 'user-1', email: 'u@test.com', firstName: payload.firstName }))
    const result = await updateProfile({ firstName }) as Result & { data: { firstName: string } }
    expect(result.success).toBe(true)
    expect(result.data.firstName).toBe(firstName)
  })

  test('extra fields next to valid ones are not passed on', async () => {
    await updateProfile(asAny({ firstName: 'Ana', role: 'superadmin', email: 'other@test.com' }))
    const payload = mockUpdateUser.mock.calls[0][1] as Record<string, unknown>
    expect(Object.keys(payload)).toEqual(['firstName'])
  })
})

describe('updateAvatar', () => {
  const form = (entries: Record<string, FormDataEntryValue>) => { const data = new FormData(); Object.entries(entries).forEach(([k, v]) => data.set(k, v)); return data }

  test.each([
    ['no form data', undefined],
    ['null form data', null],
    ['a form with no avatar', form({})],
    ['an empty avatar', form({ avatar: '' })],
    ['a file in place of a URL', form({ avatar: new File(['x'], 'a.png', { type: 'image/png' }) })],
    ['a value that is not a URL', form({ avatar: 'not a url' })],
    ['a URL on a scheme other than http(s)', form({ avatar: 'ftp://files.example/a.png' })],
    ['a protocol-relative address', form({ avatar: '//elsewhere.example/a.png' })],
    ['a URL over 2048 characters', form({ avatar: `https://files.example/${'a'.repeat(2100)}.png` })],
    ['a value with control characters', form({ avatar: 'https://files.example/a\u0000.png' })],
  ])('refuses %s with a fixed text and writes nothing', async (_label, data) => {
    expectRefused(await updateAvatar(asAny(data)) as Result)
    expect(mockUpdateUser).not.toHaveBeenCalled()
  })

  test('accepts an http(s) URL and a path on this app', async () => {
    for (const avatar of ['https://files.example/a.png', '/uploads/a.png']) {
      expect(((await updateAvatar(form({ avatar }))) as Result).success).toBe(true)
    }
  })
})

describe('team actions', () => {
  const BLANK: Array<[string, unknown]> = [['an empty string', ''], ['whitespace', '   '], ['null', null], ['a number', 5], ['an object', { id: 'x' }]]

  describe.each(BLANK)('a team id given as %s', (_label, teamId) => {
    test('updateTeam refuses it', async () => { expectRefused(await updateTeam(asAny(teamId), { name: 'Team' }) as Result); expect(mockTeam.update).not.toHaveBeenCalled() })
    test('inviteMember refuses it', async () => { expectRefused(await inviteMember(asAny(teamId), 'a@b.test', 'member') as Result); expect(mockInvitationCreate).not.toHaveBeenCalled() })
    test('removeMember refuses it', async () => { expectRefused(await removeMember(asAny(teamId), 'm1') as Result); expect(mockTeamMember.remove).not.toHaveBeenCalled() })
    test('updateMemberRole refuses it', async () => { expectRefused(await updateMemberRole(asAny(teamId), 'm1', 'member') as Result); expect(mockTeamMember.updateRole).not.toHaveBeenCalled() })
    test('transferTeamOwnership refuses it', async () => { expectRefused(await transferTeamOwnership(asAny(teamId), 'u2') as Result); expect(mockTeamMember.transferOwnership).not.toHaveBeenCalled() })
  })

  describe.each(BLANK)('a member id given as %s', (_label, memberId) => {
    test('removeMember refuses it', async () => { expectRefused(await removeMember('team-1', asAny(memberId)) as Result); expect(mockTeamMember.remove).not.toHaveBeenCalled() })
    test('updateMemberRole refuses it', async () => { expectRefused(await updateMemberRole('team-1', asAny(memberId), 'member') as Result); expect(mockTeamMember.updateRole).not.toHaveBeenCalled() })
    test('transferTeamOwnership refuses it', async () => { expectRefused(await transferTeamOwnership('team-1', asAny(memberId)) as Result); expect(mockTeamMember.transferOwnership).not.toHaveBeenCalled() })
  })

  describe('updateTeam — data', () => {
    test.each([
      ['undefined', undefined],
      ['null', null],
      ['an empty object', {}],
      ['a name of one character', { name: 'A' }],
      ['a name over 100 characters', { name: 'x'.repeat(101) }],
      ['a name given a number', { name: 5 }],
      ['a slug with capitals', { slug: 'Team-A' }],
      ['an avatar that is not a URL', { avatarUrl: 'not a url' }],
      ['settings given an array', { settings: ['a'] }],
      ['only fields the team does not have', { colour: 'brown' }],
    ])('refuses %s with a fixed text and updates nothing', async (_label, data) => {
      expectRefused(await updateTeam('team-1', asAny(data)) as Result)
      expect(mockTeam.update).not.toHaveBeenCalled()
    })
  })

  describe('inviteMember — email and role', () => {
    test.each([
      ['an email that is empty', ''],
      ['an email that is only whitespace', '   '],
      ['an email given a number', 5],
      ['an email given an object', { a: 1 }],
      ['an email given null', null],
    ])('refuses %s with a fixed text and invites nobody', async (_label, email) => {
      expectRefused(await inviteMember('team-1', asAny(email), 'member') as Result)
      expect(mockInvitationCreate).not.toHaveBeenCalled()
    })

    test.each([['a role that does not exist', 'emperor'], ['the owner role', 'owner'], ['a role given a number', 3], ['a role given an array', ['member']]])('hands %s to the service, which refuses it with a fixed text', async (_label, role) => {
      const { ZodError } = jest.requireActual('zod') as typeof import('zod')
      mockInvitationCreate.mockRejectedValue(new ZodError([{ code: 'custom', message: 'Role must be one of: admin, member', path: ['role'] }]))
      const result = await inviteMember('team-1', 'a@b.test', asAny(role)) as Result
      expectRefused(result)
    })
  })

  describe('updateMemberRole — role', () => {
    test.each([['a role that does not exist', 'emperor'], ['the owner role', 'owner'], ['a role given a number', 3], ['a role given null', null], ['a role given an object', { a: 1 }]])('refuses %s and changes nothing', async (_label, role) => {
      expectRefused(await updateMemberRole('team-1', 'm1', asAny(role)) as Result)
      expect(mockTeamMember.updateRole).not.toHaveBeenCalled()
    })
  })
})
