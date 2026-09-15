import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { installPlugins, installTheme } from '../src/wizard/generators/theme-plugins-installer.js'

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
