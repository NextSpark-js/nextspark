/**
 * Production Sign-In Env Writer
 *
 * Writes the production sign-in provider values collected by the wizard's
 * `promptProductionSignIn` step (see `../prompts/production-sign-in.js`)
 * into the project's local `.env` file — and only there. `.env.example`
 * stays documentation-only (placeholders, commented out), never a place
 * real credentials land (#202).
 *
 * Also writes a short comment marking the project LOCAL-ONLY (not
 * production-ready for sign-in) when no provider was configured, so a
 * project owner opening `.env` sees the gap without re-running the wizard.
 *
 * Values are never logged: this module only touches the file on disk.
 *
 * This is a second, independent validation boundary — not a rubber stamp on
 * `promptProductionSignIn`'s own checks. `ProductionSignInResult` is a
 * public type; any caller (a future flag, a test, `generateProject` called
 * directly) can hand this function a placeholder-shaped value without going
 * through the prompt at all, and "placeholders must never be written as if
 * real" has to hold regardless of how a value arrived here. So every value
 * is re-validated with the exact same validators immediately before the
 * file is touched; on the first failure nothing has been read or written
 * yet, and the error names only the variable, never the value.
 */

import fs from 'fs-extra'
import path from 'path'
import { assertProductionSignInResultConsistent, type ProductionSignInResult } from '../prompts/production-sign-in.js'
import {
  validateEnvSafeValue,
  validateGoogleClientId,
  validateGoogleClientSecret,
  validateResendApiKey,
  validateResendFromEmail,
  type ValidationResult,
} from '../validators/sign-in-provider.js'

const MARKER_START = '# === PRODUCTION SIGN-IN READINESS (nextspark init) ==='
const MARKER_END = '# === END PRODUCTION SIGN-IN READINESS ==='

/**
 * Set (uncommenting if needed) or append a `KEY="value"` line. Never logs
 * `value`. No escaping is applied — `value` has already passed
 * `validateEnvSafeValue` (asserted in `writeProductionSignInEnv` below), so
 * it is guaranteed free of `"`, `'`, `` ` ``, `#`, `\`, and line breaks; this
 * project's `dotenv` (v17) has no real escape syntax, so writing anything
 * else here would risk a `.env` that reads back a different value than the
 * one the user typed (verified empirically in
 * wizard-sign-in-provider.test.ts).
 */
function setEnvVar(content: string, key: string, value: string): string {
  const pattern = new RegExp(`^#?\\s*${key}\\s*=.*$`, 'm')
  const line = `${key}="${value}"`
  if (pattern.test(content)) {
    return content.replace(pattern, line)
  }
  return content.trimEnd() + `\n${line}\n`
}

/** Remove a previously written readiness marker block, if present (idempotent rewrite). */
function stripExistingMarker(content: string): string {
  const startIndex = content.indexOf(MARKER_START)
  if (startIndex === -1) return content
  const endIndex = content.indexOf(MARKER_END)
  if (endIndex === -1) return content
  const before = content.slice(0, startIndex)
  const after = content.slice(endIndex + MARKER_END.length)
  return (before.replace(/\n*$/, '\n') + after.replace(/^\n*/, '')).trimEnd() + '\n'
}

function buildMarkerBlock(result: ProductionSignInResult): string {
  if (result.postponed) {
    return [
      MARKER_START,
      '# LOCAL-ONLY: no production sign-in provider is configured.',
      '# This project is NOT production-ready for sign-in yet. Fix it by either:',
      '#   1. Setting RESEND_API_KEY + RESEND_FROM_EMAIL above (email sign-in code), and/or',
      '#      GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET above ("Continue with Google"), or',
      '#   2. Declaring runtime-only injection (credentials supplied outside this file,',
      '#      e.g. by your host) with NEXTSPARK_AUTH_RUNTIME_ONLY=email,google.',
      '# `nextspark prepare --production` / `nextspark build` enforce this at build time',
      '# unless bypassed with NEXTSPARK_AUTH_PREFLIGHT=off (not recommended).',
      '# Password login is not an automatic fallback for either method.',
      MARKER_END,
      '',
    ].join('\n')
  }

  const configured: string[] = []
  if (result.resend) configured.push('Resend (email sign-in code)')
  if (result.google) configured.push('Google OAuth')

  return [
    MARKER_START,
    `# Configured for production sign-in: ${configured.join(', ')}.`,
    '# Values above were entered in the wizard and are only written to this local',
    '# .env file, never to .env.example, logs, or the wizard summary.',
    MARKER_END,
    '',
  ].join('\n')
}

/** Throws (naming only `variable`, never the value) unless `validation` is `true`. */
function assertValid(variable: string, validation: ValidationResult): void {
  if (validation !== true) {
    throw new Error(`Refusing to write ${variable} to .env: it did not pass production sign-in validation.`)
  }
}

/**
 * Write the production sign-in result into `${projectPath}/.env`.
 *
 * `result`'s own shape is checked first (`assertProductionSignInResultConsistent`
 * — a `postponed: false` result with no provider, or a `postponed: true`
 * result carrying one, is refused outright: writing either would either
 * silently mark an unconfigured project "configured" or discard real
 * credentials under a LOCAL-ONLY marker). Every provided value is then
 * re-validated (see the module comment above). On the first problem this
 * throws before reading or writing `.env` at all, so a rejected call is
 * guaranteed to leave the file untouched.
 *
 * No-op if `.env` does not exist yet (nothing earlier in the flow created
 * it) — this function only ever updates an existing file, and only that
 * file, never `.env.example`.
 */
export async function writeProductionSignInEnv(
  projectPath: string,
  result: ProductionSignInResult
): Promise<void> {
  assertProductionSignInResultConsistent(result)

  if (result.resend) {
    assertValid('RESEND_API_KEY', validateResendApiKey(result.resend.apiKey))
    assertValid('RESEND_API_KEY', validateEnvSafeValue(result.resend.apiKey))
    assertValid('RESEND_FROM_EMAIL', validateResendFromEmail(result.resend.fromEmail))
    assertValid('RESEND_FROM_EMAIL', validateEnvSafeValue(result.resend.fromEmail))
  }
  if (result.google) {
    assertValid('GOOGLE_CLIENT_ID', validateGoogleClientId(result.google.clientId))
    assertValid('GOOGLE_CLIENT_ID', validateEnvSafeValue(result.google.clientId))
    assertValid('GOOGLE_CLIENT_SECRET', validateGoogleClientSecret(result.google.clientSecret))
    assertValid('GOOGLE_CLIENT_SECRET', validateEnvSafeValue(result.google.clientSecret))
  }

  const envPath = path.join(projectPath, '.env')

  if (!await fs.pathExists(envPath)) {
    return
  }

  let content = await fs.readFile(envPath, 'utf-8')

  if (result.resend) {
    content = setEnvVar(content, 'RESEND_API_KEY', result.resend.apiKey)
    content = setEnvVar(content, 'RESEND_FROM_EMAIL', result.resend.fromEmail)
  }

  if (result.google) {
    content = setEnvVar(content, 'GOOGLE_CLIENT_ID', result.google.clientId)
    content = setEnvVar(content, 'GOOGLE_CLIENT_SECRET', result.google.clientSecret)
  }

  content = stripExistingMarker(content).trimEnd() + '\n\n' + buildMarkerBlock(result)

  await fs.writeFile(envPath, content, 'utf-8')
}
