import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkClientIp } from '../src/doctor/checks/client-ip.js'
// Core's resolver, by path: the doctor must report what core would use
import { getClientIpSource, getClientIpSourceOrigin } from '../../core/src/lib/api/client-ip.ts'

/** The doctor's client address result for a project whose .env holds `dotenv` (and .env.local `local`), with `env` exported. */
async function doctor(dotenv: string, env: NodeJS.ProcessEnv = {}, local?: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-client-ip-'))
  fs.writeFileSync(path.join(dir, '.env'), dotenv)
  if (local !== undefined) fs.writeFileSync(path.join(dir, '.env.local'), local)
  try {
    return await checkClientIp(dir, env)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor reports a set source as coming from the variable, even with VERCEL=1', async () => {
  assert.deepEqual(await doctor('NEXTSPARK_CLIENT_IP_SOURCE=cloudflare\n', { VERCEL: '1' }),
    { name: 'Client address', status: 'pass', message: 'cloudflare (from NEXTSPARK_CLIENT_IP_SOURCE)' })
  assert.equal((await doctor('', { NEXTSPARK_CLIENT_IP_SOURCE: 'header: X-Real-IP' })).message, 'header:x-real-ip (from NEXTSPARK_CLIENT_IP_SOURCE)')
  // The exported variable wins over .env
  assert.equal((await doctor('NEXTSPARK_CLIENT_IP_SOURCE=none\n', { NEXTSPARK_CLIENT_IP_SOURCE: 'xff' })).message, 'xff (from NEXTSPARK_CLIENT_IP_SOURCE)')
})

test('doctor reports vercel as detected when the variable is unset and the runtime sets VERCEL=1', async () => {
  const result = await doctor('# nothing\n', { VERCEL: '1' })
  assert.equal(result.status, 'pass')
  assert.match(result.message, /^vercel \(detected from VERCEL=1/)
})

test('doctor warns when VERCEL=1 comes from a .env file, as `vercel env pull` writes it', async () => {
  for (const [dotenv, local, env] of [
    ['# nothing\n', 'VERCEL="1"\n', {}],
    ['VERCEL=1\n', undefined, {}],
    // the CLI loads .env into process.env at startup, so the same value is also exported
    ['VERCEL=1\n', undefined, { VERCEL: '1' }],
  ] as const) {
    const result = await doctor(dotenv, env, local)
    assert.equal(result.status, 'warn', `${dotenv} ${local}`)
    assert.match(result.message, /^vercel \(detected from VERCEL=1, which comes from a \.env file/)
    assert.match(result.fix ?? '', /remove it from \.env\/\.env\.local or set NEXTSPARK_CLIENT_IP_SOURCE/)
  }
  // A set source does not depend on VERCEL
  assert.equal((await doctor('', {}, 'VERCEL="1"\nNEXTSPARK_CLIENT_IP_SOURCE=xff\n')).status, 'pass')
})

test('doctor warns with the default order, without cf-connecting-ip, when nothing is set', async () => {
  const result = await doctor('# nothing\n', { VERCEL: '0' })
  assert.equal(result.status, 'warn')
  assert.match(result.message, /^default order/)
  assert.doesNotMatch(result.message, /cf-connecting-ip/)
  assert.match(result.fix ?? '', /cloudflare/)
})

test('doctor fails on a value core would refuse', async () => {
  const result = await doctor('NEXTSPARK_CLIENT_IP_SOURCE=vercell\n')
  assert.equal(result.status, 'fail')
  assert.match(result.fix ?? '', /vercel, cloudflare, xff, none or header:<name>/)
  const hops = await doctor('NEXTSPARK_CLIENT_IP_SOURCE=xff\nNEXTSPARK_TRUSTED_PROXY_HOPS=0\n')
  assert.equal(hops.status, 'fail')
  assert.match(hops.message, /NEXTSPARK_TRUSTED_PROXY_HOPS/)
})

test('doctor and core agree on the source, its origin and what is invalid, for every kind of environment', async () => {
  const table: Record<string, string>[] = [
    {},
    { VERCEL: '1' },
    { VERCEL: 'true' },
    { VERCEL: '0' },
    { VERCEL: '' },
    ...['vercel', 'cloudflare', 'none', 'xff', 'VERCEL', ' cloudflare ', 'header:X-Client-Address', 'header: x-real-ip']
      .flatMap(value => [{ NEXTSPARK_CLIENT_IP_SOURCE: value }, { NEXTSPARK_CLIENT_IP_SOURCE: value, VERCEL: '1' }]),
    ...['vercell', 'header:', 'header:bad header', 'x-forwarded-for', 'header:a,b']
      .flatMap(value => [{ NEXTSPARK_CLIENT_IP_SOURCE: value }, { NEXTSPARK_CLIENT_IP_SOURCE: value, VERCEL: '1' }]),
    ...['1', '2', ' 3 ', '', '0', '-1', '1.5', 'two', '01']
      .map(hops => ({ NEXTSPARK_CLIENT_IP_SOURCE: 'xff', NEXTSPARK_TRUSTED_PROXY_HOPS: hops })),
  ]
  for (const env of table) {
    const label = JSON.stringify(env)
    const result = await doctor('', env)
    let core: { source: string; origin: string } | 'fail'
    try {
      const source = getClientIpSource(env)
      core = { source: source.kind === 'header' ? `header:${source.header}` : source.kind, origin: getClientIpSourceOrigin(env) }
    } catch {
      core = 'fail'
    }
    if (core === 'fail') {
      assert.equal(result.status, 'fail', label)
      continue
    }
    assert.notEqual(result.status, 'fail', label)
    const doctorSource = result.message.startsWith('default order') ? 'default' : result.message.split(' ')[0]
    const doctorOrigin = /\(from NEXTSPARK_CLIENT_IP_SOURCE\)/.test(result.message) ? 'variable'
      : /detected from VERCEL=1/.test(result.message) ? 'vercel' : 'default'
    assert.deepEqual({ source: doctorSource, origin: doctorOrigin }, core, label)
  }
})
