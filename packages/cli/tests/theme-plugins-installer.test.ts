import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { installPlugins, installTheme, selectPlugins, selectTheme } from '../src/wizard/generators/theme-plugins-installer.js'
import { addPluginCommand } from '../src/commands/add-plugin.js'
import { addThemeCommand } from '../src/commands/add-theme.js'
import { runWizard } from '../src/wizard/index.js'

// A web + mobile project keeps its app in web/, so its local plugins live in
// web/plugins. The wizard then installs the selected
// plugins from the project root; one already under web/ must count as installed
// instead of being downloaded again and reported as a failed install.
test('in a web + mobile project, a theme or plugin already under web/ counts as installed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  fs.mkdirSync(path.join(root, 'web/plugins/langchain'), { recursive: true })
  fs.writeFileSync(path.join(root, 'web/nextspark.config.ts'), 'export default { plugins: ["langchain"] }\n')
  const previous = process.cwd()
  process.chdir(root)
  try {
    assert.equal(await installTheme('default'), true)
    assert.equal(await installPlugins(['langchain']), true)
  } finally {
    process.chdir(previous)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

// The generator copies core's bundled starter theme into the project under the
// project slug. Passing --theme starter must therefore complete this step
// without looking for an npm package named starter.
test('the bundled starter theme completes without fetching a package', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  const bin = path.join(root, 'bin')
  const fetched = path.join(root, 'npm-was-called')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(root, 'config'), { recursive: true })
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\ntouch "${fetched}"\nexit 1\n`, { mode: 0o755 })

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  process.chdir(root)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  try {
    assert.equal(await installTheme('starter' as never), true)
    assert.equal(fs.existsSync(fetched), false, 'bundled starter must not invoke npm pack')
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('the --yes wizard generates a project when bundled theme and plugin flags are selected', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-wizard-'))
  const bin = path.join(root, 'bin')
  const fetched = path.join(root, 'npm-was-called')
  fs.mkdirSync(bin)
  // The wizard only needs core to be present before it delegates to this
  // synthetic generator; avoid its real package-install branch.
  fs.mkdirSync(path.join(root, 'node_modules/@nextsparkjs/core'), { recursive: true })
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\ntouch "${fetched}"\nexit 1\n`, { mode: 0o755 })

  let generated = false
  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  process.chdir(root)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  try {
    await runWizard({
      mode: 'interactive',
      yes: true,
      name: 'My App',
      slug: 'my-app',
      description: 'A test app',
      theme: 'starter',
      plugins: ['starter'],
    }, {
      async generateProject(config) {
        generated = true
        fs.mkdirSync(path.join(root, 'config'), { recursive: true })
      },
      installProjectDependencies() {},
      buildRegistries() {},
    })

    assert.equal(generated, true)
    assert.equal(fs.existsSync(path.join(root, 'config')), true)
    assert.equal(fs.existsSync(fetched), false, 'bundled starter must not invoke npm pack')
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a bundled starter plugin completes without fetching a package', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  const bin = path.join(root, 'bin')
  const fetched = path.join(root, 'npm-was-called')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(root, 'plugins'), { recursive: true })
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\ntouch "${fetched}"\nexit 1\n`, { mode: 0o755 })

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  process.chdir(root)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  try {
    assert.equal(await installPlugins(['starter' as never]), true)
    assert.equal(fs.existsSync(fetched), false, 'bundled starter must not invoke npm pack')
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('an unknown or missing theme names the invalid choice and all valid options', async () => {
  const expected = /Project template is required\. Valid options: starter, blog, crm, productivity, none\./
  assert.throws(() => selectTheme(undefined), expected)
  assert.throws(() => selectTheme('not-a-theme'), /Unknown project template "not-a-theme"\. Valid options: starter, blog, crm, productivity, none\./)
})

test('selectPlugins names empty and unknown plugin choices with all valid options', () => {
  const options = 'starter, ai, langchain, social-media-publisher'
  assert.throws(
    () => selectPlugins(['' as never]),
    new RegExp(`Plugin name is required\\. Valid options: ${options}\\.`)
  )
  assert.throws(
    () => selectPlugins(['not-a-plugin' as never]),
    new RegExp(`Unknown plugin "not-a-plugin"\\. Valid options: ${options}\\.`)
  )
})

test('installPlugins rejects empty and unknown plugin choices before fetching', async () => {
  const options = 'starter, ai, langchain, social-media-publisher'
  await assert.rejects(
    installPlugins(['' as never]),
    new RegExp(`Plugin name is required\\. Valid options: ${options}\\.`)
  )
  await assert.rejects(
    installPlugins(['not-a-plugin' as never]),
    new RegExp(`Unknown plugin "not-a-plugin"\\. Valid options: ${options}\\.`)
  )
})

// Outside the monorepo a plugin is downloaded. A package without the plugin config must
// count as failed rather than be reported as installed.
test('a plugin that downloads but is not valid counts as a failed install', { skip: process.platform === 'win32' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  const bin = path.join(root, 'bin')
  const project = path.join(root, 'project')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(project, 'plugins'), { recursive: true })
  fs.writeFileSync(path.join(project, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh
# npm pack <spec> --pack-destination <dir>
work=$(mktemp -d)
mkdir -p "$work/package"
echo '{"name":"not-a-nextspark-package","version":"0.0.0"}' > "$work/package/package.json"
tar -czf "$4/not-a-nextspark-package-0.0.0.tgz" -C "$work" package
`, { mode: 0o755 })

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  process.chdir(project)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  try {
    assert.equal(await installPlugins(['langchain']), false)
    assert.equal(fs.existsSync(path.join(project, 'plugins/langchain')), false)
  } finally {
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    fs.rmSync(root, { recursive: true, force: true })
  }
})

// `nextspark add:theme` and `add:plugin` run through commander's synchronous parse, so a failed add
// has to set the exit code itself instead of leaving a rejected promise to Node.
test('add:theme and add:plugin set a failing exit code when the add fails', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-add-command-'))
  const previousCwd = process.cwd()
  const previousExitCode = process.exitCode
  process.chdir(root)
  try {
    for (const command of [addThemeCommand, addPluginCommand]) {
      process.exitCode = undefined
      // No root-first project marker: the add fails before it fetches anything.
      await command('./missing.tgz', {})
      assert.equal(process.exitCode, 1, `${command.name} left exit code ${process.exitCode}`)
    }
  } finally {
    process.exitCode = previousExitCode
    process.chdir(previousCwd)
    fs.rmSync(root, { recursive: true, force: true })
  }
})

// create-nextspark-app hands the wizard the plugin tarballs it found in .packages/ (an unpublished version does not
// exist in the registry): the wizard installs the file and never packs the package from npm.
test('a plugin with a local tarball is installed from that file, not packed from the registry', { skip: process.platform === 'win32' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  const bin = path.join(root, 'bin')
  const project = path.join(root, 'project')
  const packed = path.join(root, 'npm-was-called')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(project, 'plugins'), { recursive: true })
  fs.writeFileSync(path.join(project, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\ntouch "${packed}"\nexit 1\n`, { mode: 0o755 })

  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  const previousLocal = process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS
  process.chdir(project)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  // A path that does not exist: the failure names it, which shows the spec that was fetched
  const missing = path.join(root, 'nextsparkjs-plugin-langchain-0.1.0.tgz')
  process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS = JSON.stringify({ '@nextsparkjs/plugin-langchain': missing })
  const printed: string[] = []
  const previousLog = console.log
  console.log = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  try {
    assert.equal(await installPlugins(['langchain']), false)
    assert.equal(fs.existsSync(packed), false, 'npm pack was not run')
    assert.ok(printed.some(line => line.includes(`Local package not found: ${missing}`)), printed.join('\n'))
  } finally {
    console.log = previousLog
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    if (previousLocal === undefined) delete process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS
    else process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS = previousLocal
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('a malformed NEXTSPARK_LOCAL_PLUGIN_TARBALLS is reported, and the plugin comes from the registry', { skip: process.platform === 'win32' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  const bin = path.join(root, 'bin')
  const project = path.join(root, 'project')
  const packed = path.join(root, 'npm-was-called')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(project, 'plugins'), { recursive: true })
  fs.writeFileSync(path.join(project, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  fs.writeFileSync(path.join(bin, 'npm'), `#!/bin/sh\ntouch "${packed}"\nexit 1\n`, { mode: 0o755 })
  const previousCwd = process.cwd()
  const previousPath = process.env.PATH
  const previousLocal = process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS
  process.chdir(project)
  process.env.PATH = `${bin}${path.delimiter}${previousPath}`
  process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS = '{not json'
  const printed: string[] = []
  const previousLog = console.log
  console.log = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
  try {
    await installPlugins(['langchain'])
    assert.ok(printed.some(line => line.includes('NEXTSPARK_LOCAL_PLUGIN_TARBALLS is not a JSON object')), printed.join('\n'))
    assert.equal(fs.existsSync(packed), true, 'the registry path ran')
  } finally {
    console.log = previousLog
    process.chdir(previousCwd)
    process.env.PATH = previousPath
    if (previousLocal === undefined) delete process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS
    else process.env.NEXTSPARK_LOCAL_PLUGIN_TARBALLS = previousLocal
    fs.rmSync(root, { recursive: true, force: true })
  }
})
