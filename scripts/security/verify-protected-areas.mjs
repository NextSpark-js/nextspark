#!/usr/bin/env node
/**
 * Probes a running NextSpark app: /superadmin and /devtools must refuse a visitor without the area's role on the
 * server, whatever the project's proxy does, and send nothing of the area in the refusal.
 *
 * Rules (core's proxy template and area-access): no session -> /login?callbackUrl=..., a session without the role ->
 * /dashboard?error=access_denied; /superadmin lets in superadmin and developer, /devtools only developer.
 *
 * A refusal is a 307/308 to that target. A Cache Components app has already sent its prerendered shell with a 200
 * when the server-side check runs, so it may instead answer 200 with the redirect in the body (a meta refresh in a
 * document, Next's redirect digest in an RSC payload); the report names that form. Either way, no `--forbid` text may
 * be in the body. An allowed identity must get a 200 that is not a redirect.
 *
 * Usage:
 *   node scripts/security/verify-protected-areas.mjs --base-url http://localhost:3000 \
 *     [--cookie member='better-auth.session_token=...'] [--cookie superadmin=...] [--cookie developer=...] \
 *     [--path /superadmin/docs/setup/configuration ...] [--forbid 'Admin Configuration' ...] [--json report.json]
 * Exits 1 when any request breaks the rules.
 */
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

export const DEFAULT_PATHS = ['/superadmin', '/superadmin/docs', '/devtools', '/devtools/api']
const AREA_ROLES = { superadmin: ['superadmin', 'developer'], devtools: ['developer'] }

export function areaOf(path) {
  return Object.keys(AREA_ROLES).find(area => path === `/${area}` || path.startsWith(`/${area}/`)) ?? null
}

/** What the rules expect for `identity` (anonymous, member, superadmin, developer) at `path`. */
export function expectationFor(identity, path) {
  const area = areaOf(path)
  if (!area) throw new Error(`${path} is in no protected area`)
  if (identity === 'anonymous') return { allowed: false, target: '/login' }
  return AREA_ROLES[area].includes(identity) ? { allowed: true } : { allowed: false, target: '/dashboard?error=access_denied' }
}

/** Where the body redirects to on the client (meta refresh or Next's RSC redirect digest), if anywhere. */
export function bodyRedirect(body) {
  const meta = body.match(/http-equiv="refresh"\s+content="\d+;\s*url=([^"]+)"/i)
  if (meta) return meta[1].replace(/&amp;/g, '&')
  const digest = body.match(/NEXT_REDIRECT;(?:replace|push);([^;"\\]+)/)
  return digest ? digest[1] : null
}

function pointsTo(url, target, baseUrl) {
  if (!url) return false
  const resolved = new URL(url, baseUrl)
  const wanted = new URL(target, baseUrl)
  return resolved.origin === wanted.origin && resolved.pathname === wanted.pathname && [...wanted.searchParams].every(([key, value]) => resolved.searchParams.get(key) === value)
}

/**
 * Judge one response. `response`: { status, location, body }. Returns { ok, form, problems }.
 */
export function judge({ response, expectation, forbid = [], baseUrl = 'http://localhost' }) {
  const problems = []
  const { status, location, body } = response
  let form
  if (expectation.allowed) {
    form = status === 200 && !bodyRedirect(body) ? 'served' : `status ${status}${location ? ` -> ${location}` : ''}`
    if (form !== 'served') problems.push(`expected 200 for an allowed identity, got ${form}`)
    return { ok: problems.length === 0, form, problems }
  }
  if ((status === 307 || status === 308) && pointsTo(location, expectation.target, baseUrl)) form = `${status}`
  else if (status === 200 && pointsTo(bodyRedirect(body), expectation.target, baseUrl)) form = '200 + client redirect'
  else form = `status ${status}${location ? ` -> ${location}` : ''}`
  if (!/^30[78]$/.test(form) && form !== '200 + client redirect') problems.push(`expected a redirect to ${expectation.target}, got ${form}`)
  for (const text of forbid) if (body.includes(text)) problems.push(`the body contains ${JSON.stringify(text)}`)
  return { ok: problems.length === 0, form, problems }
}

async function probe(baseUrl, path, cookie, rsc) {
  const headers = { ...(cookie ? { cookie } : {}), ...(rsc ? { RSC: '1' } : {}) }
  let url = new URL(path, baseUrl)
  let res = await fetch(url, { redirect: 'manual', headers })
  // Next sends an RSC request without its cache-busting `_rsc` parameter back to the same path with it: protocol, not a verdict
  const next = rsc && res.headers.get('location') ? new URL(res.headers.get('location'), url) : null
  if (next && next.pathname === url.pathname && next.searchParams.has('_rsc')) {
    url = next
    res = await fetch(url, { redirect: 'manual', headers })
  }
  return { status: res.status, location: res.headers.get('location'), body: await res.text() }
}

export async function verifyProtectedAreas({ baseUrl, cookies = {}, paths = DEFAULT_PATHS, forbid = [] }) {
  const identities = [['anonymous', null], ...Object.entries(cookies)]
  const rows = []
  for (const path of paths) {
    for (const [identity, cookie] of identities) {
      const expectation = expectationFor(identity, path)
      for (const rsc of [false, true]) {
        const response = await probe(baseUrl, path, cookie, rsc)
        const verdict = judge({ response, expectation, forbid, baseUrl })
        rows.push({ path, identity, request: rsc ? 'rsc' : 'document', status: response.status, location: response.location, bytes: response.body.length, ...verdict })
      }
    }
  }
  return { ok: rows.every(row => row.ok), rows }
}

function parseArgs(argv) {
  const options = { cookies: {}, paths: [], forbid: [] }
  for (let index = 0; index < argv.length; index++) {
    const [name, value] = [argv[index], argv[index + 1]]
    if (name === '--base-url') options.baseUrl = value
    else if (name === '--cookie') {
      const at = value.indexOf('=')
      options.cookies[value.slice(0, at)] = value.slice(at + 1)
    } else if (name === '--path') options.paths.push(value)
    else if (name === '--forbid') options.forbid.push(value)
    else if (name === '--json') options.json = value
    else throw new Error(`Unknown argument ${name}`)
    index++
  }
  if (!options.baseUrl) throw new Error('--base-url is required')
  if (options.paths.length === 0) options.paths = DEFAULT_PATHS
  return options
}

async function main() {
  const options = parseArgs(process.argv.slice(2))
  const result = await verifyProtectedAreas(options)
  console.log('| path | identity | request | status | form | ok |\n|---|---|---|---|---|---|')
  for (const row of result.rows) console.log(`| ${row.path} | ${row.identity} | ${row.request} | ${row.status} | ${row.form} | ${row.ok ? 'yes' : `NO: ${row.problems.join('; ')}`} |`)
  if (options.json) await writeFile(options.json, JSON.stringify(result, null, 2) + '\n')
  process.exitCode = result.ok ? 0 : 1
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}
