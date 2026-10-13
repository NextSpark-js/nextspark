/**
 * `createProxy({ authenticatedPaths })` entries, checked at build (#203, S157)
 *
 * The entries are read by `createProxy` when the server starts, so a bad one used to build fine and then answer 500 to
 * every request. `nextspark prepare` (so `nextspark build`) reads the string literals of the array in the project's
 * proxy and refuses the ones `createProxy` would refuse. An array that is not only string literals is not read: createProxy still
 * checks it at start. The rules are those of createProxy in src/proxy/index.ts; the node test keeps the two together.
 *
 * @module core/scripts/build/registry/host/proxy-paths
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PROXY_FILES, withoutComments } from './proxy-areas.mjs'

export const PROXY_PATH_INVALID = 'NS_PROXY_AUTHENTICATED_PATH_INVALID'

/** What core's proxy answers before it looks at the authenticated paths (publicPaths, /docs, /api/v1 in src/proxy/index.ts). */
export const PATHS_HANDLED_FIRST = Object.freeze([
  '/', '/login', '/signup', '/forgot-password', '/reset-password', '/verify-email', '/terms', '/privacy',
  '/api/auth', '/api/test-auth', '/auth-test', '/auth/callback', '/docs', '/api/v1',
])

const isUnder = (path, prefix) => path === prefix || path.startsWith(`${prefix}/`)

/** Why `createProxy` refuses `entry`, or null when it takes it. */
export function authenticatedPathProblem(entry) {
  if (typeof entry !== 'string' || !/^(\/[A-Za-z0-9._~-]+)+$/.test(entry) || entry.split('/').some(segment => segment === '.' || segment === '..')) {
    return `is not a literal path prefix such as '/account' or '/app/reports' (a leading slash, segments of letters, digits and . _ ~ - only, no trailing slash, no query). Patterns (*, :param, (.*), [param]) are not supported: '/account' already covers /account and everything under it`
  }
  const before = PATHS_HANDLED_FIRST.find(path => isUnder(entry, path) || isUnder(path, entry))
  if (before) return `overlaps ${before}, which core's proxy handles before the authenticated paths, so it would not need a session there`
  return null
}

/**
 * The string literals of every `authenticatedPaths: [ ... ]` array in `source` (comments aside) whose elements are all
 * plain literals ('..', "..", or a backtick string without `${`), separated by commas. An array with anything else in it
 * (an identifier, a call, an index, a spread, an interpolation, `+`) is skipped whole: its value is only known at run
 * time, where createProxy checks it.
 */
export function authenticatedPathLiterals(source) {
  const code = withoutComments(source)
  const found = []
  for (const start of code.matchAll(/\bauthenticatedPaths\s*:\s*\[/g)) {
    const entries = []
    let i = start.index + start[0].length
    let plain = true
    for (;;) {
      while (/\s/.test(code[i] ?? '')) i++
      if (code[i] === ']') break
      const quote = code[i]
      if (quote !== "'" && quote !== '"' && quote !== '`') { plain = false; break }
      let value = ''
      for (i++; i < code.length && code[i] !== quote; i++) value += code[i] === '\\' ? code[++i] ?? '' : code[i]
      if (i >= code.length || (quote === '`' && value.includes('${'))) { plain = false; break }
      entries.push(value)
      i++
      while (/\s/.test(code[i] ?? '')) i++
      if (code[i] === ',') i++
      else if (code[i] !== ']') { plain = false; break }
    }
    if (plain) found.push(...entries)
  }
  return found
}

/** One error per refused entry of the proxy Next would load in `projectRoot`. */
export function proxyPathDiagnostics(projectRoot) {
  if (!projectRoot) return []
  const file = PROXY_FILES.find(candidate => existsSync(join(projectRoot, candidate)))
  if (!file) return []
  return authenticatedPathLiterals(readFileSync(join(projectRoot, file), 'utf8'))
    .map(entry => ({ entry, problem: authenticatedPathProblem(entry) }))
    .filter(({ problem }) => problem)
    .map(({ entry, problem }) => ({ code: PROXY_PATH_INVALID, file, message: `createProxy({ authenticatedPaths }) entry ${JSON.stringify(entry)} ${problem}` }))
}
