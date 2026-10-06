/**
 * The client address comes from one place, lib/api/client-ip, which reads the source the deployment configured.
 * No other source file in core, its plugins, themes or project templates reads a client address header itself.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const HELPER = 'packages/core/src/lib/api/client-ip.ts'
// A client address header named as a string, the connection's address, or Express/old-Next style request.ip
const CLIENT_ADDRESS_READ = new RegExp([
  /['"`](x-forwarded-for|forwarded|x-real-ip|cf-connecting-ip|true-client-ip|x-vercel-forwarded-for|x-client-ip|fastly-client-ip|x-azure-clientip|x-cluster-client-ip)['"`]/.source,
  /\.remoteAddress\b/.source,
  /\b(req|request)\.ip\b/.source,
].join('|'), 'i')

const SOURCES = execFileSync(
  'git',
  ['ls-files', '--cached', '--others', '--exclude-standard', '--',
    ...['packages/core/src', 'packages/core/templates', 'plugins', 'themes', 'apps/dev']
      .flatMap(dir => ['ts', 'tsx', 'js', 'mjs'].map(ext => `${dir}/**/*.${ext}`))],
  { cwd: REPO, encoding: 'utf8' }
).split('\n').filter(file => file && !/(^|\/)(tests?|__tests__|cypress)\/|\.(test|spec|cy)\.[cm]?[jt]sx?$|\.d\.ts$/.test(file))

test('only lib/api/client-ip reads client address headers', () => {
  assert.ok(SOURCES.length > 200, `found ${SOURCES.length} source files`)
  assert.ok(SOURCES.includes(HELPER))
  const readers = SOURCES.filter(file => file !== HELPER && CLIENT_ADDRESS_READ.test(fs.readFileSync(path.join(REPO, file), 'utf8')))
  assert.deepEqual(readers, [])
})
