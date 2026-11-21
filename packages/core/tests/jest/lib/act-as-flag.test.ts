/**
 * #524: the API Explorer asks isActAsEnabled() whether the server honours act-as; it is the same condition as gates 1a and
 * 1b of applyActAsOverride (not a production runtime, and ALLOW_ACT_AS_USER set).
 */
import { isActAsEnabled, isProductionRuntime } from '../../../src/lib/api/auth/act-as-flag'

const KEYS = ['NODE_ENV', 'VERCEL_ENV', 'ALLOW_ACT_AS_USER'] as const
const saved: Record<string, string | undefined> = {}
beforeEach(() => KEYS.forEach((k) => ((saved[k] = process.env[k]), delete process.env[k])))
afterEach(() => KEYS.forEach((k) => (saved[k] === undefined ? delete process.env[k] : ((process.env as Record<string, string>)[k] = saved[k] as string))))
const set = (env: Record<string, string>) => Object.assign(process.env, env)

test('off without the flag', () => {
  set({ NODE_ENV: 'development' })
  expect(isActAsEnabled()).toBe(false)
})

test('off unless the flag is exactly "true"', () => {
  set({ NODE_ENV: 'development', ALLOW_ACT_AS_USER: '1' })
  expect(isActAsEnabled()).toBe(false)
})

test('on in development with the flag', () => {
  set({ NODE_ENV: 'development', ALLOW_ACT_AS_USER: 'true' })
  expect(isActAsEnabled()).toBe(true)
})

test('never in a production runtime, flag or not', () => {
  set({ NODE_ENV: 'production', ALLOW_ACT_AS_USER: 'true' })
  expect(isProductionRuntime()).toBe(true)
  expect(isActAsEnabled()).toBe(false)
})

test('on Vercel it keys on VERCEL_ENV: a preview can opt in, production cannot', () => {
  set({ NODE_ENV: 'production', VERCEL_ENV: 'preview', ALLOW_ACT_AS_USER: 'true' })
  expect(isActAsEnabled()).toBe(true)
  set({ VERCEL_ENV: 'production' })
  expect(isActAsEnabled()).toBe(false)
})
