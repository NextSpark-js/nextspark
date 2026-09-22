#!/usr/bin/env node

/**
 * Production auth readiness check
 *
 * Run by `nextspark prepare --production` (and so `nextspark build`) after the
 * registry build, before `next build`. It fails the build when the build
 * environment proves that no login method of the active theme can
 * authenticate. It reuses core's pure evaluator from dist/, fed the same
 * variables the runtime adapter reads, and prints only diagnostic codes,
 * messages and method names - never a configuration value.
 *
 * Contract (see docs/06-authentication/12-passwordless-preset.md):
 * - NEXTSPARK_AUTH_RUNTIME_ONLY: comma list of `email` and/or `google` whose
 *   credentials are injected only at runtime. Missing values of a declared
 *   provider are deferred to the runtime check; concrete invalid ones still fail.
 * - NEXTSPARK_AUTH_PREFLIGHT=off: the one bypass. Skips this check with a
 *   warning; the runtime gates and the startup check still apply.
 *
 * The theme's app.config.ts is loaded with Node's type stripping in a child
 * (auth-readiness-load.mjs) whose output is discarded. A config Node can't
 * load that way (path aliases, extensionless imports, non-strippable syntax)
 * fails closed with a fixed reason.
 *
 * NEXT_PUBLIC_ACTIVE_THEME set in both the environment and .env with different
 * values fails: the registry build prefers .env, next build the environment.
 *
 * @module core/scripts/build/auth-readiness
 */

import { spawn } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { parse } from 'dotenv'
import { contentDirectories } from './registry/project-mode.mjs'
import { extractExportName } from '../utils/file-utils.mjs'
import { shownPath } from '../utils/logging.mjs'

const scriptsDir = dirname(fileURLToPath(import.meta.url))
const coreDir = join(scriptsDir, '../..')
const env = process.env
const projectRoot = env.NEXTSPARK_PROJECT_ROOT || process.cwd()
const LOAD_TIMEOUT_MS = 15_000

const RUNTIME_ONLY_PROVIDERS = ['email', 'google']
const BYPASS = 'NEXTSPARK_AUTH_PREFLIGHT=off'

function fail(code, message, remediation = []) {
  console.log(`❌ Production auth readiness failed [${code}]: ${message}`)
  for (const line of remediation) console.log(`   ${line}`)
  process.exit(1)
}

/** The declared runtime-only providers, or null when the declaration holds an unsupported entry. */
function runtimeOnlyProviders(value) {
  const tokens = (value ?? '').split(',').map((token) => token.trim()).filter(Boolean)
  if (tokens.some((token) => !RUNTIME_ONLY_PROVIDERS.includes(token))) return null
  return new Set(tokens)
}

/** The active theme's auth overrides; exits when they can't be read. */
async function themeAuthConfig(themeName) {
  const { themesDir } = contentDirectories(projectRoot)
  const themeDir = join(themesDir, themeName)
  if (!existsSync(themeDir)) {
    fail('AUTH_THEME_NOT_FOUND', `the active theme ${shownPath(themeName)} was not found, so its login methods can't be checked.`, [
      'Set NEXT_PUBLIC_ACTIVE_THEME to an installed theme.',
    ])
  }

  const appConfigPath = join(themeDir, 'config', 'app.config.ts')
  // A theme without app.config.ts runs on core defaults, which the evaluator assumes when unset
  if (!existsSync(appConfigPath)) return null

  // The same export the registry imports for the theme's app config
  const exportName = (await extractExportName(appConfigPath, [
    /export\s+const\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))\s*[:=]/,
    /export\s+default\s+([a-zA-Z_]+(?:APP_CONFIG|AppConfig))/,
  ])) || 'APP_CONFIG_OVERRIDES'

  const unreadable = [
    'Keep the auth settings in app.config.ts as plain literals, without path-alias (@/...) or extensionless',
    'relative imports and without TypeScript syntax Node cannot strip (enums, namespaces).',
    `Or skip this build check with ${BYPASS}: runtime gates and the startup check still apply.`,
  ]
  const loaded = await loadThemeAuth(appConfigPath, exportName)
  if (!loaded.ok) {
    const reason = Object.hasOwn(LOAD_FAILURES, loaded.reason) ? LOAD_FAILURES[loaded.reason] : LOAD_FAILURES.other
    fail('AUTH_CONFIG_UNREADABLE', `config/app.config.ts of theme ${shownPath(themeName)} could not be read for its auth settings: ${reason}.`, unreadable)
  }
  if (loaded.auth === null) return null
  const auth = validAuthSubset(loaded.auth)
  if (!auth) {
    fail('AUTH_CONFIG_UNREADABLE', `config/app.config.ts of theme ${shownPath(themeName)} has auth settings of an unsupported shape.`, [
      'auth.methods must be an array of method names; auth.providers.google.enabled and auth.emailAndPassword.enabled must be true or false.',
    ])
  }
  return auth
}

/** What a load failure is reported as: only these fixed texts, never what the config threw. */
const LOAD_FAILURES = {
  'module-not-found': 'a module it imports was not found',
  'unsupported-typescript-syntax': 'it uses TypeScript syntax Node cannot strip',
  'unknown-file-extension': 'it imports a file type Node cannot load',
  'syntax-error': 'it has a syntax error',
  'missing-export': 'it does not export its app config as an object',
  timeout: `loading it did not finish within ${LOAD_TIMEOUT_MS / 1000}s`,
  other: 'loading it failed',
}

/**
 * Load the theme config in a child whose stdout and stderr are ignored, so
 * what the config prints or throws stays there. Only its IPC message returns.
 */
function loadThemeAuth(appConfigPath, exportName) {
  return new Promise((resolve) => {
    let settled = false
    const child = spawn(process.execPath, [
      '--experimental-strip-types',
      '--disable-warning=ExperimentalWarning',
      join(scriptsDir, 'auth-readiness-load.mjs'),
      appConfigPath,
      exportName,
    ], { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], env })
    const timer = setTimeout(() => done({ ok: false, reason: 'timeout' }), LOAD_TIMEOUT_MS)
    function done(result) {
      if (settled) return
      settled = true
      clearTimeout(timer)
      if (child.exitCode === null) child.kill('SIGKILL')
      resolve(result)
    }
    child.on('message', (message) => done(message && typeof message === 'object' ? message : { ok: false, reason: 'other' }))
    child.on('error', () => done({ ok: false, reason: 'other' }))
    child.on('exit', () => done({ ok: false, reason: 'other' }))
  })
}

/** The evaluator's authConfig from the loaded subset, or null when a field has an unexpected type. */
function validAuthSubset(subset) {
  if (!subset || typeof subset !== 'object') return null
  const { methods, googleEnabled, emailAndPasswordEnabled } = subset
  const optionalBoolean = (value) => value === undefined || typeof value === 'boolean'
  if (methods !== undefined && !(Array.isArray(methods) && methods.every((method) => typeof method === 'string'))) return null
  if (!optionalBoolean(googleEnabled) || !optionalBoolean(emailAndPasswordEnabled)) return null
  return {
    methods,
    providers: googleEnabled === undefined ? undefined : { google: { enabled: googleEnabled } },
    emailAndPassword: emailAndPasswordEnabled === undefined ? undefined : { enabled: emailAndPasswordEnabled },
  }
}

/**
 * The registry build reloads the project .env over the environment it is
 * given, so there the .env's NEXT_PUBLIC_ACTIVE_THEME wins, while this check
 * and `next build` see the environment's. When both set it and disagree, the
 * build would check a theme other than the one it compiles.
 */
function activeThemeConflict() {
  const envPath = join(projectRoot, '.env')
  if (!existsSync(envPath)) return null
  const fileTheme = parse(readFileSync(envPath)).NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '')
  const theme = env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '')
  return fileTheme && theme && fileTheme !== theme ? { fileTheme, theme } : null
}

async function main() {
  const preflight = env.NEXTSPARK_AUTH_PREFLIGHT ?? ''
  if (preflight === 'off') {
    console.log(`⚠️ Production auth readiness check skipped (${BYPASS}): this build does not prove that any login method can authenticate.`)
    console.log('⚠️ Runtime gates still refuse unusable login methods, and the server logs an error at startup when none can work.')
    return
  }
  if (preflight !== '' && preflight !== 'on') {
    fail('AUTH_PREFLIGHT_UNSUPPORTED', 'NEXTSPARK_AUTH_PREFLIGHT accepts only "off" (skip this check) or "on".')
  }

  const runtimeOnly = runtimeOnlyProviders(env.NEXTSPARK_AUTH_RUNTIME_ONLY)
  if (!runtimeOnly) {
    fail('AUTH_RUNTIME_ONLY_UNSUPPORTED', 'NEXTSPARK_AUTH_RUNTIME_ONLY contains an unsupported entry.', [
      `Use a comma-separated list of: ${RUNTIME_ONLY_PROVIDERS.join(', ')} (for example NEXTSPARK_AUTH_RUNTIME_ONLY=email,google).`,
    ])
  }

  const themeName = env.NEXT_PUBLIC_ACTIVE_THEME?.replace(/'/g, '')
  if (!themeName) {
    fail('AUTH_THEME_UNSET', 'NEXT_PUBLIC_ACTIVE_THEME is not set, so the login methods to check are unknown.', [
      'Set NEXT_PUBLIC_ACTIVE_THEME in .env or the build environment.',
    ])
  }

  const conflict = activeThemeConflict()
  if (conflict) {
    fail('AUTH_THEME_CONFLICT', `NEXT_PUBLIC_ACTIVE_THEME is ${shownPath(conflict.theme)} in the environment but ${shownPath(conflict.fileTheme)} in .env: the registry build would compile ${shownPath(conflict.fileTheme)} while this check and next build use ${shownPath(conflict.theme)}.`, [
      'Make them agree: set the same NEXT_PUBLIC_ACTIVE_THEME in .env and the build environment, or set it in only one of them.',
    ])
  }

  let evaluator
  try {
    evaluator = await import(pathToFileURL(join(coreDir, 'dist/lib/auth/readiness.js')).href)
    if (typeof evaluator.evaluateAuthReadiness !== 'function' || typeof evaluator.authReadinessConfigurationFromEnv !== 'function') {
      throw new Error('incomplete evaluator')
    }
  } catch {
    fail('AUTH_EVALUATOR_UNAVAILABLE', "core's auth readiness evaluator (dist/lib/auth/readiness.js) could not be loaded.", [
      'Build @nextsparkjs/core first (in the monorepo: pnpm --filter @nextsparkjs/core build).',
    ])
  }

  const authConfig = await themeAuthConfig(themeName)
  const configuration = evaluator.authReadinessConfigurationFromEnv(env)
  configuration.email.runtimeOnly = runtimeOnly.has('email')
  configuration.google.runtimeOnly = runtimeOnly.has('google')

  const result = evaluator.evaluateAuthReadiness({
    profile: 'web-local-auth',
    stage: 'build',
    environment: 'production',
    authConfig,
    configuration,
  })
  const diagnosticLine = ({ method, code, message }) => `[${method}] ${code}: ${message}`

  if (result.outcome === 'invalid') {
    console.log(`❌ Production auth readiness failed: no login method of theme ${shownPath(themeName)} can authenticate with this build environment.`)
    console.log(`   Login methods: ${result.declaredMethods.join(', ')}`)
    for (const diagnostic of result.diagnostics) console.log(`❌ ${diagnosticLine(diagnostic)}`)
    console.log('   Fix: set the variables named above in .env or the build environment (email: EMAIL_PROVIDER=resend,')
    console.log('   RESEND_API_KEY, RESEND_FROM_EMAIL; Google: GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET), or change auth.methods.')
    console.log('   Credentials injected only at runtime: declare them with NEXTSPARK_AUTH_RUNTIME_ONLY=email,google;')
    console.log('   they are validated again when the server starts and on every login request.')
    process.exit(1)
  }

  if (result.outcome === 'deferred') {
    console.log(`⚠️ Production auth readiness deferred to runtime for: ${result.deferredMethods.join(', ')} (NEXTSPARK_AUTH_RUNTIME_ONLY).`)
  } else {
    console.log(`✅ Production auth readiness: ${result.availableMethods.join(', ')} can authenticate.`)
  }
  for (const diagnostic of result.diagnostics) console.log(`⚠️ ${diagnosticLine(diagnostic)}`)
}

main().catch(() => {
  fail('AUTH_PREFLIGHT_ERROR', 'the check could not complete.', [
    `Report this issue, or skip the build check with ${BYPASS}: runtime gates still apply.`,
  ])
})
