/**
 * core's next.config template sends a visitor with no session cookie to login before /superadmin and /devtools render,
 * with a 307, which a Cache Components page cannot answer from rendering. Checked with Next's own matchers: the redirect
 * applies only when neither Better Auth cookie (`__Secure-` over HTTPS, bare over HTTP) is there, so a signed-in user
 * without the role still reaches core's server-side check.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const requireNext = createRequire(path.join(REPO, 'packages/core/package.json'))
const { getPathMatch } = requireNext('next/dist/shared/lib/router/utils/path-match')
const { matchHas, prepareDestination } = requireNext('next/dist/shared/lib/router/utils/prepare-destination')

type Redirect = { source: string; destination: string; permanent: boolean; missing?: Array<{ type: string; key: string }> }

async function templateRedirects(): Promise<Redirect[]> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-next-config-redirects-')))
  try {
    fs.copyFileSync(path.join(REPO, 'packages/core/templates/next.config.mjs'), path.join(root, 'next.config.mjs'))
    fs.mkdirSync(path.join(root, 'node_modules'), { recursive: true })
    fs.symlinkSync(fs.realpathSync(path.join(REPO, 'apps/dev/node_modules/next-intl')), path.join(root, 'node_modules', 'next-intl'), 'dir')
    const { default: config } = await import(pathToFileURL(path.join(root, 'next.config.mjs')).href)
    return await config.redirects()
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
}

/** Where Next's redirect matching sends `pathname` with `cookie`, or null when no redirect applies. */
function redirectFor(redirects: Redirect[], pathname: string, cookie = ''): { destination: string; permanent: boolean } | null {
  const req = { headers: cookie ? { cookie } : {} }
  for (const redirect of redirects) {
    const params = getPathMatch(redirect.source)(pathname)
    if (!params) continue
    const hasParams = matchHas(req, {}, [], redirect.missing ?? [])
    if (!hasParams) continue
    const { newUrl, destQuery } = prepareDestination({ appendParamsToQuery: false, destination: redirect.destination, params: { ...params, ...hasParams }, query: {} })
    const query = new URLSearchParams(destQuery as Record<string, string>).toString()
    return { destination: decodeURIComponent(query ? `${newUrl}?${query}` : newUrl), permanent: redirect.permanent }
  }
  return null
}

test('a visitor without a session cookie is sent to login from every /superadmin and /devtools path, temporarily', async () => {
  const redirects = await templateRedirects()
  assert.deepEqual(redirectFor(redirects, '/superadmin'), { destination: '/login?callbackUrl=/superadmin', permanent: false })
  assert.deepEqual(redirectFor(redirects, '/superadmin/docs/setup/configuration'), { destination: '/login?callbackUrl=/superadmin/docs/setup/configuration', permanent: false })
  assert.deepEqual(redirectFor(redirects, '/devtools'), { destination: '/login?callbackUrl=/devtools', permanent: false })
  assert.deepEqual(redirectFor(redirects, '/devtools/api'), { destination: '/login?callbackUrl=/devtools/api', permanent: false })
})

test('either Better Auth session cookie lets the request through to core’s role check', async () => {
  const redirects = await templateRedirects()
  for (const cookie of ['__Secure-better-auth.session_token=abc.def', 'better-auth.session_token=abc.def', 'theme=dark; better-auth.session_token=x']) {
    assert.equal(redirectFor(redirects, '/superadmin/users', cookie), null, cookie)
    assert.equal(redirectFor(redirects, '/devtools', cookie), null, cookie)
  }
  assert.notEqual(redirectFor(redirects, '/devtools', 'theme=dark; better-auth.session_data=x'), null, 'another Better Auth cookie is not a session')
})

test('other paths are untouched, including look-alike prefixes', async () => {
  const redirects = await templateRedirects()
  for (const pathname of ['/', '/dashboard', '/login', '/superadmin-guide', '/devtools-tips', '/docs/setup/configuration', '/api/superadmin/users']) {
    assert.equal(redirectFor(redirects, pathname), null, pathname)
  }
})
