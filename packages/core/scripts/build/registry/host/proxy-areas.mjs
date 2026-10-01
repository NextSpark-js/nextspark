/**
 * Protected areas in a project's proxy (#203, S21)
 *
 * core checks the /superadmin and /devtools roles on the server whatever the proxy does, but only the proxy can refuse
 * a signed-in user without the role with a 307 before anything renders (a Cache Components page has sent its shell
 * with a 200 by then), and core's proxy template does it. A project owns its proxy (`src/proxy.ts`), so one copied
 * before the template gained the check, or written by hand, may not have it: `nextspark prepare` (and `migrate`, in
 * the CLI) warn, naming each area the proxy never mentions.
 *
 * @module core/scripts/build/registry/host/proxy-areas
 */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export const PROXY_AREA_WARNING = 'NS_PROXY_PROTECTED_AREA_MISSING'

/** The areas and the roles core's proxy template lets into each. */
export const PROTECTED_AREAS = Object.freeze([
  { path: '/superadmin', roles: 'superadmin or developer' },
  { path: '/devtools', roles: 'developer' },
])

/** Where Next loads a project's proxy from, next to the generated src/app. */
export const PROXY_FILES = Object.freeze(['src/proxy.ts', 'src/proxy.js', 'src/middleware.ts', 'src/middleware.js'])

/** The protected areas a proxy's source never names as a path (`'/superadmin'`, `"/devtools"`, `` `/devtools` ``). */
export function missingProxyAreas(source) {
  return PROTECTED_AREAS.filter(area => !new RegExp(`['"\`]${area.path}(?![\\w-])`).test(source))
}

/** The warning for one proxy file whose source misses some areas, or null. */
export function proxyAreaNotice(file, source) {
  const missing = missingProxyAreas(source)
  if (missing.length === 0) return null
  return {
    code: PROXY_AREA_WARNING,
    target: file,
    areas: missing.map(area => area.path),
    message:
      `${file} does not protect ${missing.map(area => area.path).join(' or ')}. core still refuses those pages on the server, ` +
      `but without the proxy check a signed-in user without the role gets a 200 with a client-side redirect instead of a 307. ` +
      `Add the protected-area check of node_modules/@nextsparkjs/core/templates/proxy.ts (protectedArea / authorize): ` +
      `${missing.map(area => `${area.path} needs ${area.roles}`).join(', ')}; no session goes to /login?callbackUrl=..., ` +
      `a session without the role to /dashboard?error=access_denied`,
  }
}

/** The warnings for the proxy Next would load in `projectRoot` (the first of PROXY_FILES that exists). */
export function proxyAreaNotices(projectRoot) {
  if (!projectRoot) return []
  const file = PROXY_FILES.find(candidate => existsSync(join(projectRoot, candidate)))
  if (!file) return []
  const notice = proxyAreaNotice(file, readFileSync(join(projectRoot, file), 'utf8'))
  return notice ? [notice] : []
}
