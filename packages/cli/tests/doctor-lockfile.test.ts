import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkDuplicateDependencies, checkZodBelowCore } from '../src/doctor/checks/lockfile.js'
import { checkQueryClients } from '../src/doctor/checks/query-client.js'

const lockfile = (next: string[], zod: string[]) => `lockfileVersion: '9.0'

importers:

  .:
    dependencies:
      next:
        specifier: ^16.4.0
        version: ${next[0]}(react@19.2.4)
      zod:
        specifier: ^4.6.7
        version: ${zod[0]}
${next[1] || zod[1] ? `
  plugins/crm:
    dependencies:
      next:
        specifier: ~16.3.8
        version: ${next[1] ?? next[0]}(react@19.2.4)
      zod:
        specifier: 4.3.6
        version: ${zod[1] ?? zod[0]}
` : ''}
packages:

${[...new Set(next)].map(v => `  next@${v}:\n    resolution: {integrity: x}\n`).join('\n')}
${[...new Set(zod)].map(v => `  zod@${v}:\n    resolution: {integrity: x}\n`).join('\n')}
snapshots:

  next@${next[0]}(react@19.2.4): {}
`

/** A project dir with the given lockfile, an installed core whose zod range is ^4.5.4, and extra files. */
async function inProject<T>(lock: string | null, files: Record<string, string>, run: () => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-lock-'))
  const write = (file: string, content: string) => {
    fs.mkdirSync(path.dirname(path.join(dir, file)), { recursive: true })
    fs.writeFileSync(path.join(dir, file), content)
  }
  if (lock) write('pnpm-lock.yaml', lock)
  write('node_modules/@nextsparkjs/core/package.json', JSON.stringify({ dependencies: { zod: '^4.5.4' } }))
  for (const [file, content] of Object.entries(files)) write(file, content)
  const previous = process.cwd()
  process.chdir(dir)
  try {
    return await run()
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor warns NS_DUPLICATE_DEPENDENCY when the lockfile has two next, naming the importer and the fix', async () => {
  const result = await inProject(lockfile(['16.4.2', '16.3.8'], ['4.6.7']), {}, checkDuplicateDependencies)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_DUPLICATE_DEPENDENCY')
  assert.match(result.message, /next 16\.3\.8 \(plugins\/crm\) and 16\.4\.2 \(\.\)/)
  assert.match(result.fix ?? '', /pnpm add --filter \.\/plugins\/crm next@'\^16\.4\.2'/)
})

test('doctor passes when the lockfile has one version of next, better-auth and zod', async () => {
  assert.equal((await inProject(lockfile(['16.4.2'], ['4.6.7']), {}, checkDuplicateDependencies)).status, 'pass')
})

test('doctor fails NS_ZOD_BELOW_CORE for a zod below the range of core, and passes inside it', async () => {
  const failed = await inProject(lockfile(['16.4.2'], ['4.6.7', '4.3.6']), {}, checkZodBelowCore)
  assert.equal(failed.status, 'fail')
  assert.equal(failed.code, 'NS_ZOD_BELOW_CORE')
  assert.match(failed.message, /4\.3\.6 is below core's \^4\.5\.4/)
  assert.match(failed.fix ?? '', /pnpm add --filter \.\/plugins\/crm zod@'\^4\.5\.4'/)
  assert.equal((await inProject(lockfile(['16.4.2'], ['4.6.7']), {}, checkZodBelowCore)).status, 'pass')
})

test('doctor warns NS_QUERY_CLIENT_NOT_REGISTERED with file:line, and skips registered, generated and installed code', async () => {
  const unregistered = "import { QueryClient } from '@tanstack/react-query'\nexport const client = new QueryClient()\n"
  const registered = unregistered + "registerQueryCache(() => client.clear())\n"
  const result = await inProject(null, {
    'components/cache.tsx': unregistered,
    'components/ok.tsx': registered,
    'src/app/generated.tsx': unregistered,
    'node_modules/pkg/index.js': unregistered,
  }, checkQueryClients)
  assert.equal(result.status, 'warn')
  assert.equal(result.code, 'NS_QUERY_CLIENT_NOT_REGISTERED')
  assert.match(result.message, /\(components\/cache\.tsx:2\)/)
  assert.doesNotMatch(result.message, /ok\.tsx|generated|node_modules/)
  assert.equal((await inProject(null, { 'components/ok.tsx': registered }, checkQueryClients)).status, 'pass')
})
