import { describe, test, expect, afterEach } from '@jest/globals'
import { resolveAppUrl, resolveBaseUrl } from '@/core/lib/utils/base-url'

const AUTH = 'https://auth.example.com'
const APP = 'https://app.example.com'
const VERCEL = 'my-app-git-branch.vercel.app'
const LOCAL = 'http://localhost:5173'

type Env = Parameters<typeof resolveBaseUrl>[0]

describe('resolveAppUrl / resolveBaseUrl', () => {
  // Every combination of BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, VERCEL_URL and VERCEL_ENV.
  const authValues = [undefined, AUTH]
  const appValues = [undefined, APP]
  const vercelUrls = [undefined, VERCEL]
  const vercelEnvs = [undefined, 'preview', 'production', 'development']

  for (const BETTER_AUTH_URL of authValues)
    for (const NEXT_PUBLIC_APP_URL of appValues)
      for (const VERCEL_URL of vercelUrls)
        for (const VERCEL_ENV of vercelEnvs) {
          const appExpected =
            NEXT_PUBLIC_APP_URL ??
            (VERCEL_ENV === 'preview' && VERCEL_URL ? `https://${VERCEL_URL}` : LOCAL)
          const env: Env = { BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, VERCEL_URL, VERCEL_ENV }
          test(`auth=${!!BETTER_AUTH_URL} app=${!!NEXT_PUBLIC_APP_URL} vercelUrl=${!!VERCEL_URL} env=${VERCEL_ENV}`, () => {
            expect(resolveAppUrl(env)).toBe(appExpected)
            expect(resolveBaseUrl(env)).toBe(BETTER_AUTH_URL ?? appExpected)
          })
        }

  test('production never uses VERCEL_URL', () => {
    expect(resolveBaseUrl({ VERCEL_ENV: 'production', VERCEL_URL: VERCEL })).toBe(LOCAL)
    expect(resolveAppUrl({ VERCEL_ENV: 'production', VERCEL_URL: VERCEL })).toBe(LOCAL)
  })

  test('preview without the explicit variables uses VERCEL_URL over https', () => {
    expect(resolveBaseUrl({ VERCEL_ENV: 'preview', VERCEL_URL: VERCEL })).toBe(`https://${VERCEL}`)
  })

  test('empty explicit values count as unset, as before', () => {
    expect(resolveBaseUrl({ BETTER_AUTH_URL: '', NEXT_PUBLIC_APP_URL: '' })).toBe(LOCAL)
  })

  test('BETTER_AUTH_URL keeps its path; the app URL does not take it', () => {
    const env: Env = { BETTER_AUTH_URL: 'https://auth.example.com/base', NEXT_PUBLIC_APP_URL: APP }
    expect(resolveBaseUrl(env)).toBe('https://auth.example.com/base')
    expect(resolveAppUrl(env)).toBe(APP)
  })

  test('VERCEL_URL is normalized: scheme, trailing slashes and spaces dropped', () => {
    for (const value of [` ${VERCEL}/ `, `https://${VERCEL}`, `http://${VERCEL}//`]) {
      expect(resolveAppUrl({ VERCEL_ENV: 'preview', VERCEL_URL: value })).toBe(`https://${VERCEL}`)
    }
    expect(resolveAppUrl({ VERCEL_ENV: 'preview', VERCEL_URL: ' / ' })).toBe(LOCAL)
  })

  describe('default environment (process.env at call time)', () => {
    const keys = ['BETTER_AUTH_URL', 'NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_URL'] as const
    const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))
    afterEach(() => {
      for (const k of keys) {
        if (saved[k] === undefined) delete process.env[k]
        else process.env[k] = saved[k]
      }
    })

    test('reads the four variables from process.env when no env is given', () => {
      delete process.env.BETTER_AUTH_URL
      delete process.env.NEXT_PUBLIC_APP_URL
      process.env.VERCEL_ENV = 'preview'
      process.env.VERCEL_URL = VERCEL
      expect(resolveBaseUrl()).toBe(`https://${VERCEL}`)
      process.env.NEXT_PUBLIC_APP_URL = APP
      expect(resolveAppUrl()).toBe(APP)
      process.env.BETTER_AUTH_URL = AUTH
      expect(resolveBaseUrl()).toBe(AUTH)
    })
  })
})
