/**
 * #443 / #444 through the wizard itself: `init --yes --locales en,es` (flags -> wizard options -> runWizard) hands the
 * generator a config with those languages, and a crm/blog preset without --theme prints the note about the template.
 * The generator, install and registry steps are stubs: nothing is installed.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { runWizard } from '../src/wizard/index.js'
import { wizardOptionsFrom } from '../src/commands/init.js'
import type { WizardConfig } from '../src/wizard/types.js'

async function run(flags: Parameters<typeof wizardOptionsFrom>[0]): Promise<{ config: WizardConfig; output: string }> {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'wizard-locales-run-'))
  fs.mkdirSync(path.join(root, 'node_modules/@nextsparkjs/core'), { recursive: true })
  const previousCwd = process.cwd()
  const previousLog = console.log
  const lines: string[] = []
  console.log = (...args: unknown[]) => { lines.push(args.map(String).join(' ')) }
  let config: WizardConfig | undefined
  process.chdir(root)
  try {
    await runWizard(wizardOptionsFrom({ yes: true, name: 'App', slug: 'app', description: 'd', ...flags }), {
      async generateProject(generated) {
        config = generated
        fs.mkdirSync(path.join(root, 'config'), { recursive: true })
      },
      installProjectDependencies() {},
      buildRegistries() {},
    })
  } finally {
    console.log = previousLog
    process.chdir(previousCwd)
    fs.rmSync(root, { recursive: true, force: true })
  }
  assert.ok(config, 'the generator was not called')
  return { config, output: lines.join('\n') }
}

test('--yes --locales en,es: the generator gets both languages and en as default', async () => {
  const { config } = await run({ theme: 'starter', plugins: 'starter', locales: 'en,es' })
  assert.deepEqual(config.supportedLocales, ['en', 'es'])
  assert.equal(config.defaultLocale, 'en')
})

test('--yes --locales es,fr --default-locale fr: the generator gets that default', async () => {
  const { config } = await run({ theme: 'starter', plugins: 'starter', locales: 'es,fr', defaultLocale: 'fr' })
  assert.deepEqual(config.supportedLocales, ['es', 'fr'])
  assert.equal(config.defaultLocale, 'fr')
})

test('--yes without --locales keeps en only', async () => {
  const { config } = await run({ theme: 'starter', plugins: 'starter' })
  assert.deepEqual(config.supportedLocales, ['en'])
})

test('--preset crm without --theme says the template is the starter; with --theme it does not', async () => {
  const without = await run({ preset: 'crm', plugins: 'starter' })
  assert.match(without.output, /crm preset sets the project's configuration only.*--theme crm/)
  const withTheme = await run({ preset: 'crm', theme: 'crm', plugins: 'starter' })
  assert.doesNotMatch(withTheme.output, /sets the project's configuration only/)
})
