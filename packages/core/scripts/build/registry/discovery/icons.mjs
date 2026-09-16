/**
 * Icon Discovery
 *
 * Collects every lucide-react icon name the app can ask for by string at
 * runtime, so the generated icon registry can import exactly those and let
 * the bundler drop the rest of the icon set.
 *
 * Sources are exactly what resolveIcon can be handed, and all of them are
 * source files (never the database):
 * - entity configs (`icon: Users` — an identifier imported from lucide-react)
 * - any `config/*.config.ts` of a theme or a plugin (`icon: 'Grid'`,
 *   `iconName: Users` — sidebar sections, dashboard menus, feature and flow
 *   definitions, all of a theme's or plugin's config surface)
 * - block configs (`icon: 'Grid'` — the block's own icon in the editor)
 * - a literal name handed to DynamicIcon's `name` prop or to resolveIcon's
 *   first argument in a theme's or plugin's own component code
 *
 * What a block RENDERS is not here: page content names those icons in the page
 * builder, so they live in the database. Those blocks keep resolving through
 * the lucide namespace — deliberately, see themes' features-grid component.
 *
 * A name that is not a string literal — a variable, a prop, a template
 * expression — cannot be resolved while building, so it is left out of the
 * registry rather than guessed; that is the same limit that makes the
 * unresolved-reference warning below necessary for config files.
 *
 * Every source is read as a syntax tree (core's own TypeScript, #195), not as
 * raw text: a name that only exists inside a comment or a docblock is not
 * code the app can run, so it must not reach the registry either. Test files
 * are skipped for the same reason from the other direction — an icon named
 * only inside a test is never rendered in production.
 *
 * @module core/scripts/build/registry/discovery/icons
 */

import { readdir, readFile } from 'fs/promises'
import { existsSync } from 'fs'
import { createRequire } from 'module'
import { join, dirname } from 'path'

import { verbose, log } from '../../../utils/index.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

/**
 * Icons the resolver falls back to when a name doesn't resolve. They are
 * referenced from core components, not from any config, so nothing would
 * discover them.
 */
const FALLBACK_ICONS = ['Box', 'Circle', 'Folder', 'LayoutGrid']

/** A bare identifier-shaped name, the only shape the generated registry can
 * safely turn into a named import or a lucide-react lookup key. */
const SAFE_NAME = /^[A-Za-z][\w$-]*$/

/**
 * Names lucide-react actually exports, read from its own barrel.
 * A name that isn't there would become a broken named import in the
 * generated registry, so unknown names are dropped with a warning instead.
 * @param {object} config
 * @returns {Set<string>|null} null when lucide-react can't be resolved
 */
async function readLucideExportNames(config) {
  try {
    const requireFromProject = createRequire(join(config.projectRoot, 'package.json'))
    const pkgPath = requireFromProject.resolve('lucide-react/package.json')
    const barrelPath = join(dirname(pkgPath), 'dist/esm/lucide-react.js')

    if (!existsSync(barrelPath)) {
      return null
    }

    const barrel = await readFile(barrelPath, 'utf8')
    const names = new Set()
    for (const match of barrel.matchAll(/default as ([A-Za-z_$][\w$]*)/g)) {
      names.add(match[1])
    }
    return names.size > 0 ? names : null
  } catch {
    return null
  }
}

/**
 * Which config files hold icons resolveIcon can be handed. Exported for tests.
 *
 * Every file directly under a `config/` directory and named `*.config.ts`
 * counts, not only `app.config.ts`: a theme's dashboard, features and flows
 * configs name icons by string the same way its app config does.
 *
 * Separators are normalised first: the generator also runs on Windows, where
 * join() produces '\\' and a '/'-shaped match would silently find nothing —
 * leaving a registry with only its fallbacks, and every entity icon rendering
 * as a Box.
 */
export function isIconSourcePath(filePath) {
  const normalised = filePath.replace(/\\/g, '/')
  return (
    (normalised.includes('/entities/') && normalised.endsWith('.config.ts')) ||
    (normalised.includes('/blocks/') && normalised.endsWith('/config.ts')) ||
    /\/config\/[^/]+\.config\.ts$/.test(normalised)
  )
}

/**
 * Whether a file is component source a theme or plugin could name an icon
 * from at runtime — anything DynamicIcon or resolveIcon could be called
 * from. Exported for tests. Same Windows-separator normalisation as
 * isIconSourcePath, for the same reason.
 */
export function isIconCallSourcePath(filePath) {
  return /\.tsx?$/.test(filePath.replace(/\\/g, '/'))
}

/**
 * Whether a path is test code rather than the app's own source. Exported for
 * tests. A name that a test hands to resolveIcon or DynamicIcon to exercise a
 * component is never reached by a real request, so it would only bloat the
 * registry with icons nothing in production resolves.
 */
export function isTestFilePath(filePath) {
  const normalised = filePath.replace(/\\/g, '/')
  return /\.(test|spec)\.tsx?$/.test(normalised) || /(^|\/)(__tests__|tests|cypress)\//.test(normalised)
}

/**
 * Parse a source file into a TypeScript syntax tree. Exported for tests, so a
 * test can build a tree once and hand it to more than one extractor.
 *
 * Parsed as its own kind of file: a TSX parse reads TypeScript-only syntax in
 * a .ts file (`<T>(props) => ...`) as JSX and loses what follows, so the
 * script kind is derived from `filePath` rather than assumed.
 */
export async function parseIconSource(content, filePath, projectRoot = process.cwd()) {
  const ts = await loadTypeScriptFor(projectRoot)
  const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(filePath))
  return { ts, sourceFile }
}

/** The property key of a `PropertyAssignment` node, whether written bare
 * (`icon: X`) or quoted (`'icon': X`); anything else has no static name. */
function propertyKeyName(nameNode, ts) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteralLike(nameNode)) {
    return nameNode.text
  }
  return null
}

/**
 * Peel off the TypeScript wrappers that change nothing about which value an
 * expression is at runtime — `(expr)`, `expr as T`, `expr satisfies T`,
 * `expr!` — so `icon: 'Wallet' as const` and `icon: Wallet!` are read the same
 * as `icon: 'Wallet'` and `icon: Wallet`. A regex-based scanner never saw
 * these wrappers in the first place; reading syntax does, so it has to strip
 * them explicitly instead of failing to match and dropping the icon silently.
 */
function unwrapTransparentExpression(expression, ts) {
  let current = expression
  while (current) {
    if (ts.isParenthesizedExpression(current) || ts.isAsExpression(current) || ts.isSatisfiesExpression(current) || ts.isNonNullExpression(current)) {
      current = current.expression
      continue
    }
    return current
  }
  return current
}

/**
 * Map of local name -> exported lucide name for a file's lucide imports.
 * `import { Home as HouseIcon }` means the config's `icon: HouseIcon` is
 * lucide's `Home`. Read from the syntax tree, so an import mentioned only in
 * a comment is not a real import.
 */
function parseLucideImports(sourceFile, ts) {
  const imports = new Map()

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue
    if (statement.moduleSpecifier.text !== 'lucide-react') continue

    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings || !ts.isNamedImports(namedBindings)) continue

    for (const element of namedBindings.elements) {
      if (element.isTypeOnly) continue
      imports.set(element.name.text, (element.propertyName ?? element.name).text)
    }
  }

  return imports
}

/** Every `icon: <expr>` property assignment in the tree, wherever it is nested. */
function findIconPropertyAssignments(sourceFile, ts) {
  const assignments = []

  const visit = node => {
    if (ts.isPropertyAssignment(node) && propertyKeyName(node.name, ts) === 'icon') {
      assignments.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return assignments
}

/**
 * Icon names referenced by a single config file. Exported for tests.
 */
export async function extractIconNames(content, filePath = 'icons.config.ts', projectRoot) {
  const { ts, sourceFile } = await parseIconSource(content, filePath, projectRoot)
  const lucideImports = parseLucideImports(sourceFile, ts)
  const names = []

  for (const assignment of findIconPropertyAssignments(sourceFile, ts)) {
    const initializer = unwrapTransparentExpression(assignment.initializer, ts)

    // `icon: Users` — only counts when the identifier came from lucide-react
    if (ts.isIdentifier(initializer)) {
      const exported = lucideImports.get(initializer.text)
      if (exported) names.push(exported)
      continue
    }

    // `icon: 'Users'` or `icon: 'pie-chart'` — a theme's sidebar sections and
    // block configs use both spellings; the caller folds kebab-case into the
    // lucide export name and validates the result against lucide's export
    // list. The generated registry is TypeScript built from this string, so
    // anything not shaped like a name is dropped rather than trusted.
    if (ts.isStringLiteralLike(initializer) && SAFE_NAME.test(initializer.text)) {
      names.push(initializer.text)
    }
  }

  return names
}

/**
 * Icon references in a config file that this build cannot turn into a name.
 * Exported for tests.
 *
 * Only a direct named import of lucide-react and a string literal reach the
 * registry. Anything else — a namespace access (`I.Users`), an identifier
 * aliased through another module, a component of the project's own — is not
 * resolvable by reading this file, so it never enters the registry and
 * resolveIcon falls back. That is silent, hence the warning.
 */
export async function findUnresolvedIconRefs(content, filePath = 'icons.config.ts', projectRoot) {
  const { ts, sourceFile } = await parseIconSource(content, filePath, projectRoot)
  const lucideImports = parseLucideImports(sourceFile, ts)
  const unresolved = []

  for (const assignment of findIconPropertyAssignments(sourceFile, ts)) {
    const original = assignment.initializer
    const initializer = unwrapTransparentExpression(original, ts)

    // A wrapper that resolved to a usable literal or a known lucide import is
    // not unresolved — extractIconNames already has it. Only report what is
    // still opaque once the wrapper is stripped, quoting the source as written
    // (wrapper included) so the warning points at what a developer would grep for.
    if (ts.isStringLiteralLike(initializer) && SAFE_NAME.test(initializer.text)) {
      continue
    }
    if (ts.isIdentifier(initializer) && lucideImports.has(initializer.text)) {
      continue
    }

    if (ts.isPropertyAccessExpression(initializer)) {
      unresolved.push(original.getText(sourceFile))
    } else if (ts.isIdentifier(initializer)) {
      unresolved.push(original.getText(sourceFile))
    }
  }

  return unresolved
}

/** The string literal an expression evaluates to, unwrapping a JSX
 * expression container (`{'pie-chart'}`) and any transparent TypeScript
 * wrapper (`'pie-chart' satisfies string`) around it, or null when the
 * expression isn't a literal — a runtime value that resolveIcon or
 * DynamicIcon reads at render time, not a name this build can see. */
function literalTextOf(expression, ts) {
  const unwrapped = unwrapTransparentExpression(ts.isJsxExpression(expression) ? expression.expression : expression, ts)
  return unwrapped && ts.isStringLiteralLike(unwrapped) ? unwrapped.text : null
}

/** Where a theme or plugin actually gets DynamicIcon and resolveIcon from —
 * every subpath core publishes them under, via its `./lib/*` and
 * `./components/*` export wildcards. */
const CORE_PACKAGE_PREFIX = '@nextsparkjs/core'

/**
 * Local bindings for whatever a file imports from core, so a call site is
 * matched by what it actually refers to rather than by spelling: a named
 * import tracks straight to its local name (aliased or not), a namespace
 * import (`import * as Core from '@nextsparkjs/core/...'`) is tracked so
 * `Core.resolveIcon(...)` resolves too.
 */
function parseCoreImports(sourceFile, ts) {
  const named = new Map() // local name -> imported name
  const namespaces = new Set() // local name bound to `import * as X`

  for (const statement of sourceFile.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteralLike(statement.moduleSpecifier)) continue
    if (!statement.moduleSpecifier.text.startsWith(CORE_PACKAGE_PREFIX)) continue

    const namedBindings = statement.importClause?.namedBindings
    if (!namedBindings) continue

    if (ts.isNamedImports(namedBindings)) {
      for (const element of namedBindings.elements) {
        if (element.isTypeOnly) continue
        named.set(element.name.text, (element.propertyName ?? element.name).text)
      }
    } else if (ts.isNamespaceImport(namedBindings)) {
      namespaces.add(namedBindings.name.text)
    }
  }

  return { named, namespaces }
}

/**
 * Whether `expression` — a JSX tag name or a call's callee — is the given
 * core export, resolved through the file's own imports rather than by
 * comparing text: `import { resolveIcon as ri }` still matches `ri(...)`,
 * `import * as Core from '@nextsparkjs/core/lib/icons'` still matches
 * `Core.resolveIcon(...)`, and a same-named local that was never imported
 * from core — a theme's own `resolveIcon` helper, say — does not.
 */
function referencesCoreExport(expression, exportName, imports, ts) {
  if (ts.isIdentifier(expression)) {
    return imports.named.get(expression.text) === exportName
  }
  if (ts.isPropertyAccessExpression(expression) && ts.isIdentifier(expression.expression)) {
    return imports.namespaces.has(expression.expression.text) && expression.name.text === exportName
  }
  return false
}

/**
 * Icon names passed as a string literal to DynamicIcon's `name` prop or to
 * resolveIcon's first argument. Exported for tests.
 *
 * Both accept a runtime variable too (`resolveIcon(item.icon)`, the normal
 * way to render a value that came from the database) — that call is left
 * alone, since there is no name in it to register.
 */
export async function extractLiteralIconCallNames(content, filePath = 'icons.tsx', projectRoot) {
  const { ts, sourceFile } = await parseIconSource(content, filePath, projectRoot)
  const imports = parseCoreImports(sourceFile, ts)
  const names = []

  const visit = node => {
    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && referencesCoreExport(node.tagName, 'DynamicIcon', imports, ts)) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.text !== 'name' || !attribute.initializer) continue
        const name = literalTextOf(attribute.initializer, ts)
        if (name && SAFE_NAME.test(name)) names.push(name)
      }
    } else if (ts.isCallExpression(node) && referencesCoreExport(node.expression, 'resolveIcon', imports, ts)) {
      const [firstArgument] = node.arguments
      const name = firstArgument && literalTextOf(firstArgument, ts)
      if (name && SAFE_NAME.test(name)) names.push(name)
    }

    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return names
}

async function collectConfigFiles(dir, matcher, found = []) {
  if (!existsSync(dir)) {
    return found
  }

  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch {
    return found
  }

  for (const entry of entries) {
    const entryPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
      await collectConfigFiles(entryPath, matcher, found)
    } else if (matcher(entryPath)) {
      found.push(entryPath)
    }
  }

  return found
}

function coreEntitiesDir(config) {
  if (config.isNpmMode) {
    return join(config.projectRoot, 'node_modules/@nextsparkjs/core/src/entities')
  }
  if (config.isMonorepoMode && config.monorepoRoot) {
    return join(config.monorepoRoot, 'packages/core/src/entities')
  }
  return join(config.projectRoot, 'packages/core/src/entities')
}

/**
 * Discover every icon name the runtime can look up by string.
 * @param {Array} blocks - Blocks from block discovery (each with an `icon` name)
 * @param {object} config - Configuration object from getConfig()
 * @returns {Promise<string[]>} Sorted, de-duplicated, validated icon names
 */
export async function discoverIcons(blocks, config) {
  const candidates = new Set(FALLBACK_ICONS)

  // Only the configs whose icons reach resolveIcon: entity configs (core,
  // themes and plugins), block configs, and every theme's or plugin's
  // config/*.config.ts. Widening this further would put icons in the
  // dashboard bundle that nothing can ask for. Test files are excluded even
  // though a config rarely lives under one, for the same reason call sources
  // exclude them below.
  const isIconSource = filePath => isIconSourcePath(filePath) && !isTestFilePath(filePath)
  const iconSources = [
    ...(await collectConfigFiles(coreEntitiesDir(config), isIconSource)),
    ...(await collectConfigFiles(config.themesDir, isIconSource)),
    ...(await collectConfigFiles(config.pluginsDir, isIconSource))
  ]

  const unresolved = []

  for (const configPath of iconSources) {
    try {
      const content = await readFile(configPath, 'utf8')
      for (const name of await extractIconNames(content, configPath, config.projectRoot)) {
        candidates.add(name)
      }
      for (const reference of await findUnresolvedIconRefs(content, configPath, config.projectRoot)) {
        unresolved.push({ configPath, reference })
      }
    } catch {
      verbose(`[icons] Could not read ${configPath}`)
    }
  }

  for (const { configPath, reference } of unresolved) {
    log(
      `[icons] ${configPath.replace(config.projectRoot, '')}: cannot resolve \`icon: ${reference}\` at build time, so it is not in the registry and will render the fallback. Name it with a string, or import it directly from lucide-react.`,
      'warning'
    )
  }

  // A theme or plugin can also name an icon directly in its own component
  // code rather than through a config, so its trees are scanned for that too.
  // Core is not: every core call site resolves a runtime value (item.icon,
  // config.iconName), never a literal, so there is nothing to add here.
  // Test files are excluded: a spec exercising DynamicIcon or resolveIcon
  // with a literal name isn't a real call site the production bundle needs.
  const isIconCallSource = filePath => isIconCallSourcePath(filePath) && !isTestFilePath(filePath)
  const callSources = [
    ...(await collectConfigFiles(config.themesDir, isIconCallSource)),
    ...(await collectConfigFiles(config.pluginsDir, isIconCallSource))
  ]

  for (const sourcePath of callSources) {
    try {
      const content = await readFile(sourcePath, 'utf8')
      for (const name of await extractLiteralIconCallNames(content, sourcePath, config.projectRoot)) {
        candidates.add(name)
      }
    } catch {
      verbose(`[icons] Could not read ${sourcePath}`)
    }
  }

  for (const block of blocks || []) {
    if (block.icon) {
      candidates.add(block.icon)
    }
  }

  const known = await readLucideExportNames(config)
  if (!known) {
    // Every name becomes a named import, so a kebab-case one would emit
    // `import { pie-chart }` and break the build. Without lucide's list there
    // is nothing to fold them against, so they are dropped instead.
    const importable = [...candidates].filter(name => /^[A-Za-z_$][\w$]*$/.test(name))
    log('Could not read lucide-react exports; icon registry will include every importable name found', 'warning')
    return importable.sort()
  }

  // Configs spell icons both ways: `CheckSquare` in entity configs, `pie-chart`
  // in a theme's sidebar and block configs. The registry is keyed by the export
  // name, so kebab-case names are folded into it rather than dropped.
  const toPascalCase = name =>
    name
      .split(/[-_\s]+/)
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join('')

  const valid = []
  const unknown = []
  for (const name of candidates) {
    if (known.has(name)) {
      valid.push(name)
      continue
    }
    const pascalCased = toPascalCase(name)
    if (known.has(pascalCased)) {
      valid.push(pascalCased)
      continue
    }
    unknown.push(name)
  }

  if (unknown.length > 0) {
    log(`Icons not exported by lucide-react, skipped: ${[...new Set(unknown)].sort().join(', ')}`, 'warning')
  }

  verbose(`[icons] ${valid.length} icon(s) referenced by name`)
  return [...new Set(valid)].sort()
}
