/**
 * dashboard.homeRoute of app.config: the landing route of a signed-in user, per role.
 * Without it everything keeps going to /dashboard; a value that leaves the app is refused.
 */
import { assertHomeRoute, resolveHomeRoute, accessDeniedPath } from '@/core/lib/auth/home-route'

describe('resolveHomeRoute', () => {
  test('without the option the landing route is /dashboard', () => {
    expect(resolveHomeRoute(undefined, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({}, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({ homeRoute: undefined }, undefined)).toBe('/dashboard')
  })

  test('a string applies to every role', () => {
    const config = { homeRoute: '/dashboard/tasks' }
    expect(resolveHomeRoute(config, 'member')).toBe('/dashboard/tasks')
    expect(resolveHomeRoute(config, 'superadmin')).toBe('/dashboard/tasks')
    expect(resolveHomeRoute(config, undefined)).toBe('/dashboard/tasks')
  })

  test('a map picks the entry of the role', () => {
    const config = { homeRoute: { default: '/dashboard/tasks', superadmin: '/superadmin' } }
    expect(resolveHomeRoute(config, 'superadmin')).toBe('/superadmin')
    expect(resolveHomeRoute(config, 'member')).toBe('/dashboard/tasks')
  })

  test('a role missing from the map uses default, and /dashboard when there is no default', () => {
    expect(resolveHomeRoute({ homeRoute: { superadmin: '/superadmin' } }, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({ homeRoute: { default: '/x', superadmin: '/superadmin' } }, null)).toBe('/x')
  })

  test('a role named like an object property does not read the prototype', () => {
    expect(resolveHomeRoute({ homeRoute: { default: '/x' } }, 'constructor')).toBe('/x')
    expect(resolveHomeRoute({ homeRoute: {} }, '__proto__')).toBe('/dashboard')
  })

  test.each(['https://evil.example/x', '//evil.example/x', '/\\evil.example', 'dashboard/tasks', '', '/%2e%2e//evil.example'])(
    'a value that is not an in-app path (%p) falls back to /dashboard',
    (value) => {
      expect(resolveHomeRoute({ homeRoute: value }, 'member')).toBe('/dashboard')
      expect(resolveHomeRoute({ homeRoute: { default: value } }, 'member')).toBe('/dashboard')
    }
  )

  test('a non-string entry falls back to /dashboard', () => {
    expect(resolveHomeRoute({ homeRoute: 42 }, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({ homeRoute: { member: { a: 1 } } }, 'member')).toBe('/dashboard')
  })

  test('keeps the query of the path', () => {
    expect(resolveHomeRoute({ homeRoute: '/dashboard/tasks?view=mine' }, 'member')).toBe('/dashboard/tasks?view=mine')
  })
})

describe('restricted areas and trailing slashes', () => {
  test.each(['/superadmin', '/admin/settings', '/devtools?x=1'])('%s is not a landing route for a role that cannot open it', (path) => {
    expect(resolveHomeRoute({ homeRoute: path }, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({ homeRoute: { default: path } }, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({ homeRoute: path }, undefined)).toBe('/dashboard')
  })

  test('a role that can open the area keeps it', () => {
    const config = { homeRoute: { default: '/dashboard', superadmin: '/superadmin', developer: '/devtools' } }
    expect(resolveHomeRoute(config, 'superadmin')).toBe('/superadmin')
    expect(resolveHomeRoute(config, 'developer')).toBe('/devtools')
    expect(resolveHomeRoute({ homeRoute: '/devtools' }, 'superadmin')).toBe('/dashboard')
  })

  test('the access-denied path never points at the area that denied the user', () => {
    expect(accessDeniedPath({ homeRoute: '/superadmin' }, 'member')).toBe('/dashboard?error=access_denied')
    expect(accessDeniedPath({ homeRoute: { default: '/devtools' } }, 'superadmin')).toBe('/dashboard?error=access_denied')
  })

  test('a trailing slash is dropped, so /dashboard/ is the dashboard', () => {
    expect(resolveHomeRoute({ homeRoute: '/dashboard/' }, 'member')).toBe('/dashboard')
    expect(resolveHomeRoute({ homeRoute: '/dashboard/tasks/?view=1' }, 'member')).toBe('/dashboard/tasks?view=1')
  })
})

describe('assertHomeRoute', () => {
  test('accepts no option, a path and a map of paths', () => {
    expect(() => assertHomeRoute(undefined)).not.toThrow()
    expect(() => assertHomeRoute({})).not.toThrow()
    expect(() => assertHomeRoute({ homeRoute: '/dashboard/tasks' })).not.toThrow()
    expect(() => assertHomeRoute({ homeRoute: { default: '/dashboard', superadmin: '/superadmin' } })).not.toThrow()
  })

  test.each([
    ['an absolute URL', 'https://evil.example/x'],
    ['a protocol-relative URL', '//evil.example/x'],
    ['a // path', '//dashboard'],
    ['a backslash host', '/\\evil.example'],
    ['a relative path', 'dashboard'],
    ['an empty string', ''],
    ['a number', 7],
    ['null', null],
  ])('refuses %s with a message that names the option', (_name, value) => {
    expect(() => assertHomeRoute({ homeRoute: value })).toThrow(/dashboard\.homeRoute must be a path inside the app/)
  })

  test('refuses a bad entry of a map and names its role', () => {
    expect(() => assertHomeRoute({ homeRoute: { default: '/dashboard', member: 'https://evil.example' } })).toThrow(
      /dashboard\.homeRoute\["member"\] must be a path inside the app/
    )
  })
})

describe('accessDeniedPath', () => {
  test('without the option it is the dashboard with the error, as before', () => {
    expect(accessDeniedPath(undefined, 'member')).toBe('/dashboard?error=access_denied')
  })

  test('goes to the landing route of the role', () => {
    const config = { homeRoute: { default: '/dashboard/tasks', admin: '/dashboard/team?tab=1' } }
    expect(accessDeniedPath(config, 'member')).toBe('/dashboard/tasks?error=access_denied')
    expect(accessDeniedPath(config, 'admin')).toBe('/dashboard/team?tab=1&error=access_denied')
  })
})
