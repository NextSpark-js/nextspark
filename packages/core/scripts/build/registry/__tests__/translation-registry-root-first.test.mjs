import assert from 'node:assert/strict'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'

import { generateTranslationRegistry } from '../generators/translation-registry.mjs'

test('plugin translations come only from plugins enabled in nextspark.config.ts', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-translations-'))
  const pluginsDir = join(root, 'plugins')

  for (const pluginName of ['enabled', 'disabled']) {
    const messagesDir = join(pluginsDir, pluginName, 'entities', `${pluginName}-entity`, 'messages')
    await mkdir(messagesDir, { recursive: true })
    await writeFile(join(messagesDir, 'en.json'), '{}\n')
  }

  try {
    const output = generateTranslationRegistry([{ name: 'project' }], {
      projectRoot: root,
      projectSourceDir: root,
      projectName: 'project',
      pluginsDir,
      plugins: ['enabled'],
      pluginSources: [{ name: 'enabled', sourceDir: join(pluginsDir, 'enabled'), importBase: '@/plugins/enabled' }],
    })

    assert.match(output, /'enabled':/)
    assert.match(output, /enabled-entity/)
    assert.doesNotMatch(output, /'disabled':/)
    assert.doesNotMatch(output, /disabled-entity/)
    assert.match(output, /projectName: 'project'/)
    assert.doesNotMatch(output, /activeTheme:/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
