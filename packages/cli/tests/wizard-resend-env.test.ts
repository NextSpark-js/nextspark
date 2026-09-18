import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { copyEnvExampleToEnv, generateEnvExample } from '../src/wizard/generators/config-generator.js'
import { setupEnvironment } from '../src/wizard/generators/env-setup.js'
import type { WizardConfig } from '../src/wizard/types.js'

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
