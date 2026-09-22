/**
 * create-nextspark-app's src/create.ts can pin @nextsparkjs/testing to a
 * version-matched local tarball, written as a `file:` devDependency straight
 * into the root package.json it creates -- so a mid-development, unpublished
 * version installs from disk instead of failing against the registry (see
 * create-nextspark-app/tests/create.test.ts).
 *
 * For a web-mobile (monorepo) project, generateMonorepoStructure then
 * replaces that root package.json wholesale (createRootPackageJson), and
 * index.ts's updatePackageJson later writes a brand new web/package.json --
 * a separate file that never saw the original root package.json's local ref.
 * Left alone, the ref is silently dropped and updatePackageJson pins
 * @nextsparkjs/testing to a registry version instead, which does not exist
 * yet for an unpublished, locally-tarballed version -- the same failure this
 * package's own dependency-on-core removal was fixed for, just one path
 * later.
 *
 * These tests cover the extraction/rehoming helpers directly, and the full
 * create -> generateMonorepoStructure -> updatePackageJson seam: the local
 * ref must survive into web/package.json, its file: path rewritten for the
 * extra directory level, and updatePackageJson's isLocalPackageRef guard must
 * leave it alone once it does.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import fs from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { extractLocalNextSparkRefs, rehomeLocalRefSpec } from '../src/wizard/generators/local-package-refs.js'
import { generateMonorepoStructure } from '../src/wizard/generators/monorepo-generator.js'
import { updatePackageJson } from '../src/wizard/generators/index.js'
import type { WizardConfig } from '../src/wizard/types.js'

test('rehomeLocalRefSpec rewrites a file: path for one extra directory level, and leaves workspace: alone', () => {
  const fromDir = '/repo/projects/my-app'
  const toDir = '/repo/projects/my-app/web'

  assert.equal(
    rehomeLocalRefSpec('file:../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz', fromDir, toDir),
    'file:../../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz'
  )
  assert.equal(
    rehomeLocalRefSpec('link:../../local/testing', fromDir, toDir),
    'link:../../../local/testing'
  )
  assert.equal(rehomeLocalRefSpec('workspace:*', fromDir, toDir), 'workspace:*')
  assert.equal(rehomeLocalRefSpec('0.1.0-beta.192', fromDir, toDir), '0.1.0-beta.192')
})

test('extractLocalNextSparkRefs finds only @nextsparkjs/* local refs, from either dependency field', () => {
  const manifest = {
    dependencies: {
      '@nextsparkjs/core': '0.1.0-beta.192',
      // A local ref on a non-@nextsparkjs package is not what this exists to carry over.
      'lodash': 'file:../vendor/lodash',
    },
    devDependencies: {
      '@nextsparkjs/testing': 'file:../../.packages/nextsparkjs-testing-0.1.0-beta.192.tgz',
      'typescript': '^5.7.3',
    },
  }

  assert.deepEqual(extractLocalNextSparkRefs(manifest), [
    { name: '@nextsparkjs/testing', field: 'devDependencies', spec: 'file:../../.packages/nextsparkjs-testing-0.1.0-beta.192.tgz' },
  ])
})

test('extractLocalNextSparkRefs finds nothing when there is no local ref, or no package.json fields at all', () => {
  assert.deepEqual(extractLocalNextSparkRefs({ dependencies: { '@nextsparkjs/core': '0.1.0-beta.192' } }), [])
  assert.deepEqual(extractLocalNextSparkRefs({}), [])
})

/**
 * generateMonorepoStructure also copies the mobile app template
 * (copyMobileTemplate), which this repo checkout's packages/mobile/templates/
 * does not carry a populated app/ for (it is synced separately, the way core's
 * templates/app is -- see scripts/packages/pack.sh). getMobileTemplatesDir()
 * checks `<cwd>/node_modules/@nextsparkjs/mobile/templates` first, so a
 * throwaway one there, with just the files validateMobileTemplate requires,
 * makes generateMonorepoStructure runnable end to end without depending on
 * that sync having run, or reaching into the real packages/mobile/.
 */
async function stubMobileTemplates(cwd: string): Promise<void> {
  const templatesDir = path.join(cwd, 'node_modules', '@nextsparkjs', 'mobile', 'templates')
  await mkdir(path.join(templatesDir, 'app'), { recursive: true })
  await mkdir(path.join(templatesDir, 'src'), { recursive: true })
  await writeFile(path.join(templatesDir, 'babel.config.js'), '')
  await writeFile(path.join(templatesDir, 'metro.config.js'), '')
}

test('a local @nextsparkjs/testing ref that create-nextspark-app wrote at the project root survives into web/package.json, rehomed, and updatePackageJson leaves it alone', async () => {
  // Mirrors create.ts's own layout: the tarball sits in a caller's .packages/,
  // two directories above the project root create-nextspark-app writes.
  const base = await mkdtemp(path.join(tmpdir(), 'nextspark-monorepo-local-refs-'))
  const projectRoot = path.join(base, 'projects', 'my-app')
  const stubCwd = path.join(base, 'stub-cwd')
  const previousCwd = process.cwd()
  try {
    await mkdir(path.join(base, 'caller', '.packages'), { recursive: true })
    await mkdir(projectRoot, { recursive: true })
    await mkdir(stubCwd, { recursive: true })
    await stubMobileTemplates(stubCwd)
    await writeFile(
      path.join(base, 'caller', '.packages', 'nextsparkjs-testing-0.1.0-beta.189.tgz'),
      ''
    )
    await writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({
        name: 'my-app',
        version: '0.1.0',
        private: true,
        devDependencies: {
          '@nextsparkjs/testing': 'file:../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz',
        },
      })
    )

    const config = {
      projectSlug: 'my-app',
      projectType: 'web-mobile',
      projectName: 'my-app',
      projectDescription: 'my-app - built with NextSpark',
    } as WizardConfig

    // getMobileTemplatesDir() reads process.cwd() first; targetDir (projectRoot)
    // is passed explicitly and every other generator write below goes through
    // it, not cwd, so this chdir only steers the mobile-template lookup.
    process.chdir(stubCwd)
    await generateMonorepoStructure(projectRoot, config)

    const webPackageJsonPath = path.join(projectRoot, 'web', 'package.json')
    const seeded = JSON.parse(await readFile(webPackageJsonPath, 'utf8'))
    assert.equal(
      seeded.devDependencies?.['@nextsparkjs/testing'],
      'file:../../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz',
      'web/package.json should carry the rehomed local ref right after generateMonorepoStructure'
    )

    // The root package.json create.ts wrote is expected to be replaced
    // wholesale (createRootPackageJson) -- the ref belongs to web/, not root.
    const rootAfter = JSON.parse(await readFile(path.join(projectRoot, 'package.json'), 'utf8'))
    assert.equal(rootAfter.devDependencies?.['@nextsparkjs/testing'], undefined)

    // updatePackageJson runs later, with cwd chdir'd into web/ (see
    // generateProject in index.ts) -- reproduced here directly.
    process.chdir(path.join(projectRoot, 'web'))
    await updatePackageJson(config)

    const final = JSON.parse(await readFile(webPackageJsonPath, 'utf8'))
    assert.equal(
      final.devDependencies['@nextsparkjs/testing'],
      'file:../../../caller/.packages/nextsparkjs-testing-0.1.0-beta.189.tgz',
      "updatePackageJson's isLocalPackageRef guard must leave the local ref alone instead of pinning it to a registry version"
    )
  } finally {
    process.chdir(previousCwd)
    await rm(base, { recursive: true, force: true })
  }
})

test('a monorepo project with no local @nextsparkjs refs gets no pre-seeded web/package.json, and updatePackageJson creates it as usual', async () => {
  const base = await mkdtemp(path.join(tmpdir(), 'nextspark-monorepo-local-refs-'))
  const projectRoot = path.join(base, 'my-app')
  const stubCwd = path.join(base, 'stub-cwd')
  const previousCwd = process.cwd()
  try {
    await mkdir(projectRoot, { recursive: true })
    await mkdir(stubCwd, { recursive: true })
    await stubMobileTemplates(stubCwd)
    await writeFile(
      path.join(projectRoot, 'package.json'),
      JSON.stringify({ name: 'my-app', version: '0.1.0', private: true })
    )

    const config = {
      projectSlug: 'my-app',
      projectType: 'web-mobile',
      projectName: 'my-app',
      projectDescription: 'my-app - built with NextSpark',
    } as WizardConfig

    process.chdir(stubCwd)
    await generateMonorepoStructure(projectRoot, config)

    assert.equal(fs.existsSync(path.join(projectRoot, 'web', 'package.json')), false)

    process.chdir(path.join(projectRoot, 'web'))
    await updatePackageJson(config)

    const webPackageJson = JSON.parse(await readFile(path.join(projectRoot, 'web', 'package.json'), 'utf8'))
    assert.equal(webPackageJson.name, 'web')
    assert.ok(webPackageJson.devDependencies['@nextsparkjs/testing'], 'the usual registry pin is written when there was no local ref to carry over')
  } finally {
    process.chdir(previousCwd)
    await rm(base, { recursive: true, force: true })
  }
})
