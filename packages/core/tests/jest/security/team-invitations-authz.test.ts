/**
 * Regression guard for GHSA-rw2j-9mxg-rx98.
 *
 * The two source-shape assertions below exist because the vulnerability was
 * never a type error or a runtime crash — a bare membership check and a
 * `SELECT ti.*` both compile and run fine. Nothing but a test that reads the
 * actual route source would catch someone reintroducing either regression
 * (e.g. "simplifying" the SELECT back to `ti.*`, or swapping the permission
 * check back to `TeamMemberService.isMember`). The full authz behavior
 * (member role blocked, owner role allowed, real DB round-trip) was verified
 * live against a disposable database as part of this fix — see the commit
 * message for the exact repro — since mocking MembershipService/queryWithRLS
 * for this route has proven brittle elsewhere in this codebase.
 */
import { readFileSync } from 'fs'
import { join } from 'path'

const ROUTES_DIR = join(__dirname, '../../../../../apps/dev/app/api/v1/teams/[teamId]')

describe('GHSA-rw2j-9mxg-rx98 — team members/invitations GET authorization', () => {
  it('invitations route selects an explicit column list and never selects the bearer token', () => {
    const source = readFileSync(join(ROUTES_DIR, 'invitations/route.ts'), 'utf8')
    expect(source).not.toMatch(/SELECT\s+ti\.\*/)
    expect(source).not.toMatch(/ti\."?token"?(?!Field)/i)
  })

  it('invitations GET gates on a permission check, not bare membership', () => {
    const source = readFileSync(join(ROUTES_DIR, 'invitations/route.ts'), 'utf8')
    const getHandlerSource = source.slice(0, source.indexOf('export const DELETE'))
    expect(getHandlerSource).not.toMatch(/TeamMemberService\.isMember/)
    expect(getHandlerSource).toMatch(/canPerformAction\(['"]team\.members\.invite['"]\)/)
  })

  it('members GET gates the non-superadmin path on a permission check, not bare membership', () => {
    const source = readFileSync(join(ROUTES_DIR, 'members/route.ts'), 'utf8')
    const getHandlerSource = source.slice(0, source.indexOf('export const POST'))
    expect(getHandlerSource).not.toMatch(/TeamMemberService\.isMember/)
    expect(getHandlerSource).toMatch(/canPerformAction\(['"]team\.members\.view['"]\)/)
  })
})
