/**
 * /api/v1/users/:id (and its meta routes) answer only for the user themselves or
 * a superadmin. Row-level security does not cover a deployment that still
 * connects as the table owner, so the handlers must decide it.
 */
import { readFileSync } from 'fs'
import { join } from 'path'
import { canAccessUser } from '../../../src/lib/api/auth/permissions'
import type { DualAuthResult } from '../../../src/lib/api/auth/dual-auth'

const ROUTES = join(__dirname, '../../../src/routes/api/v1/users/[id]')
const as = (id: string, role: string, extra: Partial<DualAuthResult> = {}) =>
  ({ success: true, type: 'session', scopes: ['all'], user: { id, email: `${id}@x.test`, role }, ...extra }) as unknown as DualAuthResult

describe('canAccessUser', () => {
  it('allows the user themselves, by id or by email', () => {
    expect(canAccessUser(as('u1', 'member'), 'u1')).toBe(true)
    expect(canAccessUser(as('u1', 'member'), 'u1@x.test')).toBe(true)
    // Exact, like the routes' SQL: another case of the email may be another account's row
    expect(canAccessUser(as('u1', 'member'), 'U1@x.test')).toBe(false)
  })
  it('refuses another user, whatever their team or role', () => {
    expect(canAccessUser(as('u1', 'member'), 'u2')).toBe(false)
    expect(canAccessUser(as('u1', 'developer'), 'u2')).toBe(false)
    expect(canAccessUser(as('u1', 'member'), 'u2@x.test')).toBe(false)
  })
  it('allows a superadmin session', () => {
    expect(canAccessUser(as('sa', 'superadmin'), 'u2')).toBe(true)
  })
  it('requires the scope on a superadmin API key', () => {
    const key = as('sa', 'superadmin', { type: 'api-key', scopes: ['users:read'] } as Partial<DualAuthResult>)
    expect(canAccessUser(key, 'u2', 'users:read')).toBe(true)
    expect(canAccessUser(key, 'u2', 'users:write')).toBe(false)
  })
  it('refuses an unauthenticated result', () => {
    expect(canAccessUser({ success: false, type: 'none', user: null } as unknown as DualAuthResult, 'u2')).toBe(false)
  })
})

describe('users/:id routes call the check before touching a row', () => {
  const user = readFileSync(join(ROUTES, 'route.ts'), 'utf8')
  const meta = readFileSync(join(ROUTES, 'meta/[key]/route.ts'), 'utf8')
  const handler = (src: string, name: string) => {
    const from = src.indexOf(`export const ${name} `)
    const next = src.indexOf('export const ', from + 1)
    return src.slice(from, next === -1 ? undefined : next)
  }
  it.each(['GET', 'PATCH', 'DELETE'])('%s /users/:id', name => {
    const h = handler(user, name)
    const guard = name === 'DELETE' ? h.indexOf('hasAdminPermission') : h.indexOf('canAccessUser')
    expect(guard).toBeGreaterThan(-1)
    expect(guard).toBeLessThan(h.search(/queryOneWithRLS|mutateWithRLS|req\.json/))
  })
  it('PATCH keeps role changes superadmin-only', () => {
    expect(handler(user, 'PATCH')).toMatch(/role !== undefined && !hasAdminPermission/)
  })
  it.each(['GET', 'PUT', 'DELETE'])('%s /users/:id/meta/:key', name => {
    const h = handler(meta, name)
    expect(h.indexOf('canAccessUser')).toBeGreaterThan(-1)
    expect(h.indexOf('canAccessUser')).toBeLessThan(h.indexOf('UserService.'))
  })
})
