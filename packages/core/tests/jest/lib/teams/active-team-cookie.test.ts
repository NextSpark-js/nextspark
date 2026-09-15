/**
 * Active team cookie — a value names its team only for the session that wrote it.
 */
import { activeTeamCookieValue, activeTeamIdForSession } from '@/core/lib/teams/active-team-cookie'

describe('active team cookie', () => {
  test('a value names its team for the session that wrote it, and for no other', () => {
    const value = activeTeamCookieValue('session-1', 'team-a')

    expect(activeTeamIdForSession(value, 'session-1')).toBe('team-a')
    expect(activeTeamIdForSession(value, 'session-2')).toBeNull()
  })

  test.each([
    ['team-a', 'a bare team id, written before values were bound to a session'],
    [':team-a', 'no session'],
    ['session-1:', 'no team'],
    ['', 'nothing'],
    [undefined, 'no cookie'],
  ])('%p names no team (%s)', value => {
    expect(activeTeamIdForSession(value, 'session-1')).toBeNull()
  })

  test('without a session there is no active team', () => {
    expect(activeTeamIdForSession('session-1:team-a', undefined)).toBeNull()
  })
})
