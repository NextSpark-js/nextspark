import { before, test } from 'node:test'
import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { copyFile, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { realpathSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { buildCli } from './built-cli.js'

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE_ROOT = join(PKG_ROOT, '..', 'core')

/** Core's real check and the modules it imports, copied into each fixture core. */
const CORE_FILES = [
  'scripts/build/auth-readiness.mjs',
  'scripts/build/auth-readiness-load.mjs',
  'scripts/build/registry/project-mode.mjs',
  'scripts/utils/file-utils.mjs',
  'scripts/utils/logging.mjs',
]

// Synthetic, syntactically valid values: never real credentials
const VALID_EMAIL = {
  EMAIL_PROVIDER: 'resend',
  RESEND_API_KEY: 're_synthetic0123456789abcdef',
  RESEND_FROM_EMAIL: 'auth@example.test',
}
const VALID_GOOGLE = {
  GOOGLE_CLIENT_ID: '123456789-synthetic.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-synthetic-secret-value',
}

let cliEntry: string
let evaluatorBundle: string

before(() => {
  cliEntry = buildCli()
  // The evaluator from core's source, bundled the way the check imports it from dist/
  const out = join(PKG_ROOT, 'node_modules', '.cache', `nextspark-auth-readiness-${process.pid}`)
  execFileSync('pnpm', ['exec', 'tsup', join(CORE_ROOT, 'src/lib/auth/readiness.ts'), '--format', 'esm', '--outDir', out], { cwd: PKG_ROOT, stdio: 'ignore' })
  process.once('exit', () => rmSync(out, { recursive: true, force: true }))
  evaluatorBundle = join(out, 'readiness.js')
})

/** `null`: no project config; PROJECT_WITHOUT_CONFIG: an otherwise valid project without config/app.config.ts. */
const PROJECT_WITHOUT_CONFIG = Symbol('project without app.config.ts')

async function fixture(appConfig: string | null | typeof PROJECT_WITHOUT_CONFIG, dotEnv = '') {
  const root = await mkdtemp(join(tmpdir(), 'nextspark auth readiness '))
  const core = join(root, 'node_modules/@nextsparkjs/core')
  for (const file of CORE_FILES) {
    await mkdir(dirname(join(core, file)), { recursive: true })
    await copyFile(join(CORE_ROOT, file), join(core, file))
  }
  await mkdir(join(core, 'dist/lib/auth'), { recursive: true })
  await copyFile(evaluatorBundle, join(core, 'dist/lib/auth/readiness.js'))
  await writeFile(join(core, 'package.json'), JSON.stringify({ name: '@nextsparkjs/core', version: '0.0.0-test' }))
  // The check's one dependency, resolved from core as in an installed package
  await mkdir(join(core, 'node_modules'), { recursive: true })
  await symlink(realpathSync(join(CORE_ROOT, 'node_modules/dotenv')), join(core, 'node_modules/dotenv'))
  await writeFile(join(core, 'scripts/build/registry.mjs'), `
import { appendFileSync } from 'node:fs'
appendFileSync(process.cwd() + '/registry-ran.txt', 'ran\\n')
`)
  await writeFile(join(root, 'nextspark.config.ts'), 'export default { plugins: [] }\n')
  await writeFile(join(root, 'package.json'), JSON.stringify({ dependencies: { next: '16.3.5' } }))
  if (appConfig !== null && appConfig !== PROJECT_WITHOUT_CONFIG) {
    await mkdir(join(root, 'config'), { recursive: true })
    await writeFile(join(root, 'config/app.config.ts'), appConfig)
  }
  await writeFile(join(root, '.env'), dotEnv)
  await mkdir(join(root, 'node_modules/.bin'), { recursive: true })
  await writeFile(join(root, 'node_modules/.bin/next'), '#!/bin/sh\necho next-was-run > next-ran.txt\n', { mode: 0o755 })
  return { root, cleanup: () => rm(root, { recursive: true, force: true }) }
}

const methods = (list: string[]) =>
  `export const APP_CONFIG_OVERRIDES = {\n  auth: { methods: ${JSON.stringify(list)} as string[] },\n}\n`
const DEFAULTS = 'export const APP_CONFIG_OVERRIDES = {\n  app: { name: \'Demo\' },\n}\n'

/** Run the built CLI with only the variables given, so the runner's own environment can't satisfy a check. */
function run(root: string, args: string[], env: Record<string, string> = {}) {
  const result = spawnSync(process.execPath, [cliEntry, ...args], {
    cwd: root,
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...env },
    encoding: 'utf8',
    timeout: 20_000,
  })
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` }
}

function assertNoValues(output: string, values: Record<string, string>) {
  for (const [name, value] of Object.entries(values)) {
    if (value === 'resend') continue
    assert.ok(!output.includes(value), `${name} value leaked into the output:\n${output}`)
  }
}

test('no provider: production prepare fails with diagnostic codes and remediation', async () => {
  const project = await fixture(DEFAULTS)
  try {
    const result = run(project.root, ['prepare', '--production'])
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /EMAIL_PROVIDER_DEVELOPMENT_ONLY/)
    assert.match(result.output, /GOOGLE_CLIENT_ID_MISSING/)
    assert.match(result.output, /AUTH_NO_AVAILABLE_METHOD/)
    assert.match(result.output, /NEXTSPARK_AUTH_RUNTIME_ONLY/)
  } finally {
    await project.cleanup()
  }
})

test('placeholder Resend key fails without printing any configured value', async () => {
  const project = await fixture(methods(['email-otp', 'google']))
  const values = {
    EMAIL_PROVIDER: 'resend',
    RESEND_API_KEY: 're_your_api_key_here',
    RESEND_FROM_EMAIL: 'auth@example.test',
    GOOGLE_CLIENT_ID: 'synthetic-not-a-client-id',
    GOOGLE_CLIENT_SECRET: 'GOCSPX-synthetic-secret-value',
  }
  try {
    const result = run(project.root, ['prepare', '--production'], values)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /RESEND_API_KEY_PLACEHOLDER/)
    assert.match(result.output, /GOOGLE_CLIENT_ID_MALFORMED/)
    assertNoValues(result.output, values)
  } finally {
    await project.cleanup()
  }
})

test('valid-shape Resend from the project .env passes, and an unusable Google is only a warning', async () => {
  const dotEnv = Object.entries(VALID_EMAIL).map(([name, value]) => `${name}=${value}`).join('\n')
  const project = await fixture(DEFAULTS, `${dotEnv}\n`)
  try {
    const result = run(project.root, ['prepare', '--production'])
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /GOOGLE_CLIENT_ID_MISSING/)
    assertNoValues(result.output, VALID_EMAIL)
  } finally {
    await project.cleanup()
  }
})

test('the resend.dev testing sender is not a production sender', async () => {
  const project = await fixture(methods(['email-otp']))
  try {
    const result = run(project.root, ['prepare', '--production'], { ...VALID_EMAIL, RESEND_FROM_EMAIL: 'onboarding@resend.dev' })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /RESEND_FROM_EMAIL_SANDBOX/)
  } finally {
    await project.cleanup()
  }
})

test('OAuth-only with valid-shape Google passes and ignores the unused email provider', async () => {
  const project = await fixture(methods(['google']))
  try {
    const result = run(project.root, ['prepare', '--production'], VALID_GOOGLE)
    assert.equal(result.status, 0, result.output)
    assert.doesNotMatch(result.output, /EMAIL_PROVIDER/)
    assertNoValues(result.output, VALID_GOOGLE)
  } finally {
    await project.cleanup()
  }
})

test('email and OAuth both configured pass', async () => {
  const project = await fixture(methods(['email-otp', 'google']))
  try {
    const result = run(project.root, ['prepare', '--production'], { ...VALID_EMAIL, ...VALID_GOOGLE })
    assert.equal(result.status, 0, result.output)
    assertNoValues(result.output, { ...VALID_EMAIL, ...VALID_GOOGLE })
  } finally {
    await project.cleanup()
  }
})

test('declared runtime-only providers with missing values pass with a warning', async () => {
  const project = await fixture(methods(['email-otp', 'google']))
  try {
    const result = run(project.root, ['prepare', '--production'], { NEXTSPARK_AUTH_RUNTIME_ONLY: ' email , google ' })
    assert.equal(result.status, 0, result.output)
    assert.match(result.output, /deferred to runtime/)
    assert.match(result.output, /EMAIL_RUNTIME_VALIDATION_REQUIRED/)
  } finally {
    await project.cleanup()
  }
})

test('runtime-only does not excuse a concrete placeholder', async () => {
  const project = await fixture(methods(['email-otp']))
  try {
    const result = run(project.root, ['prepare', '--production'], {
      NEXTSPARK_AUTH_RUNTIME_ONLY: 'email',
      RESEND_API_KEY: 're_your_api_key_here',
    })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /RESEND_API_KEY_PLACEHOLDER/)
    assert.ok(!result.output.includes('re_your_api_key_here'))
  } finally {
    await project.cleanup()
  }
})

test('an unknown runtime-only token fails', async () => {
  const project = await fixture(methods(['email-otp']))
  try {
    const result = run(project.root, ['prepare', '--production'], { NEXTSPARK_AUTH_RUNTIME_ONLY: 'email,sms' })
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /AUTH_RUNTIME_ONLY_UNSUPPORTED/)
  } finally {
    await project.cleanup()
  }
})

test('an unreadable project config fails closed; NEXTSPARK_AUTH_PREFLIGHT=off is the one bypass', async () => {
  const project = await fixture(`import { base } from '@/config/base'\nexport const APP_CONFIG_OVERRIDES = { ...base }\n`)
  try {
    const failed = run(project.root, ['prepare', '--production'])
    assert.equal(failed.status, 1, failed.output)
    assert.match(failed.output, /AUTH_CONFIG_UNREADABLE/)
    assert.match(failed.output, /NEXTSPARK_AUTH_PREFLIGHT=off/)

    const bypassed = run(project.root, ['prepare', '--production'], { NEXTSPARK_AUTH_PREFLIGHT: 'off' })
    assert.equal(bypassed.status, 0, bypassed.output)
    assert.match(bypassed.output, /check skipped/)
    assert.match(bypassed.output, /Runtime gates still/)

    const unsupported = run(project.root, ['prepare', '--production'], { NEXTSPARK_AUTH_PREFLIGHT: 'false' })
    assert.equal(unsupported.status, 1, unsupported.output)
    assert.match(unsupported.output, /AUTH_PREFLIGHT_UNSUPPORTED/)
  } finally {
    await project.cleanup()
  }
})

test('a project without app.config.ts is checked against the core defaults', async () => {
  const project = await fixture(null)
  try {
    const invalid = run(project.root, ['prepare', '--production'])
    assert.equal(invalid.status, 1, invalid.output)
    assert.match(invalid.output, /Login methods: email-otp, google/)

    const ready = run(project.root, ['prepare', '--production'], VALID_EMAIL)
    assert.equal(ready.status, 0, ready.output)
  } finally {
    await project.cleanup()
  }
})

test('non-production prepare does not run the check', async () => {
  const project = await fixture(`import { base } from '@/config/base'\nexport const APP_CONFIG_OVERRIDES = { ...base }\n`)
  try {
    const result = run(project.root, ['prepare'])
    assert.equal(result.status, 0, result.output)
    assert.doesNotMatch(result.output, /auth readiness/i)
    assert.equal(await readFile(join(project.root, 'registry-ran.txt'), 'utf8'), 'ran\n')
  } finally {
    await project.cleanup()
  }
})

test('build stops before next build when the check fails, with or without --no-registry', async () => {
  const project = await fixture(DEFAULTS)
  try {
    for (const args of [['build'], ['build', '--no-registry']]) {
      const result = run(project.root, args)
      assert.notEqual(result.status, 0, `${args.join(' ')}: ${result.output}`)
      assert.match(result.output, /AUTH_NO_AVAILABLE_METHOD/)
      await assert.rejects(readFile(join(project.root, 'next-ran.txt'), 'utf8'), `${args.join(' ')} launched next`)
    }

    const ready = run(project.root, ['build', '--no-registry'], VALID_EMAIL)
    assert.equal(ready.status, 0, ready.output)
    assert.equal(await readFile(join(project.root, 'next-ran.txt'), 'utf8'), 'next-was-run\n')
  } finally {
    await project.cleanup()
  }
})

test('a core without the check fails production preparation closed', async () => {
  const project = await fixture(DEFAULTS)
  try {
    await rm(join(project.root, 'node_modules/@nextsparkjs/core/scripts/build/auth-readiness.mjs'))
    const result = run(project.root, ['prepare', '--production'], VALID_EMAIL)
    assert.equal(result.status, 1, result.output)
    assert.match(result.output, /does not provide the production auth readiness check/)
  } finally {
    await project.cleanup()
  }
})

// A synthetic stand-in for a credential a theme config could print or throw
const SENTINEL = 're_SENTINELdoNotLeak0123456789'

const LEAKING_CONFIGS: [string, string][] = [
  ['prints through console and fd 1/2, then throws an error carrying it in code, name and message', `import { writeSync } from 'node:fs'
console.log('${SENTINEL}')
console.error('${SENTINEL}')
writeSync(1, '${SENTINEL}\\n')
writeSync(2, '${SENTINEL}\\n')
const error = new Error('${SENTINEL}')
Object.assign(error, { code: '${SENTINEL}', name: '${SENTINEL}' })
throw error
`],
  ['throws a string', `throw '${SENTINEL}'\n`],
  ['throws a SyntaxError carrying it in its code', `const error = new SyntaxError('${SENTINEL}')\nObject.assign(error, { code: '${SENTINEL}' })\nthrow error\n`],
  ['exits after printing', `process.stdout.write('${SENTINEL}\\n')\nprocess.exit(3)\n`],
  ['exports a non-boolean switch holding it', `export const APP_CONFIG_OVERRIDES = { auth: { methods: ['${SENTINEL}'], emailAndPassword: { enabled: '${SENTINEL}' } } }\n`],
]

test('nothing a project config prints or throws reaches the output, and the check fails closed', async () => {
  for (const [label, config] of LEAKING_CONFIGS) {
    const project = await fixture(config)
    try {
      const result = run(project.root, ['prepare', '--production'], { ...VALID_EMAIL, ...VALID_GOOGLE })
      assert.equal(result.status, 1, `${label}: ${result.output}`)
      assert.match(result.output, /AUTH_CONFIG_UNREADABLE/, label)
      assert.ok(!result.output.includes('SENTINEL'), `${label}: the sentinel leaked:\n${result.output}`)
    } finally {
      await project.cleanup()
    }
  }
})

test('a config that prints while loading still passes when a method is ready, without its output', async () => {
  const project = await fixture(`import { writeSync } from 'node:fs'
console.log('${SENTINEL}')
writeSync(2, '${SENTINEL}\\n')
export const APP_CONFIG_OVERRIDES = { auth: { methods: ['google', '${SENTINEL}'] } }
`)
  try {
    const result = run(project.root, ['prepare', '--production'], VALID_GOOGLE)
    assert.equal(result.status, 0, result.output)
    assert.ok(!result.output.includes('SENTINEL'), result.output)
  } finally {
    await project.cleanup()
  }
})

test('a project without app.config.ts is checked against the core defaults when explicitly represented', async () => {
  const project = await fixture(PROJECT_WITHOUT_CONFIG)
  try {
    const invalid = run(project.root, ['prepare', '--production'])
    assert.equal(invalid.status, 1, invalid.output)
    assert.match(invalid.output, /Login methods: email-otp, google/)

    const ready = run(project.root, ['prepare', '--production'], VALID_EMAIL)
    assert.equal(ready.status, 0, ready.output)
    // The default methods include Google, whose missing credentials are only a warning once email works
    assert.match(ready.output, /⚠️ \[google\] GOOGLE_CLIENT_ID_MISSING/)
  } finally {
    await project.cleanup()
  }
})

test('a core whose dist lacks the evaluator, or its exports, fails closed', async () => {
  const project = await fixture(methods(['google']))
  const evaluator = join(project.root, 'node_modules/@nextsparkjs/core/dist/lib/auth/readiness.js')
  try {
    await rm(evaluator)
    const missing = run(project.root, ['prepare', '--production'], VALID_GOOGLE)
    assert.equal(missing.status, 1, missing.output)
    assert.match(missing.output, /AUTH_EVALUATOR_UNAVAILABLE/)

    await writeFile(evaluator, 'export function evaluateAuthReadiness() { return { outcome: "ready" } }\n')
    const incomplete = run(project.root, ['prepare', '--production'], VALID_GOOGLE)
    assert.equal(incomplete.status, 1, incomplete.output)
    assert.match(incomplete.output, /AUTH_EVALUATOR_UNAVAILABLE/)
  } finally {
    await project.cleanup()
  }
})
