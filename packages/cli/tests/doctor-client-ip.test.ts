import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkClientIp } from '../src/doctor/checks/client-ip.js'

/** The doctor's client address result for a project whose .env holds `dotenv`, with `env` exported. */
async function doctor(dotenv: string, env: NodeJS.ProcessEnv = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-client-ip-'))
  fs.writeFileSync(path.join(dir, '.env'), dotenv)
  try {
    return await checkClientIp(dir, env)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor reports a set source as coming from the variable, even with VERCEL=1', async () => {
  assert.deepEqual(await doctor('NEXTSPARK_CLIENT_IP_SOURCE=cloudflare\n', { VERCEL: '1' }),
    { name: 'Client address', status: 'pass', message: 'cloudflare (from NEXTSPARK_CLIENT_IP_SOURCE)' })
  assert.equal((await doctor('', { NEXTSPARK_CLIENT_IP_SOURCE: 'header:X-Real-IP' })).message, 'header:x-real-ip (from NEXTSPARK_CLIENT_IP_SOURCE)')
  // The exported variable wins over .env
  assert.equal((await doctor('NEXTSPARK_CLIENT_IP_SOURCE=none\n', { NEXTSPARK_CLIENT_IP_SOURCE: 'xff' })).message, 'xff (from NEXTSPARK_CLIENT_IP_SOURCE)')
})

test('doctor reports vercel as detected when the variable is unset and VERCEL=1', async () => {
  const result = await doctor('VERCEL=1\n')
  assert.equal(result.status, 'pass')
  assert.match(result.message, /^vercel \(detected from VERCEL=1/)
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
})
