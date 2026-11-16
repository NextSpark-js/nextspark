import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { addPlugin } from '../src/commands/add-plugin.js'
import { runPostinstall } from '../src/lib/postinstall/index.js'
import { installPlugins } from '../src/wizard/generators/theme-plugins-installer.js'
import { silenceConsoleOutput } from './quiet-console.js'

silenceConsoleOutput()

const CLI_VERSION = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf-8')).version

/** A project whose `npm` is a script that records its arguments and fails, so no package is ever fetched. */
function project(coreVersion?: string, npmStderr = '') {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-plugin-version-'))
  const bin = path.join(root, 'bin')
  const log = path.join(root, 'npm-args')
  fs.mkdirSync(bin)
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\necho "$@" >> "${log}"\n${npmStderr ? `printf '%s\\n' '${npmStderr}' >&2\n` : ''}exit 1\n`, { mode: 0o755 })
  fs.writeFileSync(path.join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  if (coreVersion) {
    fs.mkdirSync(path.join(root, 'node_modules/@nextsparkjs/core'), { recursive: true })
    fs.writeFileSync(path.join(root, 'node_modules/@nextsparkjs/core/package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: coreVersion }))
  }
  return { root, bin, requested: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf-8') : '') }
}

async function inProject<T>(p: ReturnType<typeof project>, run: () => Promise<T>): Promise<T> {
  const cwd = process.cwd()
  const pathBefore = process.env.PATH
  process.chdir(p.root)
  process.env.PATH = `${p.bin}${path.delimiter}${pathBefore}`
  try {
    return await run()
  } finally {
    process.chdir(cwd)
    process.env.PATH = pathBefore
    fs.rmSync(p.root, { recursive: true, force: true })
  }
}

test('the wizard installs a plugin at the CLI version, not the latest tag (#475)', async () => {
  const p = project()
  const requested = await inProject(p, async () => {
    assert.equal(await installPlugins(['ai']), false)
    return p.requested()
  })
  assert.match(requested, new RegExp(`pack @nextsparkjs/plugin-ai@${CLI_VERSION.replace(/\./g, '\\.')} `))
})

test('add:plugin installs an unversioned @nextsparkjs plugin at the core installed in the project (#475)', async () => {
  const p = project('0.1.0-beta.77')
  const requested = await inProject(p, async () => {
    await assert.rejects(addPlugin('@nextsparkjs/plugin-ai'))
    return p.requested()
  })
  assert.match(requested, /pack @nextsparkjs\/plugin-ai@0\.1\.0-beta\.77 /)
})

test('add:plugin with an explicit version, a third-party name or no installed core keeps its rules (#475)', async () => {
  const p = project('0.1.0-beta.77')
  const requested = await inProject(p, async () => {
    await assert.rejects(addPlugin('@nextsparkjs/plugin-ai', { version: '0.1.0-beta.5' }))
    await assert.rejects(addPlugin('some-plugin'))
    return p.requested()
  })
  assert.match(requested, /pack @nextsparkjs\/plugin-ai@0\.1\.0-beta\.5 /)
  assert.match(requested, /pack some-plugin --pack/)

  const bare = project()
  const message = await inProject(bare, async () => {
    const error = await addPlugin('@nextsparkjs/plugin-ai').then(() => null, (e: Error) => e)
    assert.equal(bare.requested(), '', 'nothing is fetched without a core to match')
    return error?.message
  })
  assert.match(message ?? '', /Could not read the version of @nextsparkjs\/core/)
})

test('add:plugin leaves a name that already carries a version as given (#475)', async () => {
  const p = project('0.1.0-beta.77')
  const requested = await inProject(p, async () => {
    await assert.rejects(addPlugin('@nextsparkjs/plugin-ai@1.2.3'))
    return p.requested()
  })
  assert.match(requested, /pack @nextsparkjs\/plugin-ai@1\.2\.3 /)
})

test('a plugin required by postinstall follows the version only when it is a lockstep package (#475)', async () => {
  const p = project('0.1.0-beta.77')
  const requested = await inProject(p, async () => {
    for (const required of ['@nextsparkjs/plugin-langchain', 'some-plugin', '@nextsparkjs/plugin-walkme@1.2.3']) {
      const context = { projectRoot: p.root, coreVersion: '0.1.0-beta.77', timestamp: 0, installingPlugins: new Set<string>(), pluginVersion: '0.1.0-beta.77' }
      await assert.rejects(runPostinstall({ nextspark: { postinstall: { requiredPlugins: [required] } } } as never, p.root, context))
    }
    return p.requested()
  })
  assert.match(requested, /pack @nextsparkjs\/plugin-langchain@0\.1\.0-beta\.77 /)
  assert.match(requested, /pack some-plugin --pack/)
  assert.match(requested, /pack @nextsparkjs\/plugin-walkme@1\.2\.3 /)
})

test('a version that is not published is reported as the missing part, with what to do (#475)', async () => {
  const p = project('0.1.0-beta.77', 'npm error code E404\nnpm error 404 No match found for version 0.1.0-beta.77')
  const message = await inProject(p, async () => (await addPlugin('@nextsparkjs/plugin-ai').then(() => null, (e: Error) => e))?.message)
  assert.match(message ?? '', /Version 0\.1\.0-beta\.77 of @nextsparkjs\/plugin-ai was not found on npm/)
  assert.match(message ?? '', /-v <version>.*\.tgz/)
})
