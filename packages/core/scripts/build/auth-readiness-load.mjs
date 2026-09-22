/**
 * Theme auth config loader for the production auth readiness check
 *
 * Started by auth-readiness.mjs with stdout and stderr ignored and an IPC
 * channel as its only output, so nothing the theme config (or what it imports)
 * prints or throws can reach the build output. It sends back only the auth
 * subset the check needs, or a reason key from a fixed list - never an error's
 * code, name or message.
 *
 * Arguments: <app.config.ts path> <export name>
 *
 * @module core/scripts/build/auth-readiness-load
 */

import { pathToFileURL } from 'node:url'

const [appConfigPath, exportName] = process.argv.slice(2)

/** Known load failures by the code Node gives them; anything else is `other`. */
const REASONS_BY_CODE = {
  ERR_MODULE_NOT_FOUND: 'module-not-found',
  ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX: 'unsupported-typescript-syntax',
  ERR_UNKNOWN_FILE_EXTENSION: 'unknown-file-extension',
  ERR_UNSUPPORTED_DIR_IMPORT: 'module-not-found',
}

function reasonOf(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  if (Object.hasOwn(REASONS_BY_CODE, code)) return REASONS_BY_CODE[code]
  if (error instanceof SyntaxError) return 'syntax-error'
  return 'other'
}

function send(message) {
  process.send(message, () => process.exit(0))
}

try {
  const loaded = await import(pathToFileURL(appConfigPath).href)
  const overrides = loaded[exportName]
  if (!overrides || typeof overrides !== 'object') {
    send({ ok: false, reason: 'missing-export' })
  } else {
    // Read once, here: a getter on the config runs in this process only
    const auth = overrides.auth
    send({
      ok: true,
      auth: auth === undefined || auth === null ? null : {
        methods: auth.methods,
        googleEnabled: auth.providers?.google?.enabled,
        emailAndPasswordEnabled: auth.emailAndPassword?.enabled,
      },
    })
  }
} catch (error) {
  send({ ok: false, reason: reasonOf(error) })
}
