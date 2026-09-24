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

/** The property keys a config's icon can be written under — the plain
 * `icon: X` shape and `iconName: X`, the one a theme's sidebar, dashboard,
 * feature and flow configs use. */
const ICON_KEYS = new Set(['icon', 'iconName'])

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
 * (`icon: X`), quoted (`'icon': X`) or computed with a literal (`['icon']: X`);
 * anything else — a computed key that isn't a literal — has no static name. */
function propertyKeyName(nameNode, ts) {
  if (ts.isIdentifier(nameNode) || ts.isStringLiteralLike(nameNode)) {
    return nameNode.text
  }
  if (ts.isComputedPropertyName(nameNode)) {
    const expression = unwrapTransparentExpression(nameNode.expression, ts)
    return expression && ts.isStringLiteralLike(expression) ? expression.text : null
  }
  return null
}

/**
 * Peel off the TypeScript wrappers that change nothing about which value an
 * expression is at runtime — `(expr)`, `expr as T`, `<T>expr`,
 * `expr satisfies T`, `expr!` — so `icon: 'Wallet' as const`, `icon: <any>Wallet`
 * and `icon: Wallet!` are read the same as `icon: 'Wallet'` and `icon: Wallet`.
 * A regex-based scanner never saw these wrappers in the first place; reading
 * syntax does, so it has to strip them explicitly instead of failing to match
 * and dropping the icon silently.
 */
function unwrapTransparentExpression(expression, ts) {
  let current = expression
  while (current) {
    if (
      ts.isParenthesizedExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isTypeAssertionExpression(current) ||
      ts.isSatisfiesExpression(current) ||
      ts.isNonNullExpression(current)
    ) {
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

/** The expression a `get icon()`-style accessor's body returns, when the
 * body is exactly one `return <expr>` statement — the only shape simple
 * enough to read a static icon name from. Anything else (no return,
 * several statements, a conditional) has no single value to extract, so the
 * caller falls back to the accessor node itself, which resolves as neither
 * a literal nor a lucide import and is therefore reported as unresolved
 * rather than silently dropped. */
function accessorReturnExpression(node, ts) {
  const [statement] = node.body?.statements ?? []
  return node.body?.statements.length === 1 && statement && ts.isReturnStatement(statement) && statement.expression
    ? statement.expression
    : null
}

/** Whether a `set icon(v)` accessor has a `get icon()` beside it in the same
 * object literal or class, the member that actually supplies the value. */
function hasSiblingGetter(setter, ts) {
  const siblings = setter.parent.properties ?? setter.parent.members ?? []
  const key = propertyKeyName(setter.name, ts)
  return siblings.some(sibling => ts.isGetAccessorDeclaration(sibling) && propertyKeyName(sibling.name, ts) === key)
}

/**
 * Every icon-bearing property value in the tree, wherever it is nested —
 * `icon` or `iconName` written plain, quoted or computed (`node.initializer`),
 * as a class field with an initializer, the shorthand form `{ icon }`, where
 * the property's own name doubles as the value (`node.name`), and a getter
 * (`get icon() { return 'Wallet' }`), an accessor object configs use the same
 * as a plain property.
 *
 * A member under an icon key that holds no name to read — a method
 * (`icon() { ... }`, whose value is the function itself) or a setter with no
 * getter beside it (whose value reads as undefined) — is collected as the
 * member node, which resolves as neither a literal nor a lucide import and is
 * therefore reported as unresolved rather than silently dropped.
 */
function findIconPropertyValues(sourceFile, ts) {
  const values = []

  const visit = node => {
    if ((ts.isPropertyAssignment(node) || (ts.isPropertyDeclaration(node) && node.initializer)) && ICON_KEYS.has(propertyKeyName(node.name, ts))) {
      values.push(node.initializer)
    } else if (ts.isShorthandPropertyAssignment(node) && ICON_KEYS.has(node.name.text)) {
      values.push(node.name)
    } else if (ts.isGetAccessorDeclaration(node) && ICON_KEYS.has(propertyKeyName(node.name, ts))) {
      values.push(accessorReturnExpression(node, ts) ?? node)
    } else if (ts.isMethodDeclaration(node) && ICON_KEYS.has(propertyKeyName(node.name, ts))) {
      values.push(node)
    } else if (ts.isSetAccessorDeclaration(node) && ICON_KEYS.has(propertyKeyName(node.name, ts)) && !hasSiblingGetter(node, ts)) {
      values.push(node)
    }
    ts.forEachChild(node, visit)
  }
  visit(sourceFile)

  return values
}

/**
 * Icon names referenced by a single config file. Exported for tests.
 */
export async function extractIconNames(content, filePath = 'icons.config.ts', projectRoot) {
  const { ts, sourceFile } = await parseIconSource(content, filePath, projectRoot)
  const lucideImports = parseLucideImports(sourceFile, ts)
  const names = []

  for (const value of findIconPropertyValues(sourceFile, ts)) {
    const initializer = unwrapTransparentExpression(value, ts)

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
 * aliased through another module, a call (`chooseIcon()`), a component of the
 * project's own — is not resolvable by reading this file, so it never enters
 * the registry and resolveIcon falls back. That is silent, hence the warning:
 * whatever isn't one of the two resolvable shapes is reported, whatever kind
 * of expression it is, rather than allowlisting the shapes worth warning about.
 */
export async function findUnresolvedIconRefs(content, filePath = 'icons.config.ts', projectRoot) {
  const { ts, sourceFile } = await parseIconSource(content, filePath, projectRoot)
  const lucideImports = parseLucideImports(sourceFile, ts)
  const unresolved = []

  for (const value of findIconPropertyValues(sourceFile, ts)) {
    const initializer = unwrapTransparentExpression(value, ts)

    // A wrapper that resolved to a usable literal or a known lucide import is
    // not unresolved — extractIconNames already has it. Quoting the source as
    // written (wrapper included) so the warning points at what a developer
    // would grep for.
    const resolvedAsLiteral = ts.isStringLiteralLike(initializer) && SAFE_NAME.test(initializer.text)
    const resolvedAsLucideImport = ts.isIdentifier(initializer) && lucideImports.has(initializer.text)

    if (!resolvedAsLiteral && !resolvedAsLucideImport) {
      unresolved.push(value.getText(sourceFile))
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
 * `./components/*` export wildcards. Matched as a whole package name, not a
 * string prefix: `@nextsparkjs/core-fake/lib/icons` starts with this string
 * but is a different package entirely. */
const CORE_PACKAGE_PREFIX = '@nextsparkjs/core'

/** Whether a module specifier is core itself or one of its subpaths — the
 * whole `@nextsparkjs/core` package segment, not merely a string prefix of it. */
function isCorePackageSpecifier(moduleSpecifierText) {
  return moduleSpecifierText === CORE_PACKAGE_PREFIX || moduleSpecifierText.startsWith(`${CORE_PACKAGE_PREFIX}/`)
}

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
    if (!isCorePackageSpecifier(statement.moduleSpecifier.text)) continue

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

/** The bare names a node declares in its own lexical scope: a function's
 * parameters, a `let`/`const`/`var` declaration's bindings, a catch clause's
 * binding. Destructured names are collected too, so `function f({ resolveIcon })`
 * shadows the same as `function f(resolveIcon)`. */
function collectBindingNames(name, ts, into) {
  if (ts.isIdentifier(name)) {
    into.add(name.text)
  } else if (ts.isObjectBindingPattern(name) || ts.isArrayBindingPattern(name)) {
    for (const element of name.elements) {
      if (ts.isBindingElement(element)) collectBindingNames(element.name, ts, into)
    }
  }
}

/** Whether `node` starts its own `var` scope, one a hoisted `var` cannot
 * escape: any function (declaration, expression, arrow, method, getter,
 * setter, constructor), a class `static { }` block, or a TypeScript
 * `namespace`, which compiles to a function of its own. This is where
 * `collectHoistedVarNames` below stops recursing. */
function isVarScopeBoundary(node, ts) {
  return ts.isFunctionLike(node) || ts.isClassStaticBlockDeclaration(node) || ts.isModuleDeclaration(node)
}

/** Every `var`-declared name nested anywhere under `node` — inside an `if`,
 * a loop, a `switch`, as deep as it goes — except inside a nested `var`
 * scope (see isVarScopeBoundary). Unlike `let`/`const`, `var` ignores block
 * boundaries, so a single level of `node.statements` (what the block/module
 * branch below reads for `let`/`const`) misses one declared inside a nested
 * block; this walks the whole subtree instead, the way hoisting actually
 * works. */
function collectHoistedVarNames(node, ts, into) {
  if (isVarScopeBoundary(node, ts)) return

  if (ts.isVariableStatement(node) && (node.declarationList.flags & ts.NodeFlags.BlockScoped) === 0) {
    for (const declaration of node.declarationList.declarations) collectBindingNames(declaration.name, ts, into)
  } else if (
    (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) &&
    node.initializer &&
    ts.isVariableDeclarationList(node.initializer) &&
    (node.initializer.flags & ts.NodeFlags.BlockScoped) === 0
  ) {
    for (const declaration of node.initializer.declarations) collectBindingNames(declaration.name, ts, into)
  }

  ts.forEachChild(node, child => collectHoistedVarNames(child, ts, into))
}

/** The declarations directly in `statements` that introduce a name into
 * their enclosing scope: function, class, `let`/`const`/`var` declarations,
 * and TypeScript's value-bearing `enum`, `namespace` and `import x = ...`.
 * Shared by a block/module's own statement list and by a `switch`'s case
 * clauses, which — unlike a block per clause — all share one scope across
 * the whole switch. */
function blockScopedBindingNames(statements, ts, into) {
  for (const statement of statements) {
    if (
      (ts.isFunctionDeclaration(statement) ||
        ts.isClassDeclaration(statement) ||
        ts.isEnumDeclaration(statement) ||
        ts.isModuleDeclaration(statement) ||
        ts.isImportEqualsDeclaration(statement)) &&
      statement.name &&
      ts.isIdentifier(statement.name)
    ) {
      into.add(statement.name.text)
    } else if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        collectBindingNames(declaration.name, ts, into)
      }
    }
  }
}

/** The names `node` introduces into its own scope, or an empty set when it
 * introduces none. Used while walking the tree to track which imported names
 * are shadowed by a closer local declaration.
 *
 * A function's parameters — a getter's, a setter's and a constructor's as
 * much as a method's or an arrow's — and a named function expression's own
 * name are scoped to its parameter initializers and body. Its hoisted `var`
 * names are added separately when the walk enters its body, because parameter
 * initializers cannot see declarations from that body. A class expression's
 * own name is scoped to itself, as is every `var` hoisted in a class `static
 * { }` block or a `namespace` body. A block's (or the module's, or a
 * namespace's) function, class and `let`/`const`/`var` declarations are
 * scoped to the whole block, not merely to the statement that introduces
 * them — a later sibling statement has to see the shadow too, the way it
 * would at runtime. A `for`/`for-in`/`for-of` loop's own `let`/`const`
 * initializer is scoped to the whole loop, not just to itself, and every
 * clause of a `switch` shares one scope. */
function ownScopeBindingNames(node, ts) {
  const names = new Set()

  if (ts.isFunctionLike(node)) {
    for (const parameter of node.parameters) collectBindingNames(parameter.name, ts, names)
    if (ts.isFunctionExpression(node) && node.name) {
      names.add(node.name.text)
    }
  } else if (ts.isClassExpression(node) && node.name) {
    names.add(node.name.text)
  } else if (ts.isClassStaticBlockDeclaration(node)) {
    collectHoistedVarNames(node.body, ts, names)
  } else if (ts.isModuleBlock(node)) {
    blockScopedBindingNames(node.statements, ts, names)
    for (const statement of node.statements) collectHoistedVarNames(statement, ts, names)
  } else if (ts.isVariableDeclarationList(node)) {
    for (const declaration of node.declarations) collectBindingNames(declaration.name, ts, names)
  } else if ((ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) && node.initializer && ts.isVariableDeclarationList(node.initializer)) {
    for (const declaration of node.initializer.declarations) collectBindingNames(declaration.name, ts, names)
  } else if (ts.isCatchClause(node) && node.variableDeclaration) {
    collectBindingNames(node.variableDeclaration.name, ts, names)
  } else if (ts.isCaseBlock(node)) {
    for (const clause of node.clauses) blockScopedBindingNames(clause.statements, ts, names)
  } else if (ts.isBlock(node) || ts.isSourceFile(node)) {
    blockScopedBindingNames(node.statements, ts, names)
    if (ts.isSourceFile(node)) collectHoistedVarNames(node, ts, names)
  }

  return names
}

/**
 * Whether `expression` — a JSX tag name or a call's callee — is the given
 * core export, resolved through the file's own imports rather than by
 * comparing text: `import { resolveIcon as ri }` still matches `ri(...)` and
 * `ri!(...)`, `import * as Core from '@nextsparkjs/core/lib/icons'` still
 * matches `Core.resolveIcon(...)`, and a same-named local that was never
 * imported from core — a theme's own `resolveIcon` helper, or a function
 * parameter that shadows the import — does not.
 */
function referencesCoreExport(expression, exportName, imports, ts, shadowStack) {
  const unwrapped = unwrapTransparentExpression(expression, ts)
  const isShadowed = name => shadowStack.some(scope => scope.has(name))

  if (ts.isIdentifier(unwrapped)) {
    return !isShadowed(unwrapped.text) && imports.named.get(unwrapped.text) === exportName
  }
  if (ts.isPropertyAccessExpression(unwrapped) && ts.isIdentifier(unwrapped.expression)) {
    return !isShadowed(unwrapped.expression.text) && imports.namespaces.has(unwrapped.expression.text) && unwrapped.name.text === exportName
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

  // A local declaration (a function parameter, a `let`/`const`, a catch
  // binding) shadows an import of the same name for the rest of its scope,
  // the same way it would at runtime — so the stack of scopes entered so far
  // travels with the walk instead of imports being looked up by name alone.
  const visit = (node, shadowStack) => {
    const ownNames = ownScopeBindingNames(node, ts)
    const nextStack = ownNames.size > 0 ? [...shadowStack, ownNames] : shadowStack

    if ((ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) && referencesCoreExport(node.tagName, 'DynamicIcon', imports, ts, nextStack)) {
      for (const attribute of node.attributes.properties) {
        if (!ts.isJsxAttribute(attribute) || attribute.name.text !== 'name' || !attribute.initializer) continue
        const name = literalTextOf(attribute.initializer, ts)
        if (name && SAFE_NAME.test(name)) names.push(name)
      }
    } else if (ts.isCallExpression(node) && referencesCoreExport(node.expression, 'resolveIcon', imports, ts, nextStack)) {
      const [firstArgument] = node.arguments
      const name = firstArgument && literalTextOf(firstArgument, ts)
      if (name && SAFE_NAME.test(name)) names.push(name)
    }

    if (ts.isFunctionLike(node) && node.body) {
      const bodyNames = new Set()
      collectHoistedVarNames(node.body, ts, bodyNames)
      const bodyStack = bodyNames.size > 0 ? [...nextStack, bodyNames] : nextStack
      ts.forEachChild(node, child => {
        const childStack = child === node.body ? bodyStack : node.parameters.includes(child) ? nextStack : shadowStack
        visit(child, childStack)
      })
    } else {
      ts.forEachChild(node, child => visit(child, nextStack))
    }
  }
  visit(sourceFile, [])

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
  const pluginSourceDirs = (config.plugins ?? []).map(pluginName => join(config.pluginsDir, pluginName))
  const iconSources = [
    ...(await collectConfigFiles(join(config.coreDir, 'src', 'entities'), isIconSource)),
    ...(await collectConfigFiles(config.projectSourceDir, isIconSource)),
    ...(await Promise.all(pluginSourceDirs.map(dir => collectConfigFiles(dir, isIconSource)))).flat()
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
    ...(await collectConfigFiles(config.projectSourceDir, isIconCallSource)),
    ...(await Promise.all(pluginSourceDirs.map(dir => collectConfigFiles(dir, isIconCallSource)))).flat()
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
