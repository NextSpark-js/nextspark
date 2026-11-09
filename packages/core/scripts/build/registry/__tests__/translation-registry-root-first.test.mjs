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

test('a Cache Components host fails with a clear message when the default locale has no catalog (#416)', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-translations-'))
  try {
    await mkdir(join(root, 'config'), { recursive: true })
    await mkdir(join(root, 'messages', 'en'), { recursive: true })
    await writeFile(join(root, 'messages', 'en', 'index.ts'), 'export default {}\n')
    await writeFile(join(root, 'config', 'app.config.ts'), "export default { i18n: { defaultLocale: 'es', supportedLocales: ['en', 'es'] } }\n")
    await writeFile(join(root, 'next.config.mjs'), 'export default { cacheComponents: true }\n')
    const config = { projectRoot: root, projectSourceDir: root, projectName: 'project', pluginsDir: join(root, 'plugins'), plugins: [], pluginSources: [] }
    assert.throws(() => generateTranslationRegistry([{ name: 'project' }], config), /defaultLocale.*"es".*messages\/es/)
    // the catalog exists but the locale is not supported: the message says so
    await writeFile(join(root, 'messages', 'es.json'), '{}\n')
    await writeFile(join(root, 'config', 'app.config.ts'), "export default { i18n: { defaultLocale: 'es', supportedLocales: ['en'] } }\n")
    assert.throws(() => generateTranslationRegistry([{ name: 'project' }], config), /not in i18n\.supportedLocales/)
    await rm(join(root, 'next.config.mjs'))
    assert.doesNotThrow(() => generateTranslationRegistry([{ name: 'project' }], config))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
