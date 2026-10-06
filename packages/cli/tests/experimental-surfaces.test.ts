import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { EXPERIMENTAL_TEMPLATES, experimentalNotice } from '../src/utils/experimental.js'
import { addThemeCommand } from '../src/commands/add-theme.js'

const src = (file: string) => fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '../src', file), 'utf8')

test('the notice is one line and names its surface', () => {
  const line = experimentalNotice('add:mobile')
  assert.match(line, /^Experimental: add:mobile — not part of the stable 1.0 surface/)
  assert.equal(line.includes('\n'), false)
})

test('blog, crm and productivity are experimental, starter is not', () => {
  assert.deepEqual([...EXPERIMENTAL_TEMPLATES], ['blog', 'crm', 'productivity'])
})

test('the prompts label the experimental templates and plugins', () => {
  const themes = src('wizard/prompts/theme-selection.ts')
  for (const name of ['Blog', 'CRM', 'Productivity']) assert.ok(themes.includes(`name: '${name} (experimental)'`), name)
  assert.ok(!themes.includes("name: 'Starter (experimental)'"))
  const plugins = src('wizard/prompts/plugins-selection.ts')
  for (const name of ['AI', 'LangChain', 'Social Media Publisher']) assert.ok(plugins.includes(`name: '${name} (experimental)'`), name)
})

test('every experimental helper command prints the notice', () => {
  for (const file of ['add-plugin', 'add-mobile', 'setup-ai', 'sync-ai']) {
    assert.match(src(`commands/${file}.ts`), /printExperimentalNotice\('/, file)
  }
})

test('the generator writes Next ~16.3.6 and React ^19.2', () => {
  const generator = src('wizard/generators/index.ts')
  assert.match(generator, /'next': '~16\.3\.6'/)
  assert.match(generator, /'react': '\^19\.2\.0'/)
  assert.match(generator, /'react-dom': '\^19\.2\.0'/)
})

test('add:theme explains the create --theme path and fails without fetching a package', async () => {
  const previous = process.exitCode
  const messages: string[] = []
  const original = console.error
  console.error = (...args: unknown[]) => { messages.push(args.join(' ')) }
  try {
    await addThemeCommand('@nextsparkjs/theme-blog', {})
    assert.equal(process.exitCode, 1)
  } finally {
    console.error = original
    process.exitCode = previous
  }
  assert.match(messages.join('\n'), /create-nextspark-app --theme/)
  assert.match(messages.join('\n'), /blog, crm and productivity are experimental/)
})
