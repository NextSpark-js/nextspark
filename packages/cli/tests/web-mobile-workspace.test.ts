/**
 * A web-mobile project is one pnpm workspace rooted above web/ and mobile/, and its pnpm settings,
 * the build allowlist among them, live in the root's pnpm-workspace.yaml. pnpm takes the nearest
 * pnpm-workspace.yaml as the workspace root, so a second one in web/ makes a script run from web/
 * install web/ as a workspace of its own first; pnpm 11 does that before every script and fails it
 * over the build scripts the file in web/ does not allow.
 *
 * The generator runs for real in a temporary directory, with a stand-in for the installed
 * @nextsparkjs/mobile templates. The pnpm runs use the pnpm-workspace.yaml files it wrote, with
 * package.json files reduced to one dependency that has a postinstall, served by a local registry.
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
import { generateProject } from '../src/wizard/generators/index.js'
import { applyPreset } from '../src/wizard/presets.js'
import type { ProjectType } from '../src/wizard/types.js'

/** What create-nextspark-app leaves before the wizard runs, reduced to the fixture's allowlist. */
const CREATED_WORKSPACE_YAML = `packages:
  - 'contents/themes/*'
  - 'contents/plugins/*'

allowBuilds:
  'fixture-built': true
onlyBuiltDependencies:
  - 'fixture-built'
`

/** Runs the generator for a new project of `type` and returns its directory. */
async function generate(type: ProjectType): Promise<string> {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-web-mobile-')))
  const mobileTemplates = path.join(root, 'node_modules/@nextsparkjs/mobile/templates')
  for (const dir of ['app', 'src']) fs.mkdirSync(path.join(mobileTemplates, dir), { recursive: true })
  for (const file of ['babel.config.js', 'metro.config.js']) fs.writeFileSync(path.join(mobileTemplates, file), '')
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'acme', private: true }))
  fs.writeFileSync(path.join(root, 'pnpm-workspace.yaml'), CREATED_WORKSPACE_YAML)

  const config = applyPreset({ projectName: 'Acme', projectSlug: 'acme', projectDescription: 'Acme' }, 'saas', type)
  const previous = process.cwd()
  process.chdir(root)
  try {
    await generateProject(config)
  } finally {
    process.chdir(previous)
  }
  return root
}

/** The globs under the file's `packages:` key. */
function packageGlobs(yaml: string): string[] {
  const lines = yaml.split('\n')
  const start = lines.indexOf('packages:')
  const globs: string[] = []
  for (const line of lines.slice(start + 1)) {
    const item = line.match(/^ {2}- '([^']+)'$/)
    if (!item) break
    globs.push(item[1])
  }
  return globs
}

test('a web-mobile project keeps its pnpm settings in the root pnpm-workspace.yaml only', async () => {
  const root = await generate('web-mobile')
  try {
    assert.equal(fs.existsSync(path.join(root, 'web', 'package.json')), true, 'the generator did not write web/')
    assert.equal(fs.existsSync(path.join(root, 'web', 'pnpm-workspace.yaml')), false, 'web/ has a pnpm-workspace.yaml of its own')

    const yaml = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
    assert.deepEqual(packageGlobs(yaml), ['web', 'web/contents/themes/*', 'web/contents/plugins/*', 'mobile'])
    assert.match(yaml, /^allowBuilds:\n {2}'fixture-built': true$/m)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a web-only project still gets its themes and plugins into the pnpm-workspace.yaml it started with', async () => {
  const root = await generate('web')
  try {
    const yaml = fs.readFileSync(path.join(root, 'pnpm-workspace.yaml'), 'utf8')
    assert.deepEqual(packageGlobs(yaml), ['contents/themes/*', 'contents/plugins/*'])
    assert.match(yaml, /^allowBuilds:\n {2}'fixture-built': true$/m)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

/** A registry serving `fixture-built`, whose postinstall writes a file named `built`. */
async function serveFixtureRegistry(root: string) {
  const pack = path.join(root, 'fixture-built')
  const scripts = { postinstall: `node -e "require('fs').writeFileSync('built', '')"` }
  fs.mkdirSync(path.join(pack, 'package'), { recursive: true })
  fs.writeFileSync(path.join(pack, 'package', 'package.json'), JSON.stringify({ name: 'fixture-built', version: '1.0.0', scripts }))
  const packed = spawnSync('tar', ['-czf', path.join(pack, 'package.tgz'), '-C', pack, 'package'], {
    encoding: 'utf8',
    env: { ...process.env, COPYFILE_DISABLE: '1' },
  })
  assert.equal(packed.status, 0, packed.stderr)
  const tarball = fs.readFileSync(path.join(pack, 'package.tgz'))

  const server = http.createServer()
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const published = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const packument = {
    name: 'fixture-built',
    'dist-tags': { latest: '1.0.0' },
    versions: {
      '1.0.0': {
        name: 'fixture-built',
        version: '1.0.0',
        scripts,
        dist: {
          tarball: `${base}/fixture-built-1.0.0.tgz`,
          shasum: crypto.createHash('sha1').update(tarball).digest('hex'),
          integrity: `sha512-${crypto.createHash('sha512').update(tarball).digest('base64')}`,
        },
      },
    },
    time: { created: published, modified: published, '1.0.0': published },
  }

  server.on('request', (req, res) => {
    if (req.url === '/fixture-built-1.0.0.tgz') {
      res.end(tarball)
    } else if (req.url === '/fixture-built') {
      res.setHeader('content-type', 'application/json')
      res.end(JSON.stringify(packument))
    } else {
      res.statusCode = 404
      res.end('{}')
    }
  })

  return { url: `${base}/`, close: () => new Promise<void>(resolve => server.close(() => resolve())) }
}

/**
 * Runs pnpm without blocking the event loop, which serves the registry it installs from.
 * `userconfig` names the registry: the install pnpm 11 starts on its own before a script does not
 * take the flags the script was run with. The npm_config_* and pnpm_config_* variables a pnpm
 * running this suite exports are left out, since they win over that file.
 */
function pnpm(version: string, args: string[], cwd: string, userconfig: string): Promise<{ status: number | null; output: string }> {
  const inherited = Object.fromEntries(Object.entries(process.env).filter(([name]) => !/^(npm|pnpm)_config_/i.test(name)))
  return new Promise(resolve => {
    const child = spawn('corepack', [`pnpm@${version}`, ...args], {
      cwd,
      env: { ...inherited, COREPACK_ENABLE_DOWNLOAD_PROMPT: '0', CI: '1', npm_config_userconfig: userconfig },
    })
    let output = ''
    child.stdout.on('data', chunk => (output += chunk))
    child.stderr.on('data', chunk => (output += chunk))
    child.on('close', status => resolve({ status, output }))
  })
}

test('pnpm 9, 10 and 11 run a script from web/ of a generated web-mobile project', async () => {
  const generated = await generate('web-mobile')
  // Outside this repository, whose packageManager would make Corepack refuse other versions.
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-web-mobile-pnpm-')))
  const registry = await serveFixtureRegistry(root)
  const userconfig = path.join(root, 'npmrc')
  fs.writeFileSync(userconfig, `registry=${registry.url}\n`)

  try {
    for (const version of ['9.15.9', '10.34.5', '11.17.0']) {
      const project = path.join(root, `pnpm-${version}`)
      for (const file of ['pnpm-workspace.yaml', '.npmrc', 'web/pnpm-workspace.yaml', 'mobile/pnpm-workspace.yaml']) {
        const source = path.join(generated, file)
        if (!fs.existsSync(source)) continue
        fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true })
        fs.copyFileSync(source, path.join(project, file))
      }
      const manifests: Record<string, object> = {
        'package.json': { name: 'acme', version: '0.1.0', private: true },
        'web/package.json': {
          name: 'web',
          version: '0.1.0',
          private: true,
          scripts: { hello: `node -e "console.log('hello from web')"` },
          dependencies: { 'fixture-built': '1.0.0' },
        },
        'mobile/package.json': { name: 'mobile', version: '0.1.0', private: true },
      }
      for (const [file, manifest] of Object.entries(manifests)) {
        fs.mkdirSync(path.dirname(path.join(project, file)), { recursive: true })
        fs.writeFileSync(path.join(project, file), JSON.stringify(manifest))
      }

      const flags = [
        `--config.store-dir=${path.join(root, 'store')}`,
        `--config.cache-dir=${path.join(root, `cache-${version}`)}`,
        // pnpm 9 and 10 honour a user-level ignore-scripts; the store's side effects cache would
        // skip a postinstall that already ran for another version.
        '--config.ignore-scripts=false',
        '--config.side-effects-cache=false',
      ]
      const install = await pnpm(version, ['install', ...flags], project, userconfig)
      assert.equal(install.status, 0, `pnpm ${version} install exited ${install.status}:\n${install.output}`)

      const run = await pnpm(version, [...flags, 'hello'], path.join(project, 'web'), userconfig)
      assert.equal(run.status, 0, `pnpm ${version} hello from web/ exited ${run.status}:\n${run.output}`)
      assert.match(run.output, /hello from web/)
      assert.equal(fs.existsSync(path.join(project, 'web', 'pnpm-lock.yaml')), false, `pnpm ${version} installed web/ on its own`)
    }
  } finally {
    await registry.close()
    fs.rmSync(root, { recursive: true, force: true })
    fs.rmSync(generated, { recursive: true, force: true })
  }
})
