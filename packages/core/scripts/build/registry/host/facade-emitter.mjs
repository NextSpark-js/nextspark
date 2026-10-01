/**
 * Route Facade Emitter
 *
 * Emits one thin `src/app` route file (a "facade") for the generated host
 * (#203): given the Next.js file kind, the target path under `src/app`, and
 * the module that implements the route (a package subpath such as
 * `@nextsparkjs/core/...` or a project alias such as `@/templates/...`), it
 * reads that module's exports and writes a file that
 *
 * - re-exports the default and every runtime export Next.js supports for the
 *   kind, by name and from a fixed specifier (no lookup by variable), and
 * - re-declares the segment config Next.js reads statically as a literal
 *   `export const`, because Next.js ignores segment config that is
 *   re-exported (`next/dist/build/analysis/get-page-static-info`).
 *
 * What each kind supports, and in which form, is the versioned table in
 * `next-route-exports.json` (rendered in README.md). Anything the table does
 * not allow, or that the emitter cannot read, is a fatal diagnostic naming the
 * source file and export: no export is ever dropped silently.
 *
 * Used by the conformance fixture's driver today and meant for
 * `nextspark prepare` later.
 *
 * @module core/scripts/build/registry/host/facade-emitter
 */

import { readFileSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { basename, dirname, isAbsolute, join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { evaluateNextLiteral, renderLiteral } from './next-literal.mjs'
import { validateGeneratedModule } from './static-imports.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** The route export table, parsed once. */
export const ROUTE_EXPORT_TABLE = JSON.parse(readFileSync(join(HERE, 'next-route-exports.json'), 'utf8'))

export const ROUTE_KINDS = Object.keys(ROUTE_EXPORT_TABLE.kinds)

const SEGMENT_CONFIG_NAMES = new Set([...ROUTE_EXPORT_TABLE.segmentConfig.keys, ...ROUTE_EXPORT_TABLE.segmentConfig.legacyKeys])
const METADATA_FAMILY = new Set(['metadata', 'generateMetadata', 'viewport', 'generateViewport'])
/**
 * Exports whose presence Next.js reads statically from the route file, through
 * `specifier.orig` for `export { a as b }` (get-page-static-info `checkExports`).
 */
const STATICALLY_DETECTED = new Set(['generateStaticParams', 'generateSitemaps', 'generateImageMetadata'])
const IDENTIFIER = /^[A-Za-z_$][\w$]*$/

/** Diagnostic codes, one per kind of problem a facade cannot be emitted with. */
export const DIAGNOSTICS = Object.freeze({
  PARSE_ERROR: 'NS_HOST_PARSE_ERROR',
  UNKNOWN_KIND: 'NS_HOST_UNKNOWN_KIND',
  TARGET_MISMATCH: 'NS_HOST_TARGET_MISMATCH',
  INVALID_SPECIFIER: 'NS_HOST_INVALID_SPECIFIER',
  NON_LITERAL_SEGMENT_CONFIG: 'NS_HOST_NON_LITERAL_SEGMENT_CONFIG',
  INVALID_SEGMENT_CONFIG_VALUE: 'NS_HOST_INVALID_SEGMENT_CONFIG_VALUE',
  CACHE_COMPONENTS_CONFLICT: 'NS_HOST_CACHE_COMPONENTS_CONFLICT',
  CLIENT_SERVER_ONLY_EXPORT: 'NS_HOST_CLIENT_SERVER_ONLY_EXPORT',
  CLIENT_REQUIRED: 'NS_HOST_CLIENT_REQUIRED',
  SERVER_ACTIONS_MODULE: 'NS_HOST_SERVER_ACTIONS_MODULE',
  ROUTE_DEFAULT_EXPORT: 'NS_HOST_ROUTE_DEFAULT_EXPORT',
  ROUTE_NO_METHODS: 'NS_HOST_ROUTE_NO_METHODS',
  MISSING_DEFAULT: 'NS_HOST_MISSING_DEFAULT',
  UNSUPPORTED_EXPORT: 'NS_HOST_UNSUPPORTED_EXPORT',
  UNCLASSIFIABLE_EXPORT: 'NS_HOST_UNCLASSIFIABLE_EXPORT',
  UNSUPPORTED_NEXT_VERSION: 'NS_HOST_UNSUPPORTED_NEXT_VERSION',
  VARIABLE_LOOKUP: 'NS_HOST_VARIABLE_LOOKUP',
})

/** Thrown with every fatal diagnostic found for one facade. */
export class FacadeEmitError extends Error {
  constructor(diagnostics) {
    super(
      'Cannot emit the generated route file:\n' +
        diagnostics.map(d => `  - [${d.code}] ${d.file}${d.line ? `:${d.line}` : ''}${d.exportName ? ` (export "${d.exportName}")` : ''}: ${d.message}`).join('\n')
    )
    this.name = 'FacadeEmitError'
    this.diagnostics = diagnostics
  }
}

// Literal evaluation lives in next-literal.mjs (the static-imports gate needs it too).
export { evaluateNextLiteral, renderLiteral } from './next-literal.mjs'

// ---------------------------------------------------------------------------
// Source analysis
// ---------------------------------------------------------------------------

function hasModifier(node, kind) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === kind))
}

/**
 * Leading string-literal statements, as Next.js reads directives
 * (`checkExports`): only before the first statement that isn't one.
 */
function readDirectives(sourceFile, ts) {
  const directives = []
  for (const statement of sourceFile.statements) {
    if (ts.isExpressionStatement(statement) && ts.isStringLiteral(statement.expression)) {
      directives.push(statement.expression.text)
    } else {
      break
    }
  }
  return directives
}

/**
 * Classify every export of a parsed module.
 *
 * Each runtime export becomes `{ name, form, line, literal? }` where `form` is
 * one of: `const-literal` (an `export const` whose initializer Next.js can
 * read), `const-nonliteral`, `let`, `function`, `class`, `export-clause`
 * (`export { a as b }` of a local binding), `reexport` (`export { a } from`),
 * `namespace-reexport` (`export * as a from`), `default`. Type-only exports
 * are listed separately; they have no runtime value to forward.
 * Constructs whose exported names cannot be read statically are returned as
 * `unclassifiable` entries.
 */
export function classifyExports(sourceFile, ts) {
  const exports = []
  const typeOnly = []
  const unclassifiable = []
  const lineOf = node => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1
  const K = ts.SyntaxKind

  for (const statement of sourceFile.statements) {
    if (ts.isExportAssignment(statement)) {
      if (statement.isExportEquals) {
        unclassifiable.push({ name: 'export =', line: lineOf(statement), reason: '`export =` is CommonJS, not an ES module export' })
      } else {
        exports.push({ name: 'default', form: 'default', line: lineOf(statement) })
      }
      continue
    }

    if (ts.isExportDeclaration(statement)) {
      const fromModule = Boolean(statement.moduleSpecifier)
      if (!statement.exportClause) {
        if (statement.isTypeOnly) {
          typeOnly.push({ name: '*', line: lineOf(statement) })
        } else {
          unclassifiable.push({
            name: '*',
            line: lineOf(statement),
            reason: `\`export * from ${statement.moduleSpecifier.getText(sourceFile)}\` hides which names the module exports; list them explicitly`,
          })
        }
        continue
      }
      if (ts.isNamespaceExport(statement.exportClause)) {
        const name = statement.exportClause.name.text
        ;(statement.isTypeOnly ? typeOnly : exports).push({ name, form: 'namespace-reexport', line: lineOf(statement) })
        continue
      }
      for (const element of statement.exportClause.elements) {
        const name = element.name.text
        if (statement.isTypeOnly || element.isTypeOnly) {
          typeOnly.push({ name, line: lineOf(element) })
          continue
        }
        const form = name === 'default' ? 'default' : fromModule ? 'reexport' : 'export-clause'
        // The name the module binds before `as` - what Next.js reads as `specifier.orig`.
        exports.push({ name, form, line: lineOf(element), localName: element.propertyName?.text ?? name })
      }
      continue
    }

    const exported = hasModifier(statement, K.ExportKeyword)
    if (!exported) continue
    const isDefault = hasModifier(statement, K.DefaultKeyword)

    if (ts.isInterfaceDeclaration(statement) || ts.isTypeAliasDeclaration(statement)) {
      typeOnly.push({ name: statement.name.text, line: lineOf(statement) })
      continue
    }
    if (hasModifier(statement, K.DeclareKeyword)) {
      const names = ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.map(declaration => declaration.name.getText(sourceFile))
        : [statement.name?.getText(sourceFile) ?? K[statement.kind]]
      for (const name of names) typeOnly.push({ name, line: lineOf(statement) })
      continue
    }
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      if (isDefault) {
        exports.push({ name: 'default', form: 'default', line: lineOf(statement) })
      } else if (statement.name) {
        exports.push({ name: statement.name.text, form: ts.isFunctionDeclaration(statement) ? 'function' : 'class', line: lineOf(statement) })
      }
      continue
    }
    if (ts.isVariableStatement(statement)) {
      const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) {
          unclassifiable.push({
            name: declaration.name.getText(sourceFile),
            line: lineOf(declaration),
            reason: 'a destructuring export hides which names it declares; export each name on its own',
          })
          continue
        }
        const name = declaration.name.text
        if (!isConst) {
          exports.push({ name, form: 'let', line: lineOf(declaration) })
          continue
        }
        if (!declaration.initializer) {
          exports.push({ name, form: 'const-nonliteral', line: lineOf(declaration), reason: 'has no initializer' })
          continue
        }
        const literal = evaluateNextLiteral(declaration.initializer, ts)
        if ('unsupported' in literal) {
          exports.push({ name, form: 'const-nonliteral', line: lineOf(declaration), reason: literal.unsupported })
        } else {
          exports.push({ name, form: 'const-literal', line: lineOf(declaration), literal: literal.value })
        }
      }
      continue
    }
    // `export enum`, `export import a = b.c`, `export module`, ...
    unclassifiable.push({
      name: statement.name?.getText?.(sourceFile) ?? K[statement.kind],
      line: lineOf(statement),
      reason: `\`${K[statement.kind]}\` is not an export form a route module can forward`,
    })
  }

  return { exports, typeOnly, unclassifiable }
}

/**
 * Parse a route source module with the registry build's TypeScript compiler.
 * A module TypeScript cannot parse is reported rather than read in part: the
 * recovered tree could be missing exports.
 */
export async function analyzeRouteSource({ source, file, projectRoot = process.cwd() }) {
  const ts = await loadTypeScriptFor(projectRoot)
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(file))
  const [parseError] = sourceFile.parseDiagnostics ?? []
  if (parseError) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(parseError.start ?? 0)
    return {
      parseError: { line: line + 1, message: ts.flattenDiagnosticMessageText(parseError.messageText, ' ') },
      directives: [],
      exports: [],
      typeOnly: [],
      unclassifiable: [],
    }
  }
  return { directives: readDirectives(sourceFile, ts), ...classifyExports(sourceFile, ts) }
}

// ---------------------------------------------------------------------------
// Next.js's own segment config validation
// ---------------------------------------------------------------------------

const nextModules = new Map()

/**
 * The Next.js installation the host builds with: `next/package.json` resolved
 * once, from the project and then from core, so the version and every internal
 * loaded afterwards come from the same package root.
 */
export function resolveNextPackage(projectRoot = process.cwd()) {
  for (const from of [join(projectRoot, 'package.json'), fileURLToPath(import.meta.url)]) {
    let packageJsonPath
    try {
      packageJsonPath = createRequire(from).resolve('next/package.json')
    } catch {
      continue
    }
    const { version } = JSON.parse(readFileSync(packageJsonPath, 'utf8'))
    return { root: dirname(packageJsonPath), packageJsonPath, version }
  }
  return null
}

/**
 * Whether `version` is a Next.js the table applies to: the table's `next` is the verified
 * baseline, and core pins `next` to `~<baseline>`, so any stable patch of the same minor at or
 * above the baseline is accepted (16.3.5, 16.3.9, 16.3.5+build.1), while other minors/majors, lower
 * patches and prereleases (16.3.6-canary.0) are refused.
 */
export function isSupportedNextVersion(version, baseline = ROUTE_EXPORT_TABLE.next) {
  // Stable versions only; build metadata (`+build.1`) is allowed, as npm's `~` range allows it.
  const parse = value => /^(\d+)\.(\d+)\.(\d+)(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.exec(String(value))?.slice(1).map(Number)
  const [major, minor, patch] = parse(version) ?? []
  const [baseMajor, baseMinor, basePatch] = parse(baseline) ?? []
  return major !== undefined && baseMajor !== undefined && major === baseMajor && minor === baseMinor && patch >= basePatch
}

/**
 * Next.js's segment config schema, loaded from the resolved Next.js package
 * root, but only when that Next.js is one the export table applies to
 * (`isSupportedNextVersion`). Otherwise the result carries an `error` and nothing is
 * loaded: facades emitted from a stale table could silently diverge.
 * `next/dist/build/...` is a Next.js internal; the tests pin its key list to
 * the table.
 */
export function loadNextSegmentConfig(projectRoot = process.cwd()) {
  if (!nextModules.has(projectRoot)) {
    const next = resolveNextPackage(projectRoot)
    let loaded
    if (!next) {
      loaded = { error: `Next.js is not resolvable from ${projectRoot}; the route export table is for next@${ROUTE_EXPORT_TABLE.next}` }
    } else if (!isSupportedNextVersion(next.version)) {
      loaded = {
        ...next,
        error:
          `the project resolves next@${next.version} (${next.packageJsonPath}) but the route export table applies to ` +
          `next@~${ROUTE_EXPORT_TABLE.next} only (verified on ${ROUTE_EXPORT_TABLE.next}); install next@~${ROUTE_EXPORT_TABLE.next} ` +
          'or re-verify next-route-exports.json for the new version',
      }
    } else {
      try {
        loaded = { ...next, ...createRequire(next.packageJsonPath)(join(next.root, 'dist/build/segment-config/app/app-segment-config.js')) }
      } catch (error) {
        loaded = { ...next, error: `next@${next.version} at ${next.root} has no segment config schema (${error.message.split('\n')[0]})` }
      }
    }
    nextModules.set(projectRoot, loaded)
  }
  return nextModules.get(projectRoot)
}

// ---------------------------------------------------------------------------
// Facade planning and rendering
// ---------------------------------------------------------------------------

function stemOf(target) {
  const name = basename(target)
  return name.slice(0, name.indexOf('.') === -1 ? name.length : name.indexOf('.'))
}

/** Whether `stem` names a file of this kind: `icon`, or a one-digit variant (`icon1`) where Next allows it. */
function stemMatches(stem, spec) {
  return stem === spec.file || (spec.numberedVariants && stem.length === spec.file.length + 1 && stem.startsWith(spec.file) && /\d$/.test(stem))
}

/** The route kind of a file stem (`page`, `icon`, `opengraph-image2`, ...), or null. */
export function kindForFileStem(stem) {
  return ROUTE_KINDS.find(kind => stemMatches(stem, ROUTE_EXPORT_TABLE.kinds[kind])) ?? null
}

/**
 * Decide the facade for one route file. Pure: takes the analysis of the
 * source instead of reading it, so tests can drive every row of the table.
 *
 * @param {object} input
 * @param {string} input.kind - a key of the export table (`page`, `route`, `sitemap`, ...)
 * @param {string} input.target - path of the generated file relative to `src/app`
 * @param {string} input.specifier - module specifier the facade imports from
 * @param {string} input.file - the source file on disk (for diagnostics)
 * @param {object} input.analysis - result of `analyzeRouteSource`
 * @param {boolean} [input.cacheComponents] - the host's `cacheComponents`; unchecked when undefined
 * @param {string[]} [input.pageExtensions] - the host's `pageExtensions` (default tsx, ts, jsx, js)
 * @param {object} [input.nextSegmentConfig] - `loadNextSegmentConfig()`; values are only schema-checked when given
 */
export function planFacade({ kind, target, specifier, file, analysis, cacheComponents, pageExtensions = ['tsx', 'ts', 'jsx', 'js'], nextSegmentConfig }) {
  const diagnostics = []
  const report = (code, message, exportName, line) => diagnostics.push({ code, file, exportName, line, message })

  const spec = ROUTE_EXPORT_TABLE.kinds[kind]
  if (!spec) {
    report(DIAGNOSTICS.UNKNOWN_KIND, `"${kind}" is not a route file kind; expected one of ${ROUTE_KINDS.join(', ')}`)
    return { diagnostics }
  }

  const targetName = basename(target)
  const normalizedTarget = target.split('\\').join('/')
  const stem = stemOf(target)
  if (
    isAbsolute(target) ||
    normalizedTarget.split('/').includes('..') ||
    !stemMatches(stem, spec) ||
    !pageExtensions.some(extension => targetName === `${stem}.${extension}`)
  ) {
    report(
      DIAGNOSTICS.TARGET_MISMATCH,
      `target "${target}" must be a relative path under src/app named ${spec.file}${spec.numberedVariants ? '[0-9]' : ''}.{${pageExtensions.join(',')}} for kind "${kind}"`
    )
  }
  if (nextSegmentConfig?.error) {
    report(DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION, nextSegmentConfig.error)
    return { diagnostics }
  }
  if (typeof specifier !== 'string' || specifier.length === 0 || /[\s'"`\\]/.test(specifier) || specifier.startsWith('.')) {
    report(
      DIAGNOSTICS.INVALID_SPECIFIER,
      `source specifier ${JSON.stringify(specifier)} must be a bare package subpath or a project alias (no relative paths, quotes or whitespace)`
    )
  }

  if (analysis.parseError) {
    report(DIAGNOSTICS.PARSE_ERROR, `the module does not parse (${analysis.parseError.message}), so its exports cannot be read`, undefined, analysis.parseError.line)
    return { diagnostics }
  }

  const isClient = analysis.directives.includes('use client')
  if (analysis.directives.includes('use server')) {
    report(
      DIAGNOSTICS.SERVER_ACTIONS_MODULE,
      `a 'use server' module only exports Server Actions and cannot implement a ${kind} file`
    )
    return { diagnostics }
  }
  if (spec.sourceMustBeClient && !isClient) {
    report(
      DIAGNOSTICS.CLIENT_REQUIRED,
      `a ${kind} file must be a Client Component; add 'use client' to the top of the source module`
    )
  }
  if (isClient && spec.serverOnly) {
    report(DIAGNOSTICS.CLIENT_SERVER_ONLY_EXPORT, `a ${kind} file runs on the server; remove 'use client' from the source module`)
  }

  for (const entry of analysis.unclassifiable) {
    report(DIAGNOSTICS.UNCLASSIFIABLE_EXPORT, `cannot classify this export: ${entry.reason}`, entry.name, entry.line)
  }

  const defaults = []
  const reexports = []
  const aliases = {}
  const literals = []
  const seen = new Set()

  for (const entry of analysis.exports) {
    const { name, line } = entry
    if (seen.has(name)) continue
    seen.add(name)

    if (name === 'default' && kind === 'route') {
      report(
        DIAGNOSTICS.ROUTE_DEFAULT_EXPORT,
        'a Route Handler must not export a default; export a named function for each HTTP method (GET, POST, ...)',
        name,
        line
      )
      continue
    }

    const form = spec.exports[name]
    if (!form) {
      report(
        DIAGNOSTICS.UNSUPPORTED_EXPORT,
        `Next.js ${ROUTE_EXPORT_TABLE.next} does not support a "${name}" export in a ${kind} file` +
          ` (supported: ${Object.keys(spec.exports).join(', ')}); move it to another module`,
        name,
        line
      )
      continue
    }

    if (isClient && (METADATA_FAMILY.has(name) || name === 'generateStaticParams' || SEGMENT_CONFIG_NAMES.has(name))) {
      report(
        DIAGNOSTICS.CLIENT_SERVER_ONLY_EXPORT,
        `"${name}" is exported from a 'use client' module; Next.js resolves it on the server only (metadata and ` +
          'generateStaticParams are rejected, segment config of a client segment is ignored), so move it to a Server Component module',
        name,
        line
      )
      continue
    }

    if (form === 'default') {
      defaults.push(name)
      continue
    }

    if (form === 'reexport') {
      reexports.push(name)
      // `export { makeParams as generateStaticParams }`: Next.js does not detect the export
      // statically in the source, so the facade keeps the same local name to be read the same way.
      if (STATICALLY_DETECTED.has(name) && entry.localName && entry.localName !== name) {
        aliases[name] = IDENTIFIER.test(entry.localName) && entry.localName !== 'default' ? entry.localName : `${name}FromSource`
      }
      continue
    }

    // form === 'literal': segment config Next.js reads statically.
    if (entry.form !== 'const-literal') {
      const why = {
        'const-nonliteral': `its initializer is not a literal Next.js can read (${entry.reason})`,
        let: 'it is declared with let/var',
        function: 'it is a function',
        class: 'it is a class',
        'export-clause': 'it is exported through `export { }` instead of an inline `export const`',
        reexport: 'it is re-exported from another module',
        'namespace-reexport': 'it is a namespace re-export',
      }[entry.form]
      report(
        DIAGNOSTICS.NON_LITERAL_SEGMENT_CONFIG,
        `segment config "${name}" is not a literal: ${why}. Next.js only reads segment config written as ` +
          `\`export const ${name} = <literal>\` and silently uses the default otherwise`,
        name,
        line
      )
      continue
    }

    if (cacheComponents === true && ROUTE_EXPORT_TABLE.segmentConfig.invalidWithCacheComponents.includes(name)) {
      report(
        DIAGNOSTICS.CACHE_COMPONENTS_CONFLICT,
        `segment config "${name}" is not compatible with cacheComponents (Next.js fails the build); remove it or use 'use cache' / cacheLife`,
        name,
        line
      )
      continue
    }
    if (cacheComponents === false && ROUTE_EXPORT_TABLE.segmentConfig.requireCacheComponents.includes(name)) {
      report(DIAGNOSTICS.CACHE_COMPONENTS_CONFLICT, `segment config "${name}" requires cacheComponents (Next.js fails the build without it)`, name, line)
      continue
    }

    if (nextSegmentConfig && ROUTE_EXPORT_TABLE.segmentConfig.keys.includes(name)) {
      try {
        nextSegmentConfig.parseAppSegmentConfig({ [name]: entry.literal }, target)
      } catch (error) {
        report(DIAGNOSTICS.INVALID_SEGMENT_CONFIG_VALUE, `Next.js rejects the value ${renderLiteral(entry.literal)}: ${error.message.split('\n').slice(1).join(' ').trim() || error.message}`, name, line)
        continue
      }
    }

    literals.push({ name, value: entry.literal })
  }

  if (spec.requiresDefault && !seen.has('default')) {
    report(DIAGNOSTICS.MISSING_DEFAULT, `a ${kind} file needs a default export and the source module has none`)
  }
  if (kind === 'route' && !reexports.some(name => /^[A-Z]+$/.test(name))) {
    report(DIAGNOSTICS.ROUTE_NO_METHODS, 'the Route Handler source exports no HTTP method (GET, HEAD, OPTIONS, POST, PUT, DELETE, PATCH)')
  }

  const order = Object.keys(spec.exports)
  const byTableOrder = (a, b) => order.indexOf(a) - order.indexOf(b)
  return {
    diagnostics,
    facade: {
      directive: spec.facadeDirective,
      defaultExport: defaults.length > 0,
      reexports: reexports.sort(byTableOrder),
      aliases,
      literals: literals.sort((a, b) => byTableOrder(a.name, b.name)),
      typeOnly: analysis.typeOnly.map(entry => entry.name),
    },
  }
}

/** The names of the export family Next.js reads a route's metadata from. */
const METADATA_EXPORTS = ['metadata', 'generateMetadata']

/**
 * Render a planned facade as source text.
 *
 * @param {object} input
 * @param {string} input.specifier - the module the facade forwards
 * @param {object} input.facade - `planFacade().facade`
 * @param {string} [input.stylesheet] - a project stylesheet specifier to import (the root layout's `styles/globals.css`)
 * @param {{ wrapper: { name: string, specifier: string }, metadata?: { name: string, specifier: string }, fallback?: { specifier: string, names: string[] } }} [input.composition] -
 *   compose the module's default export with a core wrapper (`export default wrapper(Template)`) instead of
 *   forwarding it; `metadata` composes its `generateMetadata` the same way; `handler` composes each HTTP method of a
 *   Route Handler but OPTIONS (a CORS preflight carries no credentials); `fallback` names a core module whose
 *   metadata is forwarded when the module has none
 */
export function renderFacade({ specifier, facade, stylesheet, composition }) {
  const from = JSON.stringify(specifier)
  const lines = [`// Generated by NextSpark from ${specifier}. Do not edit: regenerated on every build.`]
  if (facade.directive) lines.push(`'${facade.directive}'`, '')
  if (stylesheet) lines.push(`import ${JSON.stringify(stylesheet)}`)
  const composed = Boolean(composition?.wrapper && facade.defaultExport)
  if (composed) {
    lines.push(
      `import ${COMPOSED_TEMPLATE} from ${from}`,
      `import { ${composition.wrapper.name} } from ${JSON.stringify(composition.wrapper.specifier)}`,
      `export default ${composition.wrapper.name}(${COMPOSED_TEMPLATE})`
    )
  } else if (facade.defaultExport) {
    lines.push(`export { default } from ${from}`)
  }
  const aliases = facade.aliases ?? {}
  const wrapsMetadata = Boolean(composed && composition.metadata && facade.reexports.includes('generateMetadata'))
  const handlers = composition?.handler ? facade.reexports.filter(name => GUARDED_METHODS.includes(name)) : []
  const forwarded = facade.reexports.filter(name => !(wrapsMetadata && name === 'generateMetadata') && !handlers.includes(name))
  const direct = forwarded.filter(name => !aliases[name])
  if (direct.length > 0) lines.push(`export { ${direct.join(', ')} } from ${from}`)
  for (const name of forwarded.filter(name => aliases[name])) {
    lines.push(`import { ${name} as ${aliases[name]} } from ${from}`, `export { ${aliases[name]} as ${name} }`)
  }
  if (wrapsMetadata) {
    lines.push(
      `import { generateMetadata as ${COMPOSED_METADATA} } from ${from}`,
      `import { ${composition.metadata.name} } from ${JSON.stringify(composition.metadata.specifier)}`,
      `export const generateMetadata = ${composition.metadata.name}(${COMPOSED_METADATA})`
    )
  }
  if (handlers.length > 0) {
    lines.push(`import { ${handlers.map(name => `${name} as ${COMPOSED_HANDLER}${name}`).join(', ')} } from ${from}`)
    lines.push(`import { ${composition.handler.name} } from ${JSON.stringify(composition.handler.specifier)}`)
    for (const name of handlers) lines.push(`export const ${name} = ${composition.handler.name}(${COMPOSED_HANDLER}${name})`)
  }
  // A composed layout that has no metadata of its own keeps core's.
  if (composed && composition.fallback && !facade.reexports.some(name => METADATA_EXPORTS.includes(name)) && !facade.literals.some(({ name }) => METADATA_EXPORTS.includes(name))) {
    const names = composition.fallback.names.filter(name => METADATA_EXPORTS.includes(name))
    if (names.length > 0) lines.push(`export { ${names.join(', ')} } from ${JSON.stringify(composition.fallback.specifier)}`)
  }
  for (const { name, value } of facade.literals) lines.push(`export const ${name} = ${renderLiteral(value)}`)
  return lines.join('\n') + '\n'
}

/** The local name a composed facade gives the module it wraps. */
export const COMPOSED_TEMPLATE = 'NextSparkTemplate'
/** The local name a composed facade gives the `generateMetadata` it wraps. */
export const COMPOSED_METADATA = 'NextSparkGenerateMetadata'
/** The local name prefix a composed facade gives the Route Handler methods it wraps (`NextSparkGET`). */
const COMPOSED_HANDLER = 'NextSpark'
/** The Route Handler methods an area check wraps: every HTTP method but OPTIONS. */
const GUARDED_METHODS = ['GET', 'HEAD', 'POST', 'PUT', 'DELETE', 'PATCH']

/**
 * Read the source module and return the facade for one route file.
 *
 * @param {object} input - see `planFacade`; `source` may be passed instead of reading `file`
 * @returns {Promise<{ target: string, content: string, facade: object }>}
 * @throws {FacadeEmitError} with every diagnostic when the facade cannot be emitted
 */
export async function emitFacade({ kind, target, specifier, file, source, projectRoot = process.cwd(), cacheComponents, pageExtensions, stylesheet, composition, wrappers }) {
  const text = source ?? (await readFile(file, 'utf8'))
  const analysis = await analyzeRouteSource({ source: text, file, projectRoot })
  const nextSegmentConfig = loadNextSegmentConfig(projectRoot)
  const { diagnostics, facade } = planFacade({ kind, target, specifier, file, analysis, cacheComponents, pageExtensions, nextSegmentConfig })
  if (diagnostics.length > 0) throw new FacadeEmitError(diagnostics)
  const content = renderFacade({ specifier, facade, stylesheet, composition })
  // Guard on the output itself: a facade must stay inside the allowed facade grammar
  // (fixed imports/re-exports and literal segment config only - static-imports.mjs), and a
  // composed one inside the composed-facade grammar.
  const violations = validateGeneratedModule({ ts: await loadTypeScriptFor(projectRoot), source: content, file: target, grammar: composition ? 'composed-facade' : 'facade', wrappers })
  if (violations.length > 0) {
    throw new FacadeEmitError(
      violations.map(violation => ({ code: DIAGNOSTICS.VARIABLE_LOOKUP, file: target, line: violation.line, message: `the emitted facade leaves the allowed grammar (${violation.kind}): ${violation.text}` }))
    )
  }
  return { target: posix.normalize(target.split('\\').join('/')), content, facade, grammar: composition && content !== renderFacade({ specifier, facade, stylesheet }) ? 'composed-facade' : 'facade' }
}

// ---------------------------------------------------------------------------
// Table rendering (README.md is checked against this by the tests)
// ---------------------------------------------------------------------------

/** Render the export table as the Markdown README.md embeds. */
export function renderExportTableMarkdown(table = ROUTE_EXPORT_TABLE) {
  const rows = ['| Kind | File | Default | Re-exported | Literal segment config | Facade directive |', '| --- | --- | --- | --- | --- | --- |']
  for (const [kind, spec] of Object.entries(table.kinds)) {
    const names = form => Object.entries(spec.exports).filter(([, f]) => f === form).map(([name]) => `\`${name}\``).join(', ') || '-'
    const defaultCell = spec.exports.default ? (spec.requiresDefault ? 'required' : 'optional') : 'forbidden'
    const directive = spec.facadeDirective ? `'${spec.facadeDirective}' (source must be client)` : '-'
    const fileCell = spec.numberedVariants ? `\`${spec.file}\`, \`${spec.file}0\`-\`${spec.file}9\`` : `\`${spec.file}\``
    rows.push(`| ${kind} | ${fileCell} | ${defaultCell} | ${names('reexport')} | ${names('literal')} | ${directive} |`)
  }
  return rows.join('\n')
}
