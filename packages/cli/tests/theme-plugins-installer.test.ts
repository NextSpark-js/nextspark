import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { installPlugins, installTheme } from '../src/wizard/generators/theme-plugins-installer.js'
import { addPluginCommand } from '../src/commands/add-plugin.js'
import { addThemeCommand } from '../src/commands/add-theme.js'

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
