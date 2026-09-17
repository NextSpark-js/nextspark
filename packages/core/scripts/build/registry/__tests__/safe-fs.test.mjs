/**
 * Tests for safe-fs, the one way the generator changes the file system: each of
 * its calls refuses a path out of its root, through a symlink or into a file
 * with other hard links, and changes nothing anywhere when it does; the build's
 * steps that write refuse through it even when the check the build runs first
 * is not asked; and no file of the generator changes the file system any other
 * way.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/safe-fs.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { link, lstat, mkdir, mkdtemp, readdir, readFile, readlink, realpath, rm, symlink, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { isUnsafeWrite, projectFiles, UNSAFE_WRITE, unsafeWriteProblem } from '../../safe-fs.mjs'
import { cleanupDeletedTemplate, cleanupOldRouteFiles, cleanupOrphanedTemplates } from '../post-build/route-cleanup.mjs'
import { generateTestBlocksJson, generateTestEntitiesJson } from '../post-build/test-fixtures.mjs'
import { generateMissingPages } from '../post-build/page-generator.mjs'
import { syncAppGlobalsCss } from '../../theme.mjs'
import { directFsWrites, directFsWritesIn, generatorFiles } from './direct-fs-writes.mjs'

const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')

async function directory() {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-safe-fs-test-'))
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

async function writeIn(root, path, content = '') {
  await mkdir(dirname(join(root, path)), { recursive: true })
  await writeFile(join(root, path), content)
}

/** Every entry under `root`: a symlink's target, 'dir', or a file's sha256. */
async function snapshot(root) {
  const entries = {}
  const walk = async relative => {
    for (const entry of await readdir(join(root, relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name
      const stats = await lstat(join(root, path))
      if (stats.isSymbolicLink()) entries[path] = `-> ${await readlink(join(root, path))}`
      else if (stats.isDirectory()) {
        entries[path] = 'dir'
        await walk(path)
      } else entries[path] = createHash('sha256').update(await readFile(join(root, path))).digest('hex')
    }
  }
  await walk('')
  return entries
}

/** What `call` throws, or null. */
async function thrown(call) {
  try {
    await call()
    return null
  } catch (error) {
    return error
  }
}

test('each call refuses a path through a symlink, out of the root or into a hard-linked file, and changes nothing inside or outside', async () => {
  const project = await directory()
  const outside = await directory()
  try {
    await writeIn(outside.root, 'target/file.txt', 'outside\n')
    await writeIn(outside.root, 'target/v1/plugin/legacy/route.ts', '// Auto-generated Plugin Route Proxy\n')
    await writeIn(outside.root, 'lone.txt', 'outside\n')
    await writeIn(project.root, 'app/page.tsx', 'inside\n')
    await symlink(join(outside.root, 'target'), join(project.root, 'app/linked'))
    await symlink(join(outside.root, 'lone.txt'), join(project.root, 'app/lone.txt'))
    await link(join(outside.root, 'lone.txt'), join(project.root, 'hard.txt'))
    await writeIn(project.root, 'source.txt', 'source\n')

    const files = projectFiles(project.root)
    const cases = [
      ['writeFileSync through a symlinked directory', () => files.writeFileSync(join(project.root, 'app/linked/file.txt'), 'x'), 'app/linked', 'is a symlink'],
      ['writeFile onto a symlink', () => files.writeFile(join(project.root, 'app/lone.txt'), 'x'), 'app/lone.txt', 'is a symlink'],
      ['writeFile into a hard-linked file', () => files.writeFile(join(project.root, 'hard.txt'), 'x'), 'hard.txt', 'has other hard links'],
      ['writeFile with wx through a symlink', () => files.writeFile(join(project.root, 'app/linked/new.txt'), 'x', { flag: 'wx' }), 'app/linked', 'is a symlink'],
      ['writeFile out of the root with ..', () => files.writeFile('app/linked/../../../escape.txt', 'x'), null, null],
      ['writeFile to the root itself', () => files.writeFile(project.root, 'x'), '.', 'is the root itself, which is not changed'],
      ['writeFile to an absolute path outside', () => files.writeFile(join(outside.root, 'lone.txt'), 'x'), null, null],
      ['mkdirSync through a symlink', () => files.mkdirSync(join(project.root, 'app/linked/made'), { recursive: true }), 'app/linked', 'is a symlink'],
      ['mkdtemp beside a path through a symlink', () => files.mkdtemp(join(project.root, 'app/linked/backup-')), 'app/linked', 'is a symlink'],
      ['copyFile to a path through a symlink', () => files.copyFile(join(project.root, 'source.txt'), join(project.root, 'app/linked/copy.txt')), 'app/linked', 'is a symlink'],
      ['rm of a tree through a symlink', () => files.rm(join(project.root, 'app/linked/v1/plugin/legacy'), { recursive: true, force: true }), 'app/linked', 'is a symlink'],
      ['rm of the symlink itself', () => files.rm(join(project.root, 'app/linked'), { recursive: true, force: true }), 'app/linked', 'is a symlink'],
      ['rmdir through a symlink', () => files.rmdir(join(project.root, 'app/linked/v1')), 'app/linked', 'is a symlink'],
      ['unlink through a symlink', () => files.unlink(join(project.root, 'app/linked/file.txt')), 'app/linked', 'is a symlink'],
      ['rename out through a symlink', () => files.rename(join(project.root, 'app/page.tsx'), join(project.root, 'app/linked/page.tsx')), 'app/linked', 'is a symlink'],
      ['rename in from a symlink', () => files.rename(join(project.root, 'app/linked/file.txt'), join(project.root, 'app/file.txt')), 'app/linked', 'is a symlink'],
      ['a path from the root through a symlink', () => files.writeFile('app/linked/file.txt', 'x'), 'app/linked', 'is a symlink'],
    ]

    const before = { project: await snapshot(project.root), outside: await snapshot(outside.root) }
    const wrong = []
    for (const [label, call, path, problem] of cases) {
      const error = await thrown(call)
      if (!isUnsafeWrite(error)) {
        wrong.push(`${label}: ${error ? `threw ${error.code} ${error.message}` : 'did not refuse'}`)
        continue
      }
      if (error.code !== UNSAFE_WRITE) wrong.push(`${label}: code ${error.code}`)
      if (path !== null && (error.path !== path || error.problem !== problem)) wrong.push(`${label}: named ${error.path} ${error.problem}`)
      if (path === null && !error.problem.startsWith('is outside')) wrong.push(`${label}: named ${error.path} ${error.problem}`)
      if (!error.message.includes('nothing was written')) wrong.push(`${label}: the message doesn't say nothing was written`)
    }
    assert.deepEqual(wrong, [])
    assert.deepEqual(await snapshot(outside.root), before.outside, 'nothing outside changed')
    assert.deepEqual(await snapshot(project.root), before.project, 'nothing inside changed')
  } finally {
    await outside.cleanup()
    await project.cleanup()
  }
})

test('each call does its work inside the root, reached through a symlink above it or not', async () => {
  const holder = await directory()
  try {
    const real = join(holder.root, 'real')
    await mkdir(real)
    await symlink(real, join(holder.root, 'alias'))

    for (const root of [real, join(holder.root, 'alias')]) {
      const files = projectFiles(root)
      await files.mkdir(join(root, 'a/b'), { recursive: true })
      await files.writeFile(join(root, 'a/b/c.txt'), 'one', 'utf8')
      files.writeFileSync(join(root, 'a/b/c.txt'), 'two')
      await assert.rejects(files.writeFile(join(root, 'a/b/c.txt'), 'three', { flag: 'wx' }), { code: 'EEXIST' })
      await files.copyFile(join(root, 'a/b/c.txt'), join(root, 'a/copy.txt'))
      const temp = await files.mkdtemp(join(root, 'a/backup-'))
      await files.rename(join(root, 'a/copy.txt'), join(temp, 'moved.txt'))
      assert.equal(await readFile(join(temp, 'moved.txt'), 'utf8'), 'two')
      await files.unlink(join(temp, 'moved.txt'))
      await files.rmdir(temp)
      await files.rm(join(root, 'a'), { recursive: true, force: true })
      assert.equal(existsSync(join(root, 'a')), false)
    }

    // A path spelled with another path to the root than the one it was given as
    const files = projectFiles(join(holder.root, 'alias'))
    await files.writeFile(join(real, 'spelled-real.txt'), 'x')
    assert.equal(await readFile(join(real, 'spelled-real.txt'), 'utf8'), 'x')
    await files.writeFile(join(await realpath(real), 'spelled-resolved.txt'), 'x')
    assert.equal(await readFile(join(real, 'spelled-resolved.txt'), 'utf8'), 'x')
    await symlink(real, join(real, 'self'))
    assert.deepEqual(
      unsafeWriteProblem(join(holder.root, 'alias'), join(real, 'self/file.txt')),
      { target: 'self/file.txt', path: 'self', problem: 'is a symlink' },
      'a symlink back to the root inside it is still a symlink'
    )
    assert.equal(unsafeWriteProblem(join(holder.root, 'alias'), join(holder.root, 'elsewhere.txt'))?.problem.startsWith('is outside'), true)
  } finally {
    await holder.cleanup()
  }
})

test("the build's steps that write refuse through safe-fs even when the check before the build is not asked", async () => {
  const project = await directory()
  const outside = await directory()
  try {
    const root = project.root
    const config = { projectRoot: root, monorepoRoot: null, isMonorepoMode: false, activeTheme: 'acme', themesDir: join(root, 'contents/themes'), pluginsDir: join(root, 'contents/plugins') }

    // app/api linked outside, holding an old generated plugin route and a file of its own
    await writeIn(outside.root, 'api/v1/plugin/legacy/route.ts', '// Auto-generated Plugin Route Proxy\n')
    await writeIn(outside.root, 'api/v1/plugin/legacy/other.ts', 'export const other = 1\n')
    await mkdir(join(root, 'app'), { recursive: true })
    await symlink(join(outside.root, 'api'), join(root, 'app/api'))

    // The theme's fixtures linked outside
    await writeIn(outside.root, 'fixtures/entities.json', '{"outside":true}\n')
    await writeIn(outside.root, 'fixtures/blocks.json', '{"outside":true}\n')
    await mkdir(join(root, 'contents/themes/acme/tests/cypress'), { recursive: true })
    await symlink(join(outside.root, 'fixtures'), join(root, 'contents/themes/acme/tests/cypress/fixtures'))

    // app/(templates) linked outside, and app/globals.css linked to a file outside
    await writeIn(outside.root, 'templates/(public)/orphan/page.tsx', 'export default function Orphan() { return null }\n')
    await symlink(join(outside.root, 'templates'), join(root, 'app/(templates)'))
    await writeIn(outside.root, 'globals.css', '@import "../elsewhere.css";\n')
    await symlink(join(outside.root, 'globals.css'), join(root, 'app/globals.css'))

    const before = await snapshot(outside.root)
    const steps = [
      ['cleanupOldRouteFiles', () => cleanupOldRouteFiles(config), 'app/api'],
      ['generateTestEntitiesJson', () => generateTestEntitiesJson([], [{ name: 'acme' }], config), 'contents/themes/acme/tests/cypress/fixtures'],
      ['generateTestBlocksJson', () => generateTestBlocksJson([], config), 'contents/themes/acme/tests/cypress/fixtures'],
      ['cleanupOrphanedTemplates', () => cleanupOrphanedTemplates([], config), 'app/(templates)'],
      ['cleanupDeletedTemplate', () => cleanupDeletedTemplate(join(root, 'contents/themes/acme/templates/(public)/orphan/page.tsx'), config), 'app/(templates)'],
      ['generateMissingPages', () => generateMissingPages([], config, new Map()), 'app/(templates)'],
      ['syncAppGlobalsCss', () => syncAppGlobalsCss(config, 'acme'), 'app/globals.css'],
    ]
    const wrong = []
    for (const [label, step, path] of steps) {
      const error = await thrown(step)
      if (!isUnsafeWrite(error)) wrong.push(`${label}: ${error ? `threw ${error.message}` : 'did not refuse'}`)
      else if (error.path !== path) wrong.push(`${label}: named ${error.path}`)
    }
    assert.deepEqual(wrong, [])
    assert.deepEqual(await snapshot(outside.root), before, 'nothing outside changed')
  } finally {
    await outside.cleanup()
    await project.cleanup()
  }
})

test('the scan finds each way a file can change the file system without safe-fs, and lets reads through', () => {
  const found = source => directFsWrites(source, 'example.mjs').map(({ what }) => what)
  assert.deepEqual(found("import { existsSync, readFileSync, lstatSync, constants } from 'fs'\nimport { readdir } from 'node:fs/promises'\n"), [])
  assert.deepEqual(found("import { writeFileSync } from 'fs'"), ['imports writeFileSync from fs'])
  assert.deepEqual(found("import { rm as remove } from 'node:fs/promises'"), ['imports rm from node:fs/promises'])
  assert.deepEqual(found("import { promises } from 'fs'"), ['imports promises from fs'])
  assert.deepEqual(found("import { cpSync, symlinkSync, openSync } from 'fs'"), ['imports cpSync from fs', 'imports symlinkSync from fs', 'imports openSync from fs'])
  assert.deepEqual(found("import fs from 'fs'"), ['imports fs whole, as fs'])
  assert.deepEqual(found("import * as fsp from 'fs/promises'"), ['imports fs/promises whole, as fsp'])
  assert.deepEqual(found("import fse from 'fs-extra'"), ['imports fs-extra whole, as fse'])
  assert.deepEqual(found("export { writeFile } from 'fs/promises'"), ['re-exports fs/promises'])
  assert.deepEqual(found("const { unlink } = await import('fs/promises')"), ['loads fs/promises with a call'])
  assert.deepEqual(found("const fs = require('node:fs')"), ['loads node:fs with a call'])
  assert.deepEqual(found("const fs = createRequire(import.meta.url)('fs')"), ['loads fs with a call'])
  assert.deepEqual(directFsWrites("import fs = require('fs')", 'example.ts').map(({ what }) => what), ['imports fs whole, as fs'])
  assert.deepEqual(directFsWrites("import type { Stats, WriteStream } from 'node:fs'", 'example.ts'), [])
})

test('no file of the registry build, the rest of scripts/build or the postinstall changes the file system except through safe-fs', () => {
  const files = generatorFiles({
    directories: [join(CORE_DIR, 'scripts/build')],
    entries: [join(CORE_DIR, 'scripts/postinstall.mjs')],
    within: join(CORE_DIR, 'scripts'),
  })
  const names = files.map(file => file.slice(CORE_DIR.length + 1))
  for (const expected of [
    'scripts/build/registry.mjs',
    'scripts/build/theme.mjs',
    'scripts/build/templates-plan.mjs',
    'scripts/build/registry/post-build/page-generator.mjs',
    'scripts/build/registry/post-build/route-cleanup.mjs',
    'scripts/build/registry/post-build/test-fixtures.mjs',
    'scripts/build/registry/post-build/own-gitignores.mjs',
    'scripts/utils/logging.mjs',
    'scripts/postinstall.mjs',
  ]) {
    assert.ok(names.includes(expected), `${expected} is scanned`)
  }
  assert.equal(names.some(name => name.includes('__tests__') || name.endsWith('.test.mjs')), false, 'tests are not the generator')
  assert.deepEqual(directFsWritesIn(files, { base: CORE_DIR, allowed: [join(CORE_DIR, 'scripts/build/safe-fs.mjs')] }), [])
})
