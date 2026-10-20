import { describe, test, expect } from '@jest/globals'
import { resolveBaseUrl } from '@/core/lib/utils/base-url'

const AUTH = 'https://auth.example.com'
const APP = 'https://app.example.com'
const VERCEL = 'my-app-git-branch.vercel.app'
const LOCAL = 'http://localhost:5173'

describe('resolveBaseUrl', () => {
  // Every combination of BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, VERCEL_URL and VERCEL_ENV.
  const authValues = [undefined, AUTH]
  const appValues = [undefined, APP]
  const vercelUrls = [undefined, VERCEL]
  const vercelEnvs = [undefined, 'preview', 'production', 'development']

  for (const BETTER_AUTH_URL of authValues)
    for (const NEXT_PUBLIC_APP_URL of appValues)
      for (const VERCEL_URL of vercelUrls)
        for (const VERCEL_ENV of vercelEnvs) {
          const expected =
            BETTER_AUTH_URL ??
            NEXT_PUBLIC_APP_URL ??
            (VERCEL_ENV === 'preview' && VERCEL_URL ? `https://${VERCEL_URL}` : LOCAL)
          test(`auth=${!!BETTER_AUTH_URL} app=${!!NEXT_PUBLIC_APP_URL} vercelUrl=${!!VERCEL_URL} env=${VERCEL_ENV}`, () => {
            expect(resolveBaseUrl({ BETTER_AUTH_URL, NEXT_PUBLIC_APP_URL, VERCEL_URL, VERCEL_ENV } as NodeJS.ProcessEnv)).toBe(expected)
          })
        }

  test('production never uses VERCEL_URL', () => {
    expect(resolveBaseUrl({ VERCEL_ENV: 'production', VERCEL_URL: VERCEL } as NodeJS.ProcessEnv)).toBe(LOCAL)
  })

  test('preview without the explicit variables uses VERCEL_URL over https', () => {
    expect(resolveBaseUrl({ VERCEL_ENV: 'preview', VERCEL_URL: VERCEL } as NodeJS.ProcessEnv)).toBe(`https://${VERCEL}`)
  })

  test('empty explicit values count as unset, as before', () => {
    expect(resolveBaseUrl({ BETTER_AUTH_URL: '', NEXT_PUBLIC_APP_URL: '' } as NodeJS.ProcessEnv)).toBe(LOCAL)
  })
})
