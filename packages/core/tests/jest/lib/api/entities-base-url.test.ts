/**
 * @jest-environment node
 *
 * EntityApiClient on the server resolves relative endpoints against the app URL (#315).
 */
import { test, expect, afterEach, jest } from '@jest/globals'
import { EntityApiClient } from '@/core/lib/api/entities'

const keys = ['NEXT_PUBLIC_APP_URL', 'VERCEL_ENV', 'VERCEL_URL'] as const
const saved = Object.fromEntries(keys.map(k => [k, process.env[k]]))

afterEach(() => {
  for (const k of keys) {
    if (saved[k] === undefined) delete process.env[k]
    else process.env[k] = saved[k]
  }
})

test.each([
  ['the variable set', { NEXT_PUBLIC_APP_URL: 'https://app.example.com', VERCEL_ENV: 'preview', VERCEL_URL: 'p.vercel.app' }, 'https://app.example.com'],
  ['a preview without it', { VERCEL_ENV: 'preview', VERCEL_URL: 'p.vercel.app' }, 'https://p.vercel.app'],
  ['production without it', { VERCEL_ENV: 'production', VERCEL_URL: 'p.vercel.app' }, 'http://localhost:5173'],
])('with %s a list request goes to %s', async (_label, env, origin) => {
  for (const k of keys) delete process.env[k]
  Object.assign(process.env, env)
  const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ data: [], meta: {} }) }))
  ;(globalThis as { fetch: unknown }).fetch = fetchMock

  await new EntityApiClient().list('tasks').catch(() => undefined)

  const url = (fetchMock.mock.calls[0] as unknown as [string])[0]
  expect(url.startsWith(`${origin}/`)).toBe(true)
})
