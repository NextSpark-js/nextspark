/**
 * Callback URL
 *
 * Where sign-in sends the user afterwards. `callbackUrl` arrives in the login
 * URL, where anyone can write it, so only a path on this app counts: `//host`,
 * `/\host` or an absolute URL would take the user to another site right after
 * they authenticate.
 */

const PLACEHOLDER_ORIGIN = 'http://callback.invalid'

/** The path, query and hash of an in-app callback, or null for anything else. */
export function safeCallbackPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/')) return null
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN)
    const path = `${url.pathname}${url.search}${url.hash}`
    // Resolving dot segments can leave `//host` (from `/%2e%2e//host`), which
    // the router would read as another origin, so the result is checked too.
    return url.origin === PLACEHOLDER_ORIGIN && !path.startsWith('//') ? path : null
  } catch {
    return null
  }
}
