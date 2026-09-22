import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import {
  validateEnvSafeValue,
  validateGoogleClientId,
  validateGoogleClientSecret,
  validateResendApiKey,
  validateResendFromEmail,
} from '../src/wizard/validators/sign-in-provider.js'
import {
  assertProductionSignInResultConsistent,
  describeProductionSignInReadiness,
  getDefaultProductionSignIn,
  getProductionSignInChoices,
  type ProductionSignInResult,
} from '../src/wizard/prompts/production-sign-in.js'
import { writeProductionSignInEnv } from '../src/wizard/generators/production-sign-in-env.js'
// The real source of truth for placeholder/shape rules — imported directly
// (not re-implemented) so the table below tests actual parity, not two
// copies of the same assumption.
import { evaluateAuthReadiness } from '../../core/src/lib/auth/readiness.js'

// ---------------------------------------------------------------------------
// Validators — pinned against the rules issue #202 assigns to core's
// evaluator (packages/core/src/lib/auth/readiness.ts), duplicated here per
// the CLI's own module comment.
// ---------------------------------------------------------------------------

test('validateResendApiKey accepts a synthetic valid key and rejects malformed/placeholder ones', () => {
  assert.equal(validateResendApiKey('re_synthetic1234567890abcdef'), true)
  assert.notEqual(validateResendApiKey(''), true, 'empty is rejected')
  assert.notEqual(validateResendApiKey('re_...'), true, 'the historic placeholder is rejected (#202)')
  assert.notEqual(validateResendApiKey('re_short'), true, 'too short after re_ is rejected')
  assert.notEqual(validateResendApiKey('sk_synthetic1234567890abcdef'), true, 'wrong prefix is rejected')
  assert.notEqual(validateResendApiKey('re_your-api-key-here-123456'), true, 'placeholder word is rejected')
})

test('validateResendFromEmail accepts a synthetic valid address and rejects malformed/blocked/placeholder ones', () => {
  assert.equal(validateResendFromEmail('hello@synthetic-example-co.test'), true)
  assert.notEqual(validateResendFromEmail(''), true, 'empty is rejected')
  assert.notEqual(validateResendFromEmail('not-an-email'), true, 'malformed shape is rejected')
  assert.notEqual(validateResendFromEmail('hello@resend.dev'), true, 'resend.dev sender is rejected')
  assert.notEqual(validateResendFromEmail('hello@yourdomain.com'), true, 'yourdomain.com sender is rejected')
})

test('validateGoogleClientId accepts a synthetic valid id and rejects malformed/placeholder ones', () => {
  assert.equal(validateGoogleClientId('123456789012-synthetictoken1234.apps.googleusercontent.com'), true)
  assert.notEqual(validateGoogleClientId(''), true, 'empty is rejected')
  assert.notEqual(validateGoogleClientId('your-google-client-id'), true, 'placeholder is rejected')
  assert.notEqual(validateGoogleClientId('123456789012.apps.googleusercontent.com'), true, 'missing token segment is rejected')
})

test('validateGoogleClientSecret accepts a synthetic valid secret and rejects malformed/placeholder ones', () => {
  assert.equal(validateGoogleClientSecret('GOCSPX-synthetic1234567890'), true)
  assert.notEqual(validateGoogleClientSecret(''), true, 'empty is rejected')
  assert.notEqual(validateGoogleClientSecret('short'), true, 'under 8 chars is rejected')
  assert.notEqual(validateGoogleClientSecret('has whitespace here'), true, 'whitespace is rejected')
  assert.notEqual(validateGoogleClientSecret('changeme'), true, 'placeholder word is rejected')
  // NOT a placeholder: core's word-boundary rule requires a delimiter right after the
  // word too, and "123" isn't one — this is a real (if unwise) secret shape (see the
  // parity table below, which pins this exact case against core's evaluator).
  assert.equal(validateGoogleClientSecret('changeme123'), true, 'an unbounded placeholder word is not flagged, matching core')
})

// ---------------------------------------------------------------------------
// Parity — the wizard's field-level verdict must equal core's
// evaluateAuthReadiness verdict (environment: 'production', stage: 'runtime',
// profile: 'web-local-auth') for the same value, field by field. This is the
// actual contract check the module comment promises; the hand-picked tests
// above are cheap smoke tests, this is the tripwire.
//
// Table entries also pin the specific shapes a prior review round found
// diverging: delimiter-bounded replace/change/todo/placeholder/xxx runs, a
// sender with a lone `>`, embedded-but-unbounded `changeme`, `your` adjacent
// to a digit, and an interior (not fully-wrapped) `<...>` in a secret.
// ---------------------------------------------------------------------------

const VALID_RESEND_KEY = 're_synthetic1234567890abcdef'
const VALID_RESEND_EMAIL = 'hello@synthetic-example-co.test'
const VALID_GOOGLE_ID = '123456789012-synthetictoken1234.apps.googleusercontent.com'
const VALID_GOOGLE_SECRET = 'GOCSPX-synthetic1234567890'

interface FieldCase {
  label: string
  value: string
  /** What both sides are expected to agree on — asserted independently of the parity check itself. */
  expectValid: boolean
}

function coreResendOutcome(apiKey: string, fromEmail: string): string {
  return evaluateAuthReadiness({
    profile: 'web-local-auth',
    stage: 'runtime',
    environment: 'production',
    authConfig: { methods: ['email-otp'] },
    configuration: { email: { resendApiKey: apiKey, resendFromEmail: fromEmail } },
  }).outcome
}

function coreGoogleOutcome(clientId: string, clientSecret: string): string {
  return evaluateAuthReadiness({
    profile: 'web-local-auth',
    stage: 'runtime',
    environment: 'production',
    authConfig: { methods: ['google'] },
    configuration: { google: { clientId, clientSecret } },
  }).outcome
}

const RESEND_API_KEY_CASES: FieldCase[] = [
  { label: 'synthetic valid key', value: VALID_RESEND_KEY, expectValid: true },
  { label: 'empty', value: '', expectValid: false },
  { label: 'historic ellipsis placeholder (#202)', value: 're_...', expectValid: false },
  { label: 'too short after re_', value: 're_short', expectValid: false },
  { label: 'wrong prefix', value: 'sk_synthetic1234567890abcdef', expectValid: false },
  { label: 'delimiter-bounded "replace"', value: 're_replace-token-1234567890', expectValid: false },
  { label: 'delimiter-bounded x-run', value: 're_xxx-token1234567890', expectValid: false },
  { label: 'embedded "changeme", not delimiter-bounded', value: 're_mychangemevalue1234567890', expectValid: true },
  { label: '"your" adjacent to a digit, not delimiter-bounded', value: 're_1your-abcdefghijklmnop', expectValid: true },
  { label: 'delimiter-bounded "your"', value: 're_your-key-abcdefghijklmnop', expectValid: false },
  { label: 'fully <wrapped> placeholder', value: '<your-resend-key>', expectValid: false },
]

const RESEND_FROM_EMAIL_CASES: FieldCase[] = [
  { label: 'synthetic valid address', value: VALID_RESEND_EMAIL, expectValid: true },
  { label: 'empty', value: '', expectValid: false },
  { label: 'malformed shape', value: 'not-an-email', expectValid: false },
  { label: 'lone ">" character', value: 'local>@domain.test', expectValid: false },
  { label: 'resend.dev sandbox sender', value: 'hello@resend.dev', expectValid: false },
  { label: 'yourdomain.com documented placeholder', value: 'hello@yourdomain.com', expectValid: false },
  { label: 'embedded "changeme" in local part, not delimiter-bounded', value: 'mychangemeuser@synthetic-example-co.test', expectValid: true },
]

const GOOGLE_CLIENT_ID_CASES: FieldCase[] = [
  { label: 'synthetic valid id', value: VALID_GOOGLE_ID, expectValid: true },
  { label: 'empty', value: '', expectValid: false },
  { label: 'placeholder id', value: 'your-google-client-id', expectValid: false },
  { label: 'delimiter-bounded "replace"', value: '123-replace-token.apps.googleusercontent.com', expectValid: false },
  { label: 'missing token segment', value: '123456789012.apps.googleusercontent.com', expectValid: false },
  { label: 'embedded "changeme", not delimiter-bounded', value: '123456789012-mychangemetoken.apps.googleusercontent.com', expectValid: true },
]

const GOOGLE_CLIENT_SECRET_CASES: FieldCase[] = [
  { label: 'synthetic valid secret', value: VALID_GOOGLE_SECRET, expectValid: true },
  { label: 'empty', value: '', expectValid: false },
  { label: 'under 8 characters', value: 'short12', expectValid: false },
  { label: 'contains whitespace', value: 'has space here', expectValid: false },
  { label: 'embedded "changeme", not delimiter-bounded', value: 'changeme123', expectValid: true },
  { label: 'interior <...> pair, not fully wrapped', value: 'abc<def>ghi12345', expectValid: true },
  { label: 'fully <wrapped> placeholder', value: '<your-secret-here>', expectValid: false },
  { label: 'delimiter-bounded "replace"', value: 'replace-token-1234567890', expectValid: false },
]

test('parity: RESEND_API_KEY — wizard verdict matches evaluateAuthReadiness verdict for every case', () => {
  for (const { label, value, expectValid } of RESEND_API_KEY_CASES) {
    const wizardValid = validateResendApiKey(value) === true
    const coreValid = coreResendOutcome(value, VALID_RESEND_EMAIL) === 'ready'
    assert.equal(wizardValid, expectValid, `wizard: ${label}`)
    assert.equal(coreValid, expectValid, `core: ${label}`)
    assert.equal(wizardValid, coreValid, `parity: ${label}`)
  }
})

test('parity: RESEND_FROM_EMAIL — wizard verdict matches evaluateAuthReadiness verdict for every case', () => {
  for (const { label, value, expectValid } of RESEND_FROM_EMAIL_CASES) {
    const wizardValid = validateResendFromEmail(value) === true
    const coreValid = coreResendOutcome(VALID_RESEND_KEY, value) === 'ready'
    assert.equal(wizardValid, expectValid, `wizard: ${label}`)
    assert.equal(coreValid, expectValid, `core: ${label}`)
    assert.equal(wizardValid, coreValid, `parity: ${label}`)
  }
})

test('parity: GOOGLE_CLIENT_ID — wizard verdict matches evaluateAuthReadiness verdict for every case', () => {
  for (const { label, value, expectValid } of GOOGLE_CLIENT_ID_CASES) {
    const wizardValid = validateGoogleClientId(value) === true
    const coreValid = coreGoogleOutcome(value, VALID_GOOGLE_SECRET) === 'ready'
    assert.equal(wizardValid, expectValid, `wizard: ${label}`)
    assert.equal(coreValid, expectValid, `core: ${label}`)
    assert.equal(wizardValid, coreValid, `parity: ${label}`)
  }
})

test('parity: GOOGLE_CLIENT_SECRET — wizard verdict matches evaluateAuthReadiness verdict for every case', () => {
  for (const { label, value, expectValid } of GOOGLE_CLIENT_SECRET_CASES) {
    const wizardValid = validateGoogleClientSecret(value) === true
    const coreValid = coreGoogleOutcome(VALID_GOOGLE_ID, value) === 'ready'
    assert.equal(wizardValid, expectValid, `wizard: ${label}`)
    assert.equal(coreValid, expectValid, `core: ${label}`)
    assert.equal(wizardValid, coreValid, `parity: ${label}`)
  }
})

// ---------------------------------------------------------------------------
// Choice builder — only offers Google when the wizard's own Step 8 enabled it
// ---------------------------------------------------------------------------

test('production sign-in choices exclude Google when Google OAuth is disabled, include it when enabled', () => {
  const withoutGoogle = getProductionSignInChoices({ googleOAuth: false })
  const values = withoutGoogle.map((choice) => choice.value)
  assert.deepEqual(values, ['resend', 'postpone'])

  const withGoogle = getProductionSignInChoices({ googleOAuth: true })
  const valuesWithGoogle = withGoogle.map((choice) => choice.value)
  assert.deepEqual(valuesWithGoogle, ['resend', 'google', 'both', 'postpone'])
})

// ---------------------------------------------------------------------------
// Readiness summary — secret-free by construction
// ---------------------------------------------------------------------------

test('describeProductionSignInReadiness marks a postponed project local-only and never echoes secret values', () => {
  const postponed: ProductionSignInResult = getDefaultProductionSignIn()
  const lines = describeProductionSignInReadiness(postponed)
  assert.ok(lines.some((line) => /LOCAL-ONLY/.test(line)))
  assert.ok(lines.some((line) => /NEXTSPARK_AUTH_RUNTIME_ONLY/.test(line)))

  const configured: ProductionSignInResult = {
    postponed: false,
    resend: { apiKey: 're_synthetic-secret-should-not-appear', fromEmail: 'hello@synthetic-example-co.test' },
  }
  const configuredLines = describeProductionSignInReadiness(configured)
  assert.ok(configuredLines.some((line) => /Resend/.test(line)))
  assert.ok(!configuredLines.join('\n').includes('re_synthetic-secret-should-not-appear'), 'the readiness summary never echoes the secret value')
})

// ---------------------------------------------------------------------------
// Env writer — values only ever land in .env, never .env.example, and the
// historic `RESEND_API_KEY="re_..."` placeholder can never be written as if
// it were a real, active value.
// ---------------------------------------------------------------------------

const ENV_EXAMPLE_FIXTURE = `# NextSpark Environment Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/database"

# EMAIL (Resend)
# RESEND_API_KEY="re_..."
RESEND_FROM_NAME=
RESEND_FROM_EMAIL=

# GOOGLE OAUTH
# GOOGLE_CLIENT_ID="your-google-client-id"
# GOOGLE_CLIENT_SECRET="your-google-client-secret"
`

async function withTempProject(run: (root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-signin-'))
  try {
    await writeFile(join(root, '.env.example'), ENV_EXAMPLE_FIXTURE, 'utf8')
    await writeFile(join(root, '.env'), ENV_EXAMPLE_FIXTURE, 'utf8')
    await run(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

test('postponing writes the local-only marker and no provider values, and never touches .env.example', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env.example'), 'utf8')

    await writeProductionSignInEnv(root, getDefaultProductionSignIn())

    const envExampleAfter = await readFile(join(root, '.env.example'), 'utf8')
    assert.equal(envExampleAfter, before, '.env.example is never modified by this writer')

    const env = await readFile(join(root, '.env'), 'utf8')
    assert.match(env, /LOCAL-ONLY/)
    assert.doesNotMatch(env, /^RESEND_API_KEY=/m, 'no Resend key is written when postponed')
    assert.doesNotMatch(env, /^GOOGLE_CLIENT_ID=/m, 'no Google client id is written when postponed')
    assert.doesNotMatch(env, /^RESEND_API_KEY="re_\.\.\."/m, 'the historic re_... placeholder is never written as an active value')
  })
})

test('choosing Resend writes RESEND_API_KEY/RESEND_FROM_EMAIL to .env only, and leaves Google untouched', async () => {
  await withTempProject(async (root) => {
    const synthetic = { apiKey: 're_synthetic1234567890abcdef', fromEmail: 'hello@synthetic-example-co.test' }

    await writeProductionSignInEnv(root, { postponed: false, resend: synthetic })

    const env = await readFile(join(root, '.env'), 'utf8')
    assert.match(env, /^RESEND_API_KEY="re_synthetic1234567890abcdef"$/m)
    assert.match(env, /^RESEND_FROM_EMAIL="hello@synthetic-example-co\.test"$/m)
    assert.doesNotMatch(env, /^GOOGLE_CLIENT_ID=/m, 'Google is untouched when only Resend was chosen')
    assert.match(env, /Configured for production sign-in: Resend/)

    const envExample = await readFile(join(root, '.env.example'), 'utf8')
    assert.doesNotMatch(envExample, /re_synthetic1234567890abcdef/, 'the secret is never written to .env.example')
  })
})

test('choosing Google writes GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET to .env only, and leaves Resend untouched', async () => {
  await withTempProject(async (root) => {
    const synthetic = { clientId: '123456789012-synthetictoken1234.apps.googleusercontent.com', clientSecret: 'GOCSPX-synthetic1234567890' }

    await writeProductionSignInEnv(root, { postponed: false, google: synthetic })

    const env = await readFile(join(root, '.env'), 'utf8')
    assert.match(env, /^GOOGLE_CLIENT_ID="123456789012-synthetictoken1234\.apps\.googleusercontent\.com"$/m)
    assert.match(env, /^GOOGLE_CLIENT_SECRET="GOCSPX-synthetic1234567890"$/m)
    assert.doesNotMatch(env, /^RESEND_API_KEY=/m, 'Resend is untouched when only Google was chosen')
    assert.match(env, /Configured for production sign-in: Google OAuth/)
  })
})

test('choosing both writes every value, and the write is never echoed to stdout', async () => {
  await withTempProject(async (root) => {
    const result: ProductionSignInResult = {
      postponed: false,
      resend: { apiKey: 're_synthetic1234567890abcdef', fromEmail: 'hello@synthetic-example-co.test' },
      google: { clientId: '123456789012-synthetictoken1234.apps.googleusercontent.com', clientSecret: 'GOCSPX-synthetic1234567890' },
    }

    const originalLog = console.log
    const printed: string[] = []
    console.log = (...args: unknown[]) => { printed.push(args.map(String).join(' ')) }
    try {
      await writeProductionSignInEnv(root, result)
    } finally {
      console.log = originalLog
    }

    assert.equal(printed.length, 0, 'the env writer never logs anything, so it cannot echo a secret')

    const env = await readFile(join(root, '.env'), 'utf8')
    assert.match(env, /RESEND_API_KEY="re_synthetic1234567890abcdef"/)
    assert.match(env, /GOOGLE_CLIENT_SECRET="GOCSPX-synthetic1234567890"/)
    assert.match(env, /Configured for production sign-in: Resend.*Google OAuth/)
  })
})

test('writeProductionSignInEnv is a no-op when .env does not exist yet', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-signin-noenv-'))
  try {
    await writeProductionSignInEnv(root, { postponed: false, resend: { apiKey: 're_synthetic1234567890abcdef', fromEmail: 'hello@synthetic-example-co.test' } })
    await assert.rejects(readFile(join(root, '.env'), 'utf8'), /ENOENT/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Writer boundary — `ProductionSignInResult` is a public type, so a
// placeholder-shaped value handed to `writeProductionSignInEnv` directly
// (bypassing the prompt entirely) must still be refused, never written.
// ---------------------------------------------------------------------------

test('a placeholder-shaped Resend key passed directly to the writer throws, leaves .env unchanged, and never names the value', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env'), 'utf8')
    const placeholder = 're_...'

    await assert.rejects(
      writeProductionSignInEnv(root, { postponed: false, resend: { apiKey: placeholder, fromEmail: VALID_RESEND_EMAIL } }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /RESEND_API_KEY/)
        assert.ok(!error.message.includes(placeholder), 'the thrown message never includes the rejected value')
        return true
      }
    )

    const after = await readFile(join(root, '.env'), 'utf8')
    assert.equal(after, before, '.env is byte-for-byte unchanged after a rejected write')
  })
})

test('a placeholder-shaped Google secret passed directly to the writer throws, leaves .env unchanged, and never names the value', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env'), 'utf8')
    const placeholder = '<your-secret-here>'

    await assert.rejects(
      writeProductionSignInEnv(root, { postponed: false, google: { clientId: VALID_GOOGLE_ID, clientSecret: placeholder } }),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /GOOGLE_CLIENT_SECRET/)
        assert.ok(!error.message.includes(placeholder), 'the thrown message never includes the rejected value')
        return true
      }
    )

    const after = await readFile(join(root, '.env'), 'utf8')
    assert.equal(after, before, '.env is byte-for-byte unchanged after a rejected write')
  })
})

test('a malformed Google client id passed directly to the writer throws before any field is written, even when the secret is fine', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env'), 'utf8')

    await assert.rejects(
      writeProductionSignInEnv(root, { postponed: false, google: { clientId: 'not-a-google-id', clientSecret: VALID_GOOGLE_SECRET } })
    )

    const after = await readFile(join(root, '.env'), 'utf8')
    assert.equal(after, before, 'nothing was written, not even the otherwise-valid secret')
  })
})

// ---------------------------------------------------------------------------
// .env quoting/escaping round-trip — this project's `dotenv` (v17) has no
// real backslash-escape syntax; a value containing a quote, `#`, backtick,
// or backslash can read back different from what was written (verified
// empirically below and in the module comments). `$` and other ordinary
// punctuation are fine inside a plain double-quoted value.
// ---------------------------------------------------------------------------

test('validateEnvSafeValue accepts $ and ordinary punctuation, and rejects quotes/#/backslash/backtick', () => {
  assert.equal(validateEnvSafeValue('GOCSPX-val$with$dollars-1234'), true)
  assert.equal(validateEnvSafeValue('GOCSPX-val-with-hyphens_and.dots1234'), true)
  assert.notEqual(validateEnvSafeValue('GOCSPX-val"with"quotes1234'), true)
  assert.notEqual(validateEnvSafeValue("GOCSPX-val'with'apostrophe1234"), true)
  assert.notEqual(validateEnvSafeValue('GOCSPX-val#withhash1234'), true)
  assert.notEqual(validateEnvSafeValue('GOCSPX-val\\withbackslash1234'), true)
  assert.notEqual(validateEnvSafeValue('GOCSPX-val`withbacktick1234'), true)
})

test('a Google secret containing $ round-trips exactly through dotenv once written', async () => {
  const { parse: parseDotenv } = await import('dotenv')
  await withTempProject(async (root) => {
    const secretWithDollar = 'GOCSPX-val$with$dollars-synthetic1234'

    await writeProductionSignInEnv(root, { postponed: false, google: { clientId: VALID_GOOGLE_ID, clientSecret: secretWithDollar } })

    const envContent = await readFile(join(root, '.env'), 'utf8')
    const parsed = parseDotenv(envContent)
    assert.equal(parsed.GOOGLE_CLIENT_SECRET, secretWithDollar, 'dotenv reads back exactly what was written')
  })
})

test('a Google secret containing a literal quote character is refused by the writer rather than risking a corrupted round-trip', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env'), 'utf8')
    // Non-whitespace, >= 8 chars, no recognized placeholder word — this shape
    // passes the core-parity check (see the parity table above) but must
    // still be refused for .env safety.
    const secretWithQuote = 'GOCSPX-val"with"quote1234'
    assert.equal(validateGoogleClientSecret(secretWithQuote), true, 'core-parity check alone would accept this shape')

    await assert.rejects(
      writeProductionSignInEnv(root, { postponed: false, google: { clientId: VALID_GOOGLE_ID, clientSecret: secretWithQuote } })
    )

    const after = await readFile(join(root, '.env'), 'utf8')
    assert.equal(after, before, '.env is unchanged rather than written with an unsafe value')
  })
})

// ---------------------------------------------------------------------------
// Monorepo path — `writeProductionSignInEnv` only ever touches the `.env` at
// the exact `projectPath` it is given. In a monorepo, `generateProject`
// calls it while cwd is `web/` (after its own chdir), so this pins that a
// sibling `.env` (e.g. a monorepo root's) is never touched.
// ---------------------------------------------------------------------------

test('in a monorepo-shaped layout, only the web/ project .env is written — the root .env is untouched', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-wizard-signin-monorepo-'))
  try {
    const webDir = join(root, 'web')
    await writeFile(join(root, '.env'), '# root .env — not a NextSpark project env\nROOT_ONLY=true\n', 'utf8')
    await (await import('node:fs/promises')).mkdir(webDir, { recursive: true })
    await writeFile(join(webDir, '.env'), ENV_EXAMPLE_FIXTURE, 'utf8')

    await writeProductionSignInEnv(webDir, {
      postponed: false,
      resend: { apiKey: VALID_RESEND_KEY, fromEmail: VALID_RESEND_EMAIL },
    })

    const rootEnv = await readFile(join(root, '.env'), 'utf8')
    assert.equal(rootEnv, '# root .env — not a NextSpark project env\nROOT_ONLY=true\n', 'the monorepo root .env is byte-for-byte untouched')

    const webEnv = await readFile(join(webDir, '.env'), 'utf8')
    assert.match(webEnv, new RegExp(`^RESEND_API_KEY="${VALID_RESEND_KEY}"$`, 'm'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// ---------------------------------------------------------------------------
// Result-shape invariant — `ProductionSignInResult` is a public type; a
// contradictory or empty shape (postponed: false with no provider, or
// postponed: true with one) must never be written or described as if it
// were consistent. The discriminated union in production-sign-in.ts rejects
// both shapes at compile time for a plain object literal, so these tests
// deliberately build one through an `as` cast — exactly how a direct
// `generateProject(config, { postponed: false })` call (the shape the
// review's repro used) or a stray test double would reach this code.
// ---------------------------------------------------------------------------

test('assertProductionSignInResultConsistent rejects postponed:false with no provider, and postponed:true with one', () => {
  const emptyConfigured = { postponed: false } as ProductionSignInResult
  assert.throws(() => assertProductionSignInResultConsistent(emptyConfigured), /no provider/)

  const postponedWithResend = {
    postponed: true,
    resend: { apiKey: VALID_RESEND_KEY, fromEmail: VALID_RESEND_EMAIL },
  } as ProductionSignInResult
  assert.throws(() => assertProductionSignInResultConsistent(postponedWithResend), /provider .* is also present/)

  // The two consistent shapes never throw.
  assert.doesNotThrow(() => assertProductionSignInResultConsistent(getDefaultProductionSignIn()))
  assert.doesNotThrow(() => assertProductionSignInResultConsistent({
    postponed: false,
    resend: { apiKey: VALID_RESEND_KEY, fromEmail: VALID_RESEND_EMAIL },
  }))
})

test('writeProductionSignInEnv refuses postponed:false with no provider before touching .env, naming no value', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env'), 'utf8')
    const emptyConfigured = { postponed: false } as ProductionSignInResult

    await assert.rejects(
      writeProductionSignInEnv(root, emptyConfigured),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /no provider/)
        return true
      }
    )

    const after = await readFile(join(root, '.env'), 'utf8')
    assert.equal(after, before, '.env is byte-for-byte unchanged — an empty "configured" result never gets written or marked configured')
  })
})

test('writeProductionSignInEnv refuses postponed:true carrying credentials before touching .env, naming no value', async () => {
  await withTempProject(async (root) => {
    const before = await readFile(join(root, '.env'), 'utf8')
    const postponedWithResend = {
      postponed: true,
      resend: { apiKey: VALID_RESEND_KEY, fromEmail: VALID_RESEND_EMAIL },
    } as ProductionSignInResult

    await assert.rejects(
      writeProductionSignInEnv(root, postponedWithResend),
      (error: unknown) => {
        assert.ok(error instanceof Error)
        assert.match(error.message, /provider .* is also present/)
        assert.ok(!error.message.includes(VALID_RESEND_KEY), 'the thrown message never includes the credential value')
        return true
      }
    )

    const after = await readFile(join(root, '.env'), 'utf8')
    assert.equal(after, before, '.env is byte-for-byte unchanged — credentials are never written under a LOCAL-ONLY marker')
  })
})

test('describeProductionSignInReadiness never claims "configured" for a postponed:false result with no provider', () => {
  const emptyConfigured = { postponed: false } as ProductionSignInResult
  assert.throws(() => describeProductionSignInReadiness(emptyConfigured), /no provider/)
})

test('describeProductionSignInReadiness never claims LOCAL-ONLY for a postponed:true result that actually carries credentials', () => {
  const postponedWithGoogle = {
    postponed: true,
    google: { clientId: VALID_GOOGLE_ID, clientSecret: VALID_GOOGLE_SECRET },
  } as ProductionSignInResult
  assert.throws(() => describeProductionSignInReadiness(postponedWithGoogle), /provider .* is also present/)
})
