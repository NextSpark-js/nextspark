/**
 * The CSP report endpoint and the social OAuth callback follow the shared app URL (#349), as the sitemap and
 * robots routes do in their own tests. With NEXT_PUBLIC_APP_URL set they are unchanged; a preview deployment
 * without it uses VERCEL_URL.
 */
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals'

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ checkDistributedRateLimit: jest.fn(), createRateLimitErrorResponse: jest.fn() }))

import { OPTIONS as cspPreflight } from '@/core/routes/api/csp-report/route'
import { getOAuthConfig } from '../../../../../plugins/social-media-publisher/lib/oauth-helper'

const VERCEL = 'my-app-git-branch.vercel.app'
const keys = ['NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_URL', 'FACEBOOK_CLIENT_ID', 'FACEBOOK_CLIENT_SECRET'] as const
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))

// [label, env, expected app URL]
const cases: Array<[string, Partial<Record<(typeof keys)[number], string>>, string]> = [
  ['variable set', { NEXT_PUBLIC_APP_URL: 'https://app.example.com', VERCEL_ENV: 'preview', VERCEL_URL: VERCEL }, 'https://app.example.com'],
  ['preview without the variable', { VERCEL_ENV: 'preview', VERCEL_URL: VERCEL }, `https://${VERCEL}`],
]

beforeEach(() => {
  process.env.FACEBOOK_CLIENT_ID = 'id'
  process.env.FACEBOOK_CLIENT_SECRET = 'secret'
})

afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

describe.each(cases)('%s', (_label, env, appUrl) => {
  beforeEach(() => {
    for (const k of ['NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_URL'] as const) delete process.env[k]
    Object.assign(process.env, env)
  })

  test('the CSP report preflight allows the app origin', async () => {
    expect((await cspPreflight()).headers.get('Access-Control-Allow-Origin')).toBe(appUrl)
  })

  test('the social OAuth redirect URI starts at the app URL', () => {
    expect(getOAuthConfig().redirectUri).toBe(`${appUrl}/api/plugins/social-media-publisher/social/connect/callback`)
  })
})
