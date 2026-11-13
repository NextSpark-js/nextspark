/**
 * #443: --locales picks the languages the i18n prompt would, and the rest of the wizard works from the same config.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { applyPreset, parseLocales } from '../src/wizard/presets.js'
import { processI18n } from '../src/wizard/generators/messages-generator.js'
import { AVAILABLE_LOCALES } from '../src/wizard/types.js'

const info = { projectName: 'a', projectSlug: 'a', projectDescription: 'a' }

test('en,es selects both with en as default, as the prompts do', () => {
  assert.deepEqual(parseLocales('en,es'), { supportedLocales: ['en', 'es'], defaultLocale: 'en' })
})

test('the order, case, spaces and repeats of the list do not matter: the catalog order, once each', () => {
  assert.deepEqual(parseLocales(' ES, en,es '), { supportedLocales: ['en', 'es'], defaultLocale: 'en' })
})

test('without en the default is the first selected; --default-locale picks another', () => {
  assert.equal(parseLocales('pt,es').defaultLocale, 'es')
  assert.equal(parseLocales('en,es', 'es').defaultLocale, 'es')
})

test('an unknown locale lists the valid ones', () => {
  assert.throws(() => parseLocales('en,xx'), (e: Error) => e.message.includes('"xx"') && Object.keys(AVAILABLE_LOCALES).every(l => e.message.includes(l)))
})

test('an empty list and a default outside the list are errors', () => {
  assert.throws(() => parseLocales(' , '), /at least one/)
  assert.throws(() => parseLocales('en,es', 'fr'), /not one of the selected/)
})

test('a preset run with --locales has the languages the prompt result would give', () => {
  const fromFlag = applyPreset(info, 'saas', undefined, parseLocales('es,en'))
  const fromPrompt = { ...applyPreset(info, 'saas'), supportedLocales: ['en', 'es'], defaultLocale: 'en' }
  assert.deepEqual(fromFlag, fromPrompt)
  assert.deepEqual(applyPreset(info, 'saas').supportedLocales, ['en'])
})

test('the catalogs of a --locales en,es run are the es ones next to the en ones', async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-locales-'))
  const cwd = process.cwd()
  try {
    fs.cpSync(path.resolve(import.meta.dirname, '../../core/templates/projects/starter/messages'), path.join(root, 'messages'), { recursive: true })
    process.chdir(root)
    await processI18n(applyPreset(info, 'saas', undefined, parseLocales('en,es')))
    assert.ok(fs.existsSync(path.join(root, 'messages/es')))
    assert.ok(fs.existsSync(path.join(root, 'messages/en')))
    assert.ok(!fs.existsSync(path.join(root, 'messages/fr')))
  } finally {
    process.chdir(cwd)
    fs.rmSync(root, { recursive: true, force: true })
  }
})
