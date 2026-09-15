/**
 * safeCallbackPath — only a path on this app is a place to return to after
 * signing in; anything that resolves to another origin is dropped.
 */
import { safeCallbackPath } from '@/core/lib/auth/callback-url'

describe('safeCallbackPath', () => {
  test.each([
    ['/dashboard', '/dashboard'],
    ['/superadmin/users?page=2&search=admin', '/superadmin/users?page=2&search=admin'],
    ['/docs/intro?section=install#setup', '/docs/intro?section=install#setup'],
    ['/%2F%2Fevil.example', '/%2F%2Fevil.example'],
  ])('keeps the in-app path %s', (value, expected) => {
    expect(safeCallbackPath(value)).toBe(expected)
  })

  test.each([
    ['//evil.example/phish'],
    ['/%2e%2e//evil.example/phish'],
    ['/.//evil.example/phish'],
    ['/app/..//evil.example/phish'],
    ['/\\evil.example/phish'],
    ['/\t/evil.example/phish'],
    ['https://evil.example/phish'],
    ['javascript:alert(1)'],
    ['dashboard'],
    [''],
    [null],
    [undefined],
  ])('drops %p', value => {
    expect(safeCallbackPath(value)).toBeNull()
  })
})
