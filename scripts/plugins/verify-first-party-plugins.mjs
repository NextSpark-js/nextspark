#!/usr/bin/env node
/**
 * Every first-party plugin enabled at once on a created starter (#472). A route of a plugin that Next's type check rejects
 * (a handler that declares a path parameter its route does not have, say) only shows in `next build` of a project that
 * has the plugin, and the plugin matrix loads fixtures and walkme only. Run it in a project made from the packed tarballs
 * (.github/actions/create-project):
 *
 *   1. every plugin tarball is added with `nextspark add:plugin`, the command a user runs;
 *   2. `nextspark build` runs: the registries are generated and Next type-checks every plugin route.
 *
 * No database is needed. The build gets NEXTSPARK_AUTH_RUNTIME_ONLY, the documented way to build without login credentials,
 * and the plugins' own settings (social-media-publisher's adapter, #476) are not needed to compile: only to run.
 *
 *   node scripts/plugins/verify-first-party-plugins.mjs --app <project>/app --packages <tarball dir> [--logs DIR]
 *
 * Exit 0 the build passed, 1 it failed, 2 usage or environment error.
 */
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { parseArgs } from 'node:util'

const { values } = parseArgs({ options: { app: { type: 'string' }, packages: { type: 'string' }, logs: { type: 'string' } } })
if (!values.app || !values.packages) {
  console.error('usage: verify-first-party-plugins.mjs --app <project dir> --packages <tarball dir> [--logs DIR]')
  process.exit(2)
}
const app = path.resolve(values.app)
const packages = path.resolve(values.packages)
const logs = path.resolve(values.logs ?? path.join(app, '..', 'first-party-plugins-logs'))
const tarballs = existsSync(packages) ? readdirSync(packages).filter(f => /^nextsparkjs-plugin-.*\.tgz$/.test(f)).sort() : []
if (!existsSync(path.join(app, 'nextspark.config.ts')) || tarballs.length === 0) {
  console.error(`${app} is not a NextSpark project, or ${packages} holds no nextsparkjs-plugin-*.tgz`)
  process.exit(2)
}
mkdirSync(logs, { recursive: true })

const env = { ...process.env, CYPRESS_INSTALL_BINARY: '0', NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,google', FORCE_COLOR: '0', NO_COLOR: '1' }
function run(label, command, args) {
  const result = spawnSync(command, args, { cwd: app, env, encoding: 'utf8', maxBuffer: 1 << 28 })
  const output = `${result.stdout ?? ''}${result.stderr ?? ''}`
  writeFileSync(path.join(logs, `${label}.log`), `$ ${command} ${args.join(' ')}\n${output}\nexit ${result.status}\n`)
  if (result.status !== 0) {
    console.log(`FAIL  ${label}\n${output.split('\n').slice(-30).join('\n')}`)
    process.exit(1)
  }
}

console.log(`plugins: ${tarballs.join(', ')}`)

// `nextspark add:plugin` copies a plugin's files into plugins/<name> and lists it in nextspark.config.ts, as create-nextspark-app
// --plugins and a user's own add:plugin do
for (const f of tarballs) run(`add-${f.replace(/^nextsparkjs-plugin-/, '').replace(/-\d.*$/, '')}`, 'pnpm', ['exec', 'nextspark', 'add:plugin', path.join(packages, f)])

run('build', 'pnpm', ['build'])
console.log(`PASS  a project with ${tarballs.length} first-party plugins builds`)
