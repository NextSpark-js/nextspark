/**
 * AuthLoginMethod: the methods core accepts in `auth.methods` (#286), and what the login screen draws for them.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { AuthLoginMethod, SocialLoginMethod } from '../../../src'

const PACKAGE = join(__dirname, '../../..')
const REPO = join(PACKAGE, '../..')

// Compile-time: a method core lists in `auth.methods` is a valid mobile method, anything else is not
const methods: AuthLoginMethod[] = ['email-otp', 'email-password', 'google', 'github', 'microsoft', 'apple']
const social: SocialLoginMethod[] = ['google', 'github', 'microsoft', 'apple']
// @ts-expect-error not a method core knows
const unknown: AuthLoginMethod = 'facebook'

/** The string literals of `export type <name> = ...` in a source file. */
const literals = (file: string, name: string) => {
  const declaration = readFileSync(file, 'utf8').match(new RegExp(`export type ${name} =([^\\n]*)`))
  if (!declaration) throw new Error(`${name} not found in ${file}`)
  return [...declaration[1].matchAll(/'([^']+)'/g)].map((match) => match[1]).sort()
}

describe('AuthLoginMethod', () => {
  it('accepts github, microsoft and apple next to the methods it had', () => {
    expect(methods).toEqual(expect.arrayContaining(['github', 'microsoft', 'apple']))
    expect(social).toHaveLength(4)
    expect(unknown).toBe('facebook')
  })

  it('is the union core declares (core cannot be imported from mobile, so the two are compared as written)', () => {
    const core = join(REPO, 'packages/core/src/lib/config/types.ts')
    const mobile = join(PACKAGE, 'src/api/core/types.ts')
    expect(literals(mobile, 'SocialLoginMethod')).toEqual(literals(core, 'SocialLoginMethod'))
    // `AuthLoginMethod = 'email-otp' | SocialLoginMethod | 'email-password'` in both
    expect(literals(mobile, 'AuthLoginMethod')).toEqual(literals(core, 'AuthLoginMethod'))
  })
})

describe('the login screen of the template', () => {
  const login = readFileSync(join(PACKAGE, 'templates/app/login.tsx'), 'utf8')

  it('names only the methods it has a native flow for, so github, microsoft and apple render nothing', () => {
    const named = new Set([...login.matchAll(/methods\.includes\('([^']+)'\)/g)].map((match) => match[1]))
    expect([...named].sort()).toEqual(['email-otp', 'email-password', 'google'])
    for (const method of ['github', 'microsoft', 'apple']) expect(login).not.toMatch(new RegExp(`['"\`]${method}['"\`]`))
    // a button per method read off the list would draw one for every provider
    expect(login).not.toMatch(/methods\.(map|filter|flatMap|forEach)\(/)
  })

  it('is the screen apps/mobile runs', () => {
    expect(readFileSync(join(REPO, 'apps/mobile/app/login.tsx'), 'utf8')).toBe(login)
  })
})
