/**
 * @jest-environment jsdom
 *
 * Session hint — a readable cookie that records whether the browser was last
 * seen signed in.
 */
import { hasSessionHint, setSessionHint, SESSION_HINT_COOKIE } from '@/core/lib/auth/session-hint'

beforeEach(() => {
  document.cookie = `${SESSION_HINT_COOKIE}=; Max-Age=0; Path=/`
})

describe('session hint', () => {
  test('is absent until set, and gone once cleared', () => {
    expect(hasSessionHint()).toBe(false)

    setSessionHint(true)
    expect(hasSessionHint()).toBe(true)
    expect(document.cookie).toContain(`${SESSION_HINT_COOKIE}=1`)

    setSessionHint(false)
    expect(hasSessionHint()).toBe(false)
  })

  test('a cookie whose name only starts the same does not count', () => {
    document.cookie = `${SESSION_HINT_COOKIE}_other=1; Path=/`
    expect(hasSessionHint()).toBe(false)
    document.cookie = `${SESSION_HINT_COOKIE}_other=; Max-Age=0; Path=/`
  })
})
