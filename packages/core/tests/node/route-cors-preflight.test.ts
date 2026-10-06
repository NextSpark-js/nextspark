/**
 * Without an OPTIONS export, Next.js answers a route's preflight itself, with no CORS headers, while
 * withRateLimitTier gives the route's responses core's CORS. Every Route Handler that core, its plugins and
 * its project templates ship wrapped in withRateLimitTier therefore exports OPTIONS, except webhooks
 * (server to server, no CORS).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')

// The tier argument closes the withRateLimitTier call: `withRateLimitTier(handler, 'webhook')`
const WEBHOOK_TIER = /withRateLimitTier\s*[<(][\s\S]*?,\s*'webhook'\s*\)/
const WRAPPED = /withRateLimitTier\s*[<(]/

const ROUTES = execFileSync(
  'git',
  ['ls-files', '--', 'packages/core/src/routes/api/**/route.ts', 'packages/core/templates/projects/**/route.ts', 'plugins/**/route.ts', 'apps/dev/api/**/route.ts'],
  { cwd: REPO, encoding: 'utf8' }
).split('\n').filter(Boolean)

test('every route wrapped in withRateLimitTier, but webhooks, exports OPTIONS', () => {
  assert.ok(ROUTES.length > 50, `found ${ROUTES.length} route files`)
  const missing = ROUTES.filter(file => {
    const source = fs.readFileSync(path.join(REPO, file), 'utf8')
    if (!WRAPPED.test(source) || WEBHOOK_TIER.test(source)) return false
    return !/export (const|async function|function) OPTIONS\b|export \{[^}]*\bOPTIONS\b[^}]*\}/.test(source)
  })
  assert.deepEqual(missing, [])
})

test('webhook routes export no OPTIONS', () => {
  const webhooks = ROUTES.filter(file => WEBHOOK_TIER.test(fs.readFileSync(path.join(REPO, file), 'utf8')))
  assert.ok(webhooks.length >= 2)
  for (const file of webhooks) assert.doesNotMatch(fs.readFileSync(path.join(REPO, file), 'utf8'), /\bOPTIONS\b/, file)
})
