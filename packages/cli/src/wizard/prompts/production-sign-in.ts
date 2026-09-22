/**
 * Production Sign-In Provider Prompt
 *
 * NextSpark projects default to passwordless sign-in (email one-time code +
 * Google OAuth). Neither path works in production without a provider:
 * - Resend (RESEND_API_KEY + RESEND_FROM_EMAIL) delivers the sign-in code.
 *   Without it, emails only print to the dev server log.
 * - Google OAuth (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) is only offered
 *   when the wizard's own Google OAuth choice (Step 8) enabled it.
 *
 * This step collects one or both, or lets the user explicitly postpone —
 * in which case the project is generated LOCAL-ONLY and the wizard's final
 * summary (and the .env comments) say so. Password login is never offered
 * here as a substitute: it is not an automatic production fallback (#202).
 *
 * Values are only ever written to the project's local `.env` — never to
 * `.env.example`, never echoed to the console or the summary — by
 * `../generators/production-sign-in-env.js`.
 */

import { password, input, select } from '@inquirer/prompts'
import chalk from '../../utils/colors.js'
import type { AuthConfig } from '../types.js'
import {
  validateEnvSafeValue,
  validateGoogleClientId,
  validateGoogleClientSecret,
  validateResendApiKey,
  validateResendFromEmail,
  type ValidationResult,
} from '../validators/sign-in-provider.js'

/**
 * Runs the core-parity shape check first, then the CLI-only `.env`-safety
 * check — so a value that would otherwise pass validation but corrupt on
 * write (see `validateEnvSafeValue`) is caught here, in the prompt, rather
 * than surfacing as a thrown error from the writer after the user has
 * already moved on.
 */
function withEnvSafety(validate: (value: string) => ValidationResult) {
  return (value: string): ValidationResult => {
    const shapeResult = validate(value)
    if (shapeResult !== true) return shapeResult
    return validateEnvSafeValue(value)
  }
}

export type ProductionSignInChoice = 'resend' | 'google' | 'both' | 'postpone'

export interface ResendCredentials {
  apiKey: string
  fromEmail: string
}

export interface GoogleCredentials {
  clientId: string
  clientSecret: string
}

/** `postponed: false` with resend required (google optional alongside it). */
interface ConfiguredWithResend {
  resend: ResendCredentials
  google?: GoogleCredentials
}

/** `postponed: false` with only google (no resend). */
interface ConfiguredWithGoogleOnly {
  resend?: undefined
  google: GoogleCredentials
}

/**
 * Result of the production sign-in step — a discriminated union so the two
 * states this type must never represent (a "configured" result with no
 * provider, or a "postponed" result carrying credentials) cannot be built
 * as an object literal: `postponed: true` allows no `resend`/`google` at
 * all, and `postponed: false` requires at least one of them.
 *
 * `ProductionSignInResult` is still a public type, though — a direct call
 * (`generateProject(config, result)`), a test, or a future flag can still
 * construct or receive one this module did not build itself (typically via
 * an `as`/`any` cast, since the union above rejects the bad shapes at
 * compile time for anyone who doesn't cast around it). For that reason
 * `assertProductionSignInResultConsistent` below is a runtime backstop:
 * both `writeProductionSignInEnv` and `describeProductionSignInReadiness`
 * call it before doing anything else with a `ProductionSignInResult` they
 * receive as a parameter.
 */
export type ProductionSignInResult =
  | { postponed: true; resend?: undefined; google?: undefined }
  | ({ postponed: false } & (ConfiguredWithResend | ConfiguredWithGoogleOnly))

/**
 * Throws unless `result` is internally consistent (see the type doc above).
 * The message names only the shape problem, never any credential value —
 * there is nothing else to name, since inconsistency is about which fields
 * are present/absent, not what they contain.
 */
export function assertProductionSignInResultConsistent(result: ProductionSignInResult): void {
  const hasProvider = Boolean(result.resend) || Boolean(result.google)
  if (result.postponed && hasProvider) {
    throw new Error(
      'Invalid ProductionSignInResult: postponed is true but a provider (resend or google) is also present.'
    )
  }
  if (!result.postponed && !hasProvider) {
    throw new Error(
      'Invalid ProductionSignInResult: postponed is false but no provider (resend or google) is present.'
    )
  }
}

export interface ProductionSignInChoiceOption {
  name: string
  value: ProductionSignInChoice
  description: string
}

/**
 * Build the list of choices offered, consistent with the auth methods the
 * wizard already selected: Google is only offered when Step 8 enabled
 * Google OAuth (`auth.googleOAuth`). Resend is always offered because the
 * default passwordless preset always needs it for the email one-time code.
 */
export function getProductionSignInChoices(
  auth: Pick<AuthConfig, 'googleOAuth'>
): ProductionSignInChoiceOption[] {
  const choices: ProductionSignInChoiceOption[] = [
    {
      name: 'Resend (transactional email for the sign-in code)',
      value: 'resend',
      description: 'Sets RESEND_API_KEY and RESEND_FROM_EMAIL',
    },
  ]

  if (auth.googleOAuth) {
    choices.push({
      name: 'Google OAuth ("Continue with Google")',
      value: 'google',
      description: 'Sets GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET',
    })
    choices.push({
      name: 'Both Resend and Google',
      value: 'both',
      description: 'Configure both providers now',
    })
  }

  choices.push({
    name: 'Configure later (local-only, not production-ready)',
    value: 'postpone',
    description: 'Skip for now — the project will be marked local-only for sign-in',
  })

  return choices
}

/** The result used whenever this step is skipped: `--yes`, quick mode, or a preset run. */
export function getDefaultProductionSignIn(): ProductionSignInResult {
  return { postponed: true }
}

/**
 * Plain-text lines summarizing production sign-in readiness for the
 * wizard's final "next steps" output. Pure and secret-free: it only reads
 * `postponed`/which providers are present, never `apiKey`/`clientSecret`
 * values, so it is safe to print as-is.
 *
 * Throws via `assertProductionSignInResultConsistent` on an inconsistent
 * `result` rather than ever printing "configured" for a result with no
 * provider (or "LOCAL-ONLY" for one that actually has credentials).
 */
export function describeProductionSignInReadiness(result: ProductionSignInResult): string[] {
  assertProductionSignInResultConsistent(result)

  if (result.postponed) {
    return [
      'Sign-in: LOCAL-ONLY — no production provider configured yet.',
      'Set RESEND_API_KEY + RESEND_FROM_EMAIL and/or GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET in .env,',
      'or declare runtime injection with NEXTSPARK_AUTH_RUNTIME_ONLY=email,google before deploying.',
    ]
  }

  const configured: string[] = []
  if (result.resend) configured.push('Resend')
  if (result.google) configured.push('Google OAuth')

  return [`Sign-in: production provider configured (${configured.join(', ')}).`]
}

async function promptResendCredentials(): Promise<ResendCredentials> {
  const apiKey = await password({
    message: 'Resend API key (starts with re_):',
    mask: '*',
    validate: withEnvSafety(validateResendApiKey),
  })

  const fromEmail = await input({
    message: 'Sender email address (RESEND_FROM_EMAIL):',
    validate: withEnvSafety(validateResendFromEmail),
  })

  return { apiKey: apiKey.trim(), fromEmail: fromEmail.trim() }
}

async function promptGoogleCredentials(): Promise<GoogleCredentials> {
  const clientId = await input({
    message: 'Google OAuth client ID:',
    validate: withEnvSafety(validateGoogleClientId),
  })

  const clientSecret = await password({
    message: 'Google OAuth client secret:',
    mask: '*',
    validate: withEnvSafety(validateGoogleClientSecret),
  })

  return { clientId: clientId.trim(), clientSecret: clientSecret.trim() }
}

/**
 * Run the production sign-in prompt.
 *
 * Only meaningful interactively — callers skip it entirely for `--yes`,
 * quick mode, and preset runs, using `getDefaultProductionSignIn()` instead.
 */
export async function promptProductionSignIn(
  auth: Pick<AuthConfig, 'googleOAuth'>
): Promise<ProductionSignInResult> {
  console.log('')
  console.log(chalk.cyan('  Production Sign-In'))
  console.log(chalk.gray('  ' + '-'.repeat(40)))
  console.log('')
  console.log(chalk.gray('  Your login is passwordless by default (email code + Google).'))
  console.log(chalk.gray('  Production needs at least one working provider — a password is'))
  console.log(chalk.gray('  never used as an automatic fallback.'))
  console.log('')

  const choice = await select<ProductionSignInChoice>({
    message: 'Set up a production sign-in provider now?',
    choices: getProductionSignInChoices(auth),
    default: 'postpone',
  })

  if (choice === 'postpone') {
    return { postponed: true }
  }

  if (choice === 'resend') {
    return { postponed: false, resend: await promptResendCredentials() }
  }

  if (choice === 'google') {
    return { postponed: false, google: await promptGoogleCredentials() }
  }

  // choice === 'both'
  const resend = await promptResendCredentials()
  const google = await promptGoogleCredentials()
  return { postponed: false, resend, google }
}
