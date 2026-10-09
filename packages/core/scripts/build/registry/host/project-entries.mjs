/**
 * The project's request proxy and startup files as facades over core (#203, S114)
 *
 * The scaffold writes `src/proxy.ts` and `instrumentation.ts` into the project, and the project owns them. Up to
 * 0.1.0-beta.197 they were full copies of core's code (674 lines of proxy), so a project kept whatever proxy it was
 * created with. They are now a few lines that re-export `@nextsparkjs/core/proxy` and `@nextsparkjs/core/instrumentation`.
 *
 * A file that is byte for byte a template core shipped before (previous-templates.json) is core's to replace, and
 * `nextspark prepare` replaces it with the current template. Any other content is the project's: it is kept, and
 * prepare (and `migrate`, in the CLI) say what to replace it with (NS_PROXY_FACADE_MISSING, NS_INSTRUMENTATION_FACADE_MISSING).
 *
 * @module core/scripts/build/registry/host/project-entries
 */

import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { projectFiles } from '../../safe-fs.mjs'
import { withoutComments } from './proxy-areas.mjs'

const TEMPLATES_DIR = fileURLToPath(new URL('../../../../templates/', import.meta.url))
const PREVIOUS = JSON.parse(readFileSync(new URL('./previous-templates.json', import.meta.url), 'utf8'))

export const PROXY_FACADE_WARNING = 'NS_PROXY_FACADE_MISSING'
export const INSTRUMENTATION_FACADE_WARNING = 'NS_INSTRUMENTATION_FACADE_MISSING'
export const PROXY_TEMPLATE_REPLACED = 'NS_PROXY_TEMPLATE_REPLACED'
export const INSTRUMENTATION_TEMPLATE_REPLACED = 'NS_INSTRUMENTATION_TEMPLATE_REPLACED'
export const ENTRY_NOT_REPLACED = 'NS_PROJECT_ENTRY_NOT_REPLACED'

/** The request-interception files the proxy rules look at, and the startup files. Next loads one of each. */
const PROXY_ENTRIES = Object.freeze(['src/proxy.ts', 'src/middleware.ts'])
const INSTRUMENTATION_ENTRIES = Object.freeze(['instrumentation.ts', 'src/instrumentation.ts'])

const sha256 = text => createHash('sha256').update(text).digest('hex')

/**
 * Whether `content` is exactly a `kind` ('proxy.ts' or 'instrumentation.ts') template core shipped before: as written,
 * with CRLF line ends (a checkout on Windows), or, for the proxy, with the `middleware` export the Next 15 copy got.
 */
export function isPreviousTemplate(kind, content, previous = PREVIOUS) {
  const known = new Set(previous[kind] ?? [])
  const lf = content.replace(/\r\n/g, '\n')
  const candidates = [content, lf]
  if (kind === 'proxy.ts') candidates.push(lf.replace(/export\s+async\s+function\s+middleware\s*\(/, 'export async function proxy(').replace(/export\s+function\s+middleware\s*\(/, 'export function proxy('))
  return candidates.some(candidate => known.has(sha256(candidate)))
}

/** The current template for `kind`, adapted to the file it replaces (`src/middleware.ts` exports `middleware`). */
export function currentTemplate(kind, file, templatesDir = TEMPLATES_DIR) {
  const source = readFileSync(join(templatesDir, kind), 'utf8')
  return file.endsWith('middleware.ts') ? source.replace(/export\s*\{\s*proxy\s*\}/, 'export { proxy as middleware }') : source
}

/** Whether a proxy's code (not a comment) builds on core's proxy entry. */
export function usesCoreProxy(source) {
  return /['"]@nextsparkjs\/core\/proxy['"]/.test(withoutComments(source))
}

/** Whether a startup file's code (not a comment) calls core's register(). */
export function usesCoreInstrumentation(source) {
  return /['"]@nextsparkjs\/core\/instrumentation['"]/.test(withoutComments(source))
}

/**
 * The replacement, on one line (the CLI shows a notice holding a line break quoted, on a single line): the command that
 * copies core's current template over the file, and what that template holds. Same text in the CLI's migrate.
 */
export function proxyReplacement(file) {
  return `Replace it with core's current template: cp node_modules/@nextsparkjs/core/templates/proxy.ts ${file}` +
    (file.endsWith('middleware.ts') ? `, then rename the export: export { proxy as middleware } from '@nextsparkjs/core/proxy'.` : '.') +
    ` The template is export { proxy } from '@nextsparkjs/core/proxy' plus the config matcher, which Next.js reads from the file itself.`
}

export function instrumentationReplacement(file) {
  return `Replace it with core's current template: cp node_modules/@nextsparkjs/core/templates/instrumentation.ts ${file}. The template is export { register } from '@nextsparkjs/core/instrumentation'.`
}

function proxyFacadeNotice(file, source, previous) {
  if (usesCoreProxy(source)) return null
  const unchanged = isPreviousTemplate('proxy.ts', source, previous)
  return {
    code: PROXY_FACADE_WARNING,
    target: file,
    message:
      (unchanged
        ? `${file} is an unchanged copy of an earlier core proxy template; nextspark prepare replaces it with the current one. `
        : `${file} does not use @nextsparkjs/core/proxy, so it keeps the proxy it was written with and gets none of core's fixes to it (sessions, protected areas, roles, docs access, identity headers). `) +
      proxyReplacement(file) +
      (unchanged ? '' : ` Move request logic of your own to config/hooks/proxy.ts (core's proxy runs its proxyHook before its checks), and paths that need a signed-in user to createProxy({ authenticatedPaths: [...] }) from @nextsparkjs/core/proxy. A role check of your own (an area for one role) goes in that page or its layout, on the server: the proxy entry only adds paths that need a session.`),
  }
}

function instrumentationFacadeNotice(file, source, previous) {
  if (usesCoreInstrumentation(source)) return null
  const unchanged = isPreviousTemplate('instrumentation.ts', source, previous)
  return {
    code: INSTRUMENTATION_FACADE_WARNING,
    target: file,
    message:
      (unchanged
        ? `${file} is an unchanged copy of an earlier core instrumentation template; nextspark prepare replaces it with the current one. `
        : `${file} does not call core's register() from @nextsparkjs/core/instrumentation, so the startup checks and scheduled actions run as this file was written, without core's changes to them. `) +
      instrumentationReplacement(file) +
      (unchanged ? '' : ` To keep startup code of your own, call core's register() from your register(): import { register as registerNextSpark } from '@nextsparkjs/core/instrumentation', then await registerNextSpark().`),
  }
}

/** Whether `root` is core itself (its src/proxy.ts is the entry the facade re-exports), as the conformance fixture's host config has it. */
function isCorePackage(root) {
  try {
    return JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).name === '@nextsparkjs/core'
  } catch {
    return false
  }
}

/** The proxy and instrumentation file Next loads in `projectRoot`, with what it holds; none in core itself. */
function entries(projectRoot) {
  const found = []
  if (isCorePackage(projectRoot)) return found
  const proxy = PROXY_ENTRIES.find(file => existsSync(join(projectRoot, file)))
  if (proxy) found.push({ kind: 'proxy.ts', file: proxy, source: readFileSync(join(projectRoot, proxy), 'utf8') })
  for (const file of INSTRUMENTATION_ENTRIES) {
    if (existsSync(join(projectRoot, file))) found.push({ kind: 'instrumentation.ts', file, source: readFileSync(join(projectRoot, file), 'utf8') })
  }
  return found
}

/** The facade notices for `projectRoot`'s proxy and instrumentation files, read-only. */
export function projectEntryNotices(projectRoot, { templatesDir = TEMPLATES_DIR, previous = PREVIOUS } = {}) {
  if (!projectRoot || !existsSync(join(templatesDir, 'proxy.ts'))) return []
  return entries(projectRoot)
    .map(({ kind, file, source }) => kind === 'proxy.ts' ? proxyFacadeNotice(file, source, previous) : instrumentationFacadeNotice(file, source, previous))
    .filter(Boolean)
}

/**
 * Replace each of `projectRoot`'s proxy and instrumentation files that is an unchanged earlier template with the current
 * template, and return one notice per file replaced. Files with any other content are not touched. A file that cannot
 * be written (read-only, a symlink safe-fs refuses) is left as it is with an NS_PROJECT_ENTRY_NOT_REPLACED warning:
 * prepare runs this after the generation is out, and the replacement is not worth failing prepare over.
 */
export function upgradeProjectEntries(projectRoot, { templatesDir = TEMPLATES_DIR, previous = PREVIOUS } = {}) {
  if (!projectRoot || !existsSync(join(templatesDir, 'proxy.ts'))) return []
  const replaced = []
  for (const { kind, file, source } of entries(projectRoot)) {
    const template = currentTemplate(kind, file, templatesDir)
    if (source === template || !isPreviousTemplate(kind, source, previous)) continue
    try {
      projectFiles(projectRoot).writeFileSync(join(projectRoot, file), template)
    } catch (error) {
      replaced.push({
        code: ENTRY_NOT_REPLACED,
        target: file,
        message: `${file} is an unchanged copy of an earlier core template, and nextspark prepare could not replace it: ${String(error?.message ?? error).replace(/\s+/g, ' ')} ${kind === 'proxy.ts' ? proxyReplacement(file) : instrumentationReplacement(file)}`,
      })
      continue
    }
    replaced.push({
      code: kind === 'proxy.ts' ? PROXY_TEMPLATE_REPLACED : INSTRUMENTATION_TEMPLATE_REPLACED,
      target: file,
      message: `${file} was an unchanged copy of an earlier core template and now re-exports ${kind === 'proxy.ts' ? '@nextsparkjs/core/proxy' : '@nextsparkjs/core/instrumentation'}, which does the same work and is updated with core. Commit the change.`,
    })
  }
  return replaced
}
