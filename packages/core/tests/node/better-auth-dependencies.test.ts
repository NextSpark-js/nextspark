/**
 * The Better Auth line core pins, kept in lockstep where it is declared: core, apps/dev, the CLI's generated
 * project and create-nextspark-app. The zod the monorepo's override forces must satisfy what the installed Better
 * Auth asks for (an older one fails every auth request at runtime), and @better-fetch/fetch is the exact version
 * Better Auth pins (a peer of @better-auth/core).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { CORE } from './_pg-cutover'

const ROOT = path.resolve(CORE, '../..')
const json = (file: string) => JSON.parse(fs.readFileSync(path.join(ROOT, file), 'utf8'))
const text = (file: string) => fs.readFileSync(path.join(ROOT, file), 'utf8')

const entry = createRequire(path.join(CORE, 'package.json')).resolve('better-auth')
const installed = JSON.parse(fs.readFileSync(path.join(entry.slice(0, entry.lastIndexOf('/dist/')), 'package.json'), 'utf8'))

const parts = (version: string) => version.replace(/^[\^~]/, '').split('.').map(Number)
/** `version` satisfies a caret range (same major, not lower). */
function satisfiesCaret(version: string, range: string) {
  assert.match(range, /^\^\d+\.\d+\.\d+$/, range)
  const [v, r] = [parts(version), parts(range)]
  if (v[0] !== r[0]) return false
  for (let i = 1; i < 3; i++) if (v[i] !== r[i]) return v[i] > r[i]
  return true
}

test('better-auth has one range everywhere core declares it, and the installed one is in it', () => {
  const range = json('packages/core/package.json').dependencies['better-auth']
  assert.match(range, /^~\d+\.\d+\.\d+$/)
  assert.equal(json('apps/dev/package.json').dependencies['better-auth'], range)
  assert.match(text('packages/cli/src/wizard/generators/index.ts'), new RegExp(`'better-auth': '${range}'`))
  assert.match(text('packages/create-nextspark-app/src/create.ts'), new RegExp(`'better-auth@${range}'`))
  const [major, minor, patch] = parts(range)
  const [iMajor, iMinor, iPatch] = parts(installed.version)
  assert.ok(iMajor === major && iMinor === minor && iPatch >= patch, `installed ${installed.version} for ${range}`)
})

test('@better-fetch/fetch is the exact version better-auth pins', () => {
  const pinned = installed.dependencies['@better-fetch/fetch']
  assert.match(pinned, /^\d+\.\d+\.\d+$/)
  assert.equal(json('packages/core/package.json').devDependencies['@better-fetch/fetch'], pinned)
  assert.match(text('packages/cli/src/wizard/generators/index.ts'), new RegExp(`'@better-fetch/fetch': '${pinned}'`))
  assert.match(text('packages/create-nextspark-app/src/create.ts'), new RegExp(`'@better-fetch/fetch@${pinned}'`))
})

test('the zod the monorepo forces, and core\'s and a generated project\'s floor, satisfy better-auth\'s zod', () => {
  const wanted = installed.dependencies.zod
  const forced = json('package.json').pnpm.overrides['zod@^4']
  assert.ok(satisfiesCaret(forced, wanted), `override zod ${forced} for better-auth's ${wanted}`)
  const core = json('packages/core/package.json').dependencies.zod
  assert.ok(satisfiesCaret(core.slice(1), wanted), `core zod ${core} for better-auth's ${wanted}`)
  const generated = text('packages/cli/src/wizard/generators/index.ts').match(/'zod': '(\^[\d.]+)'/)?.[1] ?? ''
  assert.ok(satisfiesCaret(generated.slice(1), wanted), `generated zod ${generated} for better-auth's ${wanted}`)
})
