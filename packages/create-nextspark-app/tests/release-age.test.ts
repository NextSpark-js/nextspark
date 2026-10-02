/**
 * pnpm 11 checks every entry of a lockfile against its minimum release age, one day by default,
 * each time it installs: a lockfile holding a version published less than a day before is refused
 * with ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION, whichever pnpm wrote it and with or without
 * --no-frozen-lockfile. The pnpm-workspace.yaml create-nextspark-app writes declares that same
 * policy so that pnpm 10.16 and later, which read it, resolve the project the way pnpm 11 checks it.
 *
 * The packages come from a registry served by the test, whose publish times are set relative to
 * now, so the outcome does not depend on what npm published lately. Each install gets an empty
 * metadata cache: a cache another pnpm version filled can answer without the publish times.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import http from 'node:http'
import os from 'node:os'
import path from 'node:path'
import { spawn, spawnSync } from 'node:child_process'
import type { AddressInfo } from 'node:net'
import { allowlistEntries, buildWorkspaceYaml, releaseAgeExclusions } from '../src/create.js'

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

interface FixtureVersion {
  version: string
  /** How long before now the version was published; the registry reads it on every request. */
  age: number
}

interface FixturePackage {
  name: string
  versions: FixtureVersion[]
}

/** A tarball holding only `package/package.json`. */
function packTarball(root: string, name: string, version: string): Buffer {
  const dir = fs.mkdtempSync(path.join(root, 'pack-'))
  fs.mkdirSync(path.join(dir, 'package'))
  fs.writeFileSync(path.join(dir, 'package', 'package.json'), JSON.stringify({ name, version }))
  const file = path.join(dir, 'package.tgz')
  const packed = spawnSync('tar', ['-czf', file, '-C', dir, 'package'], { encoding: 'utf8', env: { ...process.env, COPYFILE_DISABLE: '1' } })
  assert.equal(packed.status, 0, packed.stderr)
  return fs.readFileSync(file)
}

/** Serves full packuments, publish times included, and the tarballs they point at. */
async function serveRegistry(root: string, packages: FixturePackage[]) {
  const tarballs = new Map<string, Buffer>()
  const server = http.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`

  const packuments = new Map(packages.map(pkg => {
    const versions: Record<string, unknown> = {}
    for (const { version } of pkg.versions) {
      const tarball = packTarball(root, pkg.name, version)
      const tarballPath = `/tarballs/${encodeURIComponent(pkg.name)}-${version}.tgz`
      tarballs.set(tarballPath, tarball)
      versions[version] = {
        name: pkg.name,
        version,
        dist: {
          tarball: `${base}${tarballPath}`,
          shasum: crypto.createHash('sha1').update(tarball).digest('hex'),
          integrity: `sha512-${crypto.createHash('sha512').update(tarball).digest('base64')}`,
        },
      }
    }
    const latest = pkg.versions[pkg.versions.length - 1].version
    return [pkg.name, { pkg, packument: { name: pkg.name, 'dist-tags': { latest }, versions } }]
  }))

  /** Publish times as of this moment, so a version can age while the registry runs. */
  const withTimes = ({ pkg, packument }: { pkg: FixturePackage; packument: object }) => {
    const now = Date.now()
    const time: Record<string, string> = {}
    for (const { version, age } of pkg.versions) time[version] = new Date(now - age).toISOString()
    time.created = time[pkg.versions[0].version]
    time.modified = time[pkg.versions[pkg.versions.length - 1].version]
    return { ...packument, time }
  }

  server.on('request', (req, res) => {
    const url = decodeURIComponent((req.url ?? '').split('?')[0])
    const tarball = tarballs.get((req.url ?? '').split('?')[0])
    if (tarball) {
      res.setHeader('content-type', 'application/octet-stream')
      res.end(tarball)
      return
    }
    const entry = packuments.get(url.slice(1))
    if (!entry) {
      res.statusCode = 404
      res.end('{}')
      return
    }
    res.setHeader('content-type', 'application/json')
    res.end(JSON.stringify(withTimes(entry)))
  })

  return { url: `${base}/`, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}

interface Run {
  status: number | null
  output: string
}

/** Runs pnpm without blocking the event loop, which serves the registry it installs from. */
function pnpm(version: string, args: string[], cwd: string, env: NodeJS.ProcessEnv): Promise<Run> {
  return new Promise(resolve => {
    // This test deliberately crosses pnpm majors after one writes packageManager.
    const pmOnFail = version.startsWith('11.') ? ['--pm-on-fail=ignore'] : []
    const child = spawn('corepack', [`pnpm@${version}`, ...pmOnFail, ...args], { cwd, env })
    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    child.on('close', status => resolve({ status, output }))
  })
}

/** The version of `name` the lockfile in `project` holds. */
function lockedVersion(project: string, name: string): string | undefined {
  const lockfile = fs.readFileSync(path.join(project, 'pnpm-lock.yaml'), 'utf8')
  const escaped = name.replace(/[/@.]/g, character => `\\${character}`)
  return lockfile.match(new RegExp(`^  '?${escaped}@([^':(]+)'?:`, 'm'))?.[1]
}

async function withRegistry(packages: FixturePackage[], body: (setup: {
  root: string
  env: NodeJS.ProcessEnv
  project: (name: string, dependencies: Record<string, string>) => string
  install: (version: string, project: string) => Promise<Run>
}) => Promise<void>) {
  // Outside this repository, whose packageManager would make Corepack refuse other versions.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'create-nextspark-app-release-age-')))
  const registry = await serveRegistry(root, packages)
  const env: NodeJS.ProcessEnv = { ...process.env, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', CI: '1' }

  let installs = 0
  try {
    await body({
      root,
      env,
      project: (name, dependencies) => {
        const dir = path.join(root, 'projects', name)
        fs.mkdirSync(dir, { recursive: true })
        fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name, version: '0.1.0', private: true, dependencies }))
        fs.writeFileSync(path.join(dir, 'pnpm-workspace.yaml'), buildWorkspaceYaml(allowlistEntries(dir, []), releaseAgeExclusions()))
        return dir
      },
      install: async (version, project) => {
        const cache = path.join(root, `cache-${installs++}`)
        const available = await pnpm(version, ['--version'], root, env)
        assert.equal(available.status, 0, `Corepack could not provide pnpm ${version}:\n${available.output}`)
        // As flags: pnpm 11 does not read npm_config_* from the environment.
        return pnpm(version, [
          'install',
          '--no-frozen-lockfile',
          `--config.registry=${registry.url}`,
          `--config.store-dir=${path.join(root, 'store')}`,
          `--config.cache-dir=${cache}`,
        ], project, env)
      },
    })
  } finally {
    await registry.close()
    fs.rmSync(root, { recursive: true, force: true })
  }
}

/** A dependency whose newest version is an hour old, next to one that is a month old. */
const FLOATING: FixturePackage = {
  name: '@fixture/floating',
  versions: [{ version: '1.0.0', age: 30 * DAY }, { version: '1.1.0', age: HOUR }],
}

test('a project created with pnpm 10.34.5 installs with pnpm 11.17.0', async () => {
  await withRegistry([FLOATING], async ({ project, install }) => {
    const dir = project('created-with-10', { '@fixture/floating': '^1.0.0' })

    const created = await install('10.34.5', dir)
    assert.equal(created.status, 0, `pnpm 10.34.5 install exited ${created.status}:\n${created.output}`)
    const locked = lockedVersion(dir, '@fixture/floating')

    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true })
    const reinstalled = await install('11.17.0', dir)
    assert.equal(reinstalled.status, 0, `pnpm 11.17.0 install of the lockfile holding ${locked} exited ${reinstalled.status}:\n${reinstalled.output}`)
    assert.equal(locked, '1.0.0', 'pnpm 10.34.5 locked a version published an hour ago')
  })
})

test('pnpm 9 ignores the policy, so pnpm 11 refuses what it locked until those versions are a day old or it resolves again', async () => {
  await withRegistry([FLOATING], async ({ root, env, project, install }) => {
    const dir = project('created-with-9', { '@fixture/floating': '^1.0.0' })

    const created = await install('9.15.9', dir)
    assert.equal(created.status, 0, `pnpm 9.15.9 install exited ${created.status}:\n${created.output}`)
    assert.equal(lockedVersion(dir, '@fixture/floating'), '1.1.0')

    fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true })
    const refused = await install('11.17.0', dir)
    assert.notEqual(refused.status, 0)
    assert.match(refused.output, /ERR_PNPM_MINIMUM_RELEASE_AGE_VIOLATION/)

    const aged = fs.mkdtempSync(path.join(root, 'aged-'))
    fs.cpSync(dir, aged, { recursive: true })
    fs.rmSync(path.join(aged, 'node_modules'), { recursive: true, force: true })
    FLOATING.versions[1].age = 25 * HOUR
    try {
      const once = await install('11.17.0', aged)
      assert.equal(once.status, 0, `a day later, pnpm 11.17.0 install exited ${once.status}:\n${once.output}`)
      assert.equal(lockedVersion(aged, '@fixture/floating'), '1.1.0')
    } finally {
      FLOATING.versions[1].age = HOUR
    }

    const cleaned = await pnpm('11.17.0', ['clean', '--lockfile'], dir, env)
    assert.equal(cleaned.status, 0, cleaned.output)
    const resolvedAgain = await install('11.17.0', dir)
    assert.equal(resolvedAgain.status, 0, `pnpm 11.17.0 install after clean --lockfile exited ${resolvedAgain.status}:\n${resolvedAgain.output}`)
    assert.equal(lockedVersion(dir, '@fixture/floating'), '1.0.0')
  })
})

/** Oldest pnpm that reads the policy, a 10.16-18 that ignores versions, the last 10.x, then 11 and 12. */
const PNPM_VERSIONS = ['10.16.0', '10.18.3', '10.34.6', '11.28.3', '12.9.0']

for (const version of PNPM_VERSIONS) {
  test(`pnpm ${version}: a NextSpark release published an hour ago installs, an upgrade to it too, other fresh packages keep the policy`, async () => {
    const next = '0.1.0-beta.999'
    const nextspark: FixturePackage[] = ['@nextsparkjs/core', '@nextsparkjs/cli'].map(name => ({
      name,
      versions: [{ version: '0.1.0-beta.998', age: 7 * DAY }, { version: next, age: HOUR }],
    }))
    const fresh: FixturePackage = { name: '@fixture/fresh', versions: [{ version: '2.0.0', age: HOUR }] }

    await withRegistry([...nextspark, fresh], async ({ project, install }) => {
      const dir = project('upgrade', { '@nextsparkjs/core': '0.1.0-beta.998', '@nextsparkjs/cli': '0.1.0-beta.998' })
      const first = await install(version, dir)
      assert.equal(first.status, 0, `pnpm ${version} install of the older release exited ${first.status}:\n${first.output}`)

      // The project bumps to the release published an hour ago: no entry for that version was ever written.
      fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'upgrade', private: true, dependencies: { '@nextsparkjs/core': next, '@nextsparkjs/cli': next } }))
      const bumped = await install(version, dir)
      assert.equal(bumped.status, 0, `pnpm ${version} install of the fresh release exited ${bumped.status}:\n${bumped.output}`)
      assert.equal(lockedVersion(dir, '@nextsparkjs/core'), next)

      fs.rmSync(path.join(dir, 'node_modules'), { recursive: true, force: true })
      const again = await install(version, dir)
      assert.equal(again.status, 0, `pnpm ${version} install from the lockfile exited ${again.status}:\n${again.output}`)

      // pnpm 10 refuses a fresh package that is not excluded; 11 and 12 keep it lenient (minimumReleaseAgeStrict: false).
      const other = project('other', { '@fixture/fresh': '2.0.0' })
      const refused = await install(version, other)
      if (version.startsWith('10.')) {
        assert.notEqual(refused.status, 0, 'a non-NextSpark package published an hour ago is still refused')
        assert.match(refused.output, /NO_(?:MATURE_)?MATCHING_VERSION/, 'refused by the release-age policy, not by a network error')
      }
      else assert.equal(refused.status, 0, refused.output)
    })
  })
}

test('the generated workspace YAML declares the release-age policy and excludes the NextSpark packages by name', () => {
  const yaml = buildWorkspaceYaml(['@nextsparkjs/core'], releaseAgeExclusions())

  assert.match(yaml, /^minimumReleaseAge: 1440$/m)
  assert.match(yaml, /^minimumReleaseAgeStrict: false$/m)
  assert.match(yaml, /^minimumReleaseAgeExclude:\n(?:  - '(?:@nextsparkjs\/[a-z-]+|create-nextspark-app)'\n)+/m)
})

test('the exclusions are package names, with no version and no pattern', () => {
  const exclusions = releaseAgeExclusions()

  for (const name of ['@nextsparkjs/core', '@nextsparkjs/cli', '@nextsparkjs/plugin-ai', 'create-nextspark-app']) {
    assert.ok(exclusions.includes(name), name)
  }
  for (const entry of exclusions) assert.match(entry, /^(?:@nextsparkjs\/)?[a-z-]+$/, 'pnpm 10.16 reads neither a version nor a wildcard')
})

// pack.sh publishes every non-private package under packages/ and plugins/: a new one must be excluded too.
test('the exclusions are exactly the packages this repository publishes', () => {
  const root = path.resolve(import.meta.dirname, '../../..')
  const published = new Set<string>()
  for (const dir of ['packages', 'plugins']) {
    for (const entry of fs.readdirSync(path.join(root, dir))) {
      const file = path.join(root, dir, entry, 'package.json')
      if (!fs.existsSync(file)) continue
      const pkg = JSON.parse(fs.readFileSync(file, 'utf8'))
      if (!pkg.private) published.add(pkg.name)
    }
  }
  assert.deepEqual(releaseAgeExclusions(), [...published].sort())
})
