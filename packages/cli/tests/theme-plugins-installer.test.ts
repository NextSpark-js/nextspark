import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { installPlugins, installTheme, selectPlugins } from '../src/wizard/generators/theme-plugins-installer.js'
import { addPluginCommand } from '../src/commands/add-plugin.js'
import { addThemeCommand } from '../src/commands/add-theme.js'
import { runWizard } from '../src/wizard/index.js'

// A web + mobile project keeps its app in web/, so a reference theme's required
// plugin lands in web/contents/plugins. The wizard then installs the selected
// plugins from the project root; one already under web/ must count as installed
// instead of being downloaded again and reported as a failed install.
test('in a web + mobile project, a theme or plugin already under web/ counts as installed', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  fs.mkdirSync(path.join(root, 'web/contents/themes/default'), { recursive: true })
  fs.mkdirSync(path.join(root, 'web/contents/plugins/langchain'), { recursive: true })
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
  fs.mkdirSync(path.join(root, 'contents/themes/my-app'), { recursive: true })
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
        fs.mkdirSync(path.join(root, 'contents/themes', config.projectSlug), { recursive: true })
      },
      installProjectDependencies() {},
      buildRegistries() {},
    })

    assert.equal(generated, true)
    assert.equal(fs.existsSync(path.join(root, 'contents/themes/my-app')), true)
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
  fs.mkdirSync(path.join(root, 'contents/plugins'), { recursive: true })
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
  const expected = /Theme name is required\. Valid options: starter, default, blog, crm, productivity, none\./
  await assert.rejects(installTheme(undefined as never), expected)
  await assert.rejects(
    installTheme('not-a-theme' as never),
    /Unknown theme "not-a-theme"\. Valid options: starter, default, blog, crm, productivity, none\./
  )
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

// Outside the monorepo a reference theme or plugin is downloaded with `npm pack`. An `npm` first on
// PATH hands back a package without the config file a theme or plugin must have; the install has
// to count as failed rather than be reported as installed.
test('a theme or plugin that downloads but is not valid counts as a failed install', { skip: process.platform === 'win32' }, async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-installer-'))
  const bin = path.join(root, 'bin')
  const project = path.join(root, 'project')
  fs.mkdirSync(bin)
  fs.mkdirSync(path.join(project, 'contents'), { recursive: true })
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
    assert.equal(await installTheme('default'), false)
    assert.equal(fs.existsSync(path.join(project, 'contents/themes/default')), false)
    assert.equal(await installPlugins(['langchain']), false)
    assert.equal(fs.existsSync(path.join(project, 'contents/plugins/langchain')), false)
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
      // No contents/ directory: the add fails before it fetches anything.
      await command('./missing.tgz', {})
      assert.equal(process.exitCode, 1, `${command.name} left exit code ${process.exitCode}`)
    }
  } finally {
    process.exitCode = previousExitCode
    process.chdir(previousCwd)
    fs.rmSync(root, { recursive: true, force: true })
  }
})
