import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { copyEnvExampleToEnv, generateEnvExample } from '../src/wizard/generators/config-generator.js'
import { setupEnvironment } from '../src/wizard/generators/env-setup.js'
import type { WizardConfig } from '../src/wizard/types.js'
import { silenceConsoleOutput } from './quiet-console.js'

silenceConsoleOutput()

const config = {
  projectName: 'Example',
  projectSlug: 'example',
  features: { billing: false },
  auth: { googleOAuth: false },
} as WizardConfig

function assertSafeResendConfig(content: string) {
  assert.match(content, /# Without a key, emails are printed in the server log and are not sent\./)
  assert.match(content, /# RESEND_API_KEY="re_\.\.\."/)
  assert.doesNotMatch(content, /^RESEND_API_KEY=/m)
}

test('wizard environment files leave the Resend placeholder commented out', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-resend-'))
  const previousCwd = process.cwd()
  try {
    process.chdir(root)
    await generateEnvExample(config)
    await copyEnvExampleToEnv()

    assertSafeResendConfig(await readFile(join(root, '.env.example'), 'utf8'))
    assertSafeResendConfig(await readFile(join(root, '.env'), 'utf8'))

    const templateEnvRoot = join(root, 'template-env')
    await mkdir(templateEnvRoot)
    await setupEnvironment(templateEnvRoot, { setupEnv: true, generateSecrets: false }, config)
    assertSafeResendConfig(await readFile(join(templateEnvRoot, '.env'), 'utf8'))
  } finally {
    process.chdir(previousCwd)
    await rm(root, { recursive: true, force: true })
  }
})

// The `--yes` path writes `.env.example` with generateEnvExample() and copies it
// to `.env`; both must carry the database notes of templates/env.template (#484).
test('wizard environment files document DATABASE_SERVICE_URL and MIGRATE_DATABASE_URL like env.template', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-dburls-'))
  const previousCwd = process.cwd()
  try {
    process.chdir(root)
    await generateEnvExample(config)
    await copyEnvExampleToEnv()
    const template = await readFile(new URL('../templates/env.template', import.meta.url), 'utf8')
    const notes = template.split(/^DATABASE_URL=.*\n/m)[1].split('\n\n')[0]
    assert.match(notes, /# DATABASE_SERVICE_URL=/)
    assert.match(notes, /# MIGRATE_DATABASE_URL=/)
    for (const file of ['.env.example', '.env']) {
      const content = await readFile(join(root, file), 'utf8')
      assert.ok(content.includes(notes), `${file} carries the env.template database notes`)
      assert.match(content, /REQUIRED once DATABASE_URL is the non-owner `nextspark_app` role/)
    }
  } finally {
    process.chdir(previousCwd)
    await rm(root, { recursive: true, force: true })
  }
})

function assertSafeGoogleConfig(content: string) {
  assert.match(content, /# GOOGLE_CLIENT_ID="your-google-client-id"/)
  assert.match(content, /# GOOGLE_CLIENT_SECRET="your-google-client-secret"/)
  assert.doesNotMatch(content, /^GOOGLE_CLIENT_ID=/m)
  assert.doesNotMatch(content, /^GOOGLE_CLIENT_SECRET=/m)
}

/**
 * Same bug class as the Resend placeholder above, for Google OAuth: with
 * `auth.googleOAuth: true` (e.g. the saas/crm presets), the wizard used to
 * write `GOOGLE_CLIENT_ID="your-google-client-id"` as if it were real,
 * uncommented, into both .env.example and (via copyEnvExampleToEnv) .env.
 * (#202 — "placeholder values must never be written as if real").
 */
test('wizard environment files leave the Google OAuth placeholder commented out even when Google OAuth is enabled', async () => {
  const googleEnabledConfig = {
    ...config,
    auth: { googleOAuth: true },
  } as WizardConfig

  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-google-'))
  const previousCwd = process.cwd()
  try {
    process.chdir(root)
    await generateEnvExample(googleEnabledConfig)
    await copyEnvExampleToEnv()

    assertSafeGoogleConfig(await readFile(join(root, '.env.example'), 'utf8'))
    assertSafeGoogleConfig(await readFile(join(root, '.env'), 'utf8'))
  } finally {
    process.chdir(previousCwd)
    await rm(root, { recursive: true, force: true })
  }
})
