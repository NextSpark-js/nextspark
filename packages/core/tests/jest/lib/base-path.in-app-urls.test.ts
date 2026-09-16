/**
 * No in-app URL is written without the base path (#198).
 *
 * Next.js adds the base path to `<Link>`, `router.push` and `redirect()`, and
 * to nothing else. A `fetch('/api/...')`, an `<img src={upload.url}>`, an
 * `<a href="/docs">` inside stored markup or a CSP report endpoint in a header
 * therefore leaves it out, and under a base path every one of those 404s.
 * Neither the type-checker nor a runtime test of a single component catches a
 * new one being written, so the source itself is asserted here.
 *
 * Six shapes are scanned, because Next.js prefixes none of them:
 *  - calls that take a URL: fetch, new URL, window.open, history entries
 *  - the attributes of an element that loads or navigates to a URL: an
 *    `<a href>`, an `<img src>`, an `<iframe src>`, and the same attribute on a
 *    component that hands it to the browser as given (see LOADERS and
 *    PASS_THROUGH)
 *  - `url()` inside a style, such as a background image built from an upload
 *  - markup handed to dangerouslySetInnerHTML, which carries its own URLs
 *  - the config files, whose headers name endpoints as plain strings
 *
 * The scan reads the syntax tree, not lines of text: the call and its path can
 * sit on different lines, and the path is just as often built into a variable
 * or handed over as data.
 *
 * A component is recognised by where it comes from, not by its name: an import
 * is resolved the way TypeScript resolves it with apps/dev's paths, whether it
 * is imported by name, as the default, as `{ default as X }`, through a
 * namespace, or with require(), and followed through re-exports. A member of a
 * module counts when the module is held by require(), a namespace import, or a
 * variable given one of those: `require('m').Image`, `require('m')['default']`,
 * `Namespace.Image`, `const images = require('next/image')` then
 * `images.default`. So core's
 * AvatarImage, which puts the base path on, is told apart from the shared one
 * it wraps, and lucide's Image icon from next/image's.
 *
 * A name is followed to the declaration TypeScript's checker says it refers to,
 * so a variable is not mistaken for another of the same name in a nested
 * function, or for an import it shadows. A variable, at the top of a module or
 * inside a component, counts as each value it is given in one of these ways,
 * which is how a tag chosen at run time counts as each tag it can be:
 *  - its initializer, with each branch of a conditional, `||` and `??`
 *    (`const Comp = asChild ? Slot : 'a'`, `as ?? 'a'`)
 *  - for a name destructured from an object, its default (`{ as: Tag = 'img' }`)
 *    and the member it is read from (`const { default: Image } = require('next/image')`)
 *  - each element of an array written out that a `for...of` declaring it walks,
 *    or the member of each element it destructures
 *  - each value assigned to it anywhere in the module with `=`, `||=`, `??=`
 *    or `&&=`, or by a `for...of` over an array written out
 * A prop, or any other variable given no value in those ways, is not taken for
 * a component. A
 * Slot loads nothing itself; the child it hands its props to is checked where
 * that child is written.
 *
 * Props handed over whole count too: an element that loads a URL and receives
 * a spread, without that attribute written out, is reported, since the URL
 * inside the spread goes unseen.
 *
 * The other way round, a URL already under the base path handed to a component
 * that puts it on by itself is reported: `<Link href={withBasePath('/docs')}>`
 * goes to /base/base/docs (see PREFIXERS).
 *
 * What the scan does not follow, by design: a tag passed in from outside the
 * component (`<Box as="a" href="/pricing" />` reads as a Box), a tag read from an
 * object or returned by a function (`tags.link`, `pickTag()`), array
 * destructuring and destructuring assignments, elements built with
 * createElement or cloneElement, a component loaded with import() or
 * next/dynamic, a URL assigned to a DOM property (`image.src = …`), a `url(`
 * held in a variable before the value is joined to it, and `redirect()` or
 * `router.push()` given a URL with the base path on. In these trees,
 * createElement renders an icon, or a component looked up by name, with the
 * props it was given, and the URLs assigned to DOM properties are object URLs
 * of a file being uploaded or exported.
 */
import ts from 'typescript'
import { readdirSync, readFileSync, existsSync, realpathSync } from 'fs'
import { join, relative } from 'path'

const REPO_ROOT = realpathSync(join(__dirname, '../../../../..'))

const TREES = [
  'packages/core/src',
  'packages/core/templates',
  'packages/ui/src',
  'themes',
  'plugins',
  'apps/dev/app',
  'apps/dev/lib',
  'apps/dev/src',
]

const SKIP_DIRS = new Set(['node_modules', '.next', 'dist', 'coverage', '.turbo', 'tests', '__tests__', 'cypress'])

/** Calls that take a URL Next.js does not prefix. */
const CALLS = new Set(['fetch', 'sendBeacon', 'open', 'new URL', 'new EventSource', 'new WebSocket'])

/** History entries: the URL the browser is left showing is the third argument. */
const HISTORY_CALLS = new Set(['pushState', 'replaceState'])

/** Attributes the browser resolves against the origin, by the tag that carries them. */
const ASSET_ATTRIBUTES: Record<string, string[]> = {
  a: ['href'],
  img: ['src', 'srcSet'],
  source: ['src', 'srcSet'],
  video: ['src', 'poster'],
  audio: ['src'],
  iframe: ['src'],
  link: ['href'],
  script: ['src'],
  embed: ['src'],
  object: ['data'],
  track: ['src'],
  form: ['action'],
}

/**
 * Components from packages that hand a URL attribute to the browser, or to an
 * optimizer that fetches it from the app, as given, by `module#export`.
 */
const LOADERS: Record<string, string[]> = {
  // the optimizer fetches the src from the app itself, and nothing prefixes it any more than an <img src>
  'next/image#default': ['src'],
  'next/legacy/image#default': ['src'],
  // loads src in an off-screen image, and renders the <img> only once that load succeeds
  '@radix-ui/react-avatar#Image': ['src'],
  '@radix-ui/react-avatar#AvatarImage': ['src'],
}

/**
 * Components from packages that put the base path on a URL attribute
 * themselves, by `module#export`. Given a URL that already carries it, they put
 * it on twice.
 */
const PREFIXERS: Record<string, string[]> = {
  'next/link#default': ['href'],
}

/**
 * Components of ours that pass a URL attribute on as given, spread among their
 * props. The spread inside them is not reported; every use of them, and of
 * whatever re-exports them, is checked the way an `<img>` is.
 */
const PASS_THROUGH = [
  {
    file: 'packages/ui/src/components/Avatar.tsx',
    component: 'AvatarImage',
    attributes: ['src'],
    why: 'the shared primitive serves mobile as well and has no base path; core’s AvatarImage puts it on',
  },
]

/** The text before a `url(` whose argument is the value that follows it. */
const CSS_URL_OPENING = /url\(\s*['"]?$/i

/** A `url()` whose argument is written out as an in-app path. */
const CSS_URL_WITH_PATH = /url\(\s*['"]?\/(?!\/)/i

/** Helpers that put the base path on a URL, or on every URL inside markup. */
const HELPERS = new Set(['withBasePath', 'withBasePathIfInApp', 'withBasePathInHtml', 'withBasePathInSrcset'])

/** Helpers that hand back markup with its in-app URLs already prefixed. */
const HTML_HELPERS = new Set(['sanitizeBlockHtml', 'withBasePathInHtml'])

/** A URL of its own, not one this app serves. */
const ALLOWED = [
  {
    file: 'packages/core/src/lib/mcp/executor.ts',
    text: 'INTERNAL_ORIGIN',
    why: 'a request handed straight to a route handler, which is given its URL without the base path',
  },
  {
    file: 'apps/dev/app/layout.tsx',
    text: 'domain',
    why: 'preconnect and dns-prefetch name the billing provider’s origin, not a path this app serves',
  },
  {
    file: 'apps/dev/app/layout.ppr.tsx',
    text: 'domain',
    why: 'preconnect and dns-prefetch name the billing provider’s origin, not a path this app serves',
  },
  {
    file: 'themes/default/blocks/video-hero/component.tsx',
    text: 'embedUrl',
    why: 'getEmbedUrl() returns a full YouTube or Vimeo URL, or null',
  },
  {
    file: 'packages/core/src/components/dashboard/misc/SearchDropdown.tsx',
    text: 'highlighted',
    why: 'escaped result text with <mark> around the match, which carries no URL',
  },
  {
    file: 'packages/core/src/components/devtools/ConfigViewer.tsx',
    text: '__html: html',
    why: 'Shiki’s highlighting of a JSON config: spans and text, no URL',
  },
  {
    file: 'packages/core/src/components/devtools/MarkdownViewer.tsx',
    text: '__html: html',
    why: 'Shiki’s highlighting of a code sample: spans and text, no URL',
  },
  {
    file: 'packages/core/src/components/devtools/api-explorer/ApiDocsModal.tsx',
    text: '__html: html',
    why: 'renderMarkdown() writes headings, lists and mermaid blocks, and no links',
  },
  {
    file: 'packages/core/src/components/docs/docs-content.tsx',
    text: '__html: html',
    why: 'docs HTML is built by remark on the server, where there is no DOM to rewrite it with',
  },
  {
    file: 'packages/core/src/components/ui/optimized-image.tsx',
    text: 'resolvedSrc',
    why: 'a string src goes through withBasePathIfInApp where resolvedSrc is built; an imported image is passed through',
  },
  {
    file: 'themes/blog/components/editor/WysiwygEditor.tsx',
    text: 'sanitizePostHtml',
    why: 'the editable body is what gets stored, so it shows the URLs as written',
  },
]

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      sourceFiles(path, found)
      continue
    }
    if (!entry.isFile() || !/\.tsx?$/.test(entry.name) || /\.(test|spec|d)\.tsx?$/.test(entry.name)) continue
    found.push(path)
  }
  return found
}

/** The path a node spells out, when it spells one out at all. */
function writtenPath(node: ts.Node | undefined): string | undefined {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isTemplateExpression(node)) return node.head.text
  if (ts.isConditionalExpression(node)) return writtenPath(node.whenTrue) ?? writtenPath(node.whenFalse)
  return undefined
}

function callsOneOf(node: ts.Node, names: Set<string>): boolean {
  return ts.isCallExpression(node) && ts.isIdentifier(node.expression) && names.has(node.expression.text)
}

function isWrapped(node: ts.Node): boolean {
  // `src && withBasePathIfInApp(src)`: prefixed, or empty
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken) {
    return isWrapped(node.right)
  }
  return callsOneOf(node, HELPERS)
}

function isStringLiteral(node: ts.Node): node is ts.StringLiteral | ts.NoSubstitutionTemplateLiteral {
  return ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)
}

/** A value that names another origin however it is built, so no prefix applies. */
function isElsewhere(node: ts.Node): boolean {
  const written = writtenPath(node)
  return written !== undefined && !written.startsWith('/')
}

function calledName(node: ts.Node): string {
  if (ts.isCallExpression(node)) {
    if (ts.isIdentifier(node.expression)) return node.expression.text
    if (ts.isPropertyAccessExpression(node.expression)) return node.expression.name.text
  }
  if (ts.isNewExpression(node) && ts.isIdentifier(node.expression)) return `new ${node.expression.text}`
  return ''
}

function attributeValue(attribute: ts.JsxAttribute): ts.Node | undefined {
  const initializer = attribute.initializer
  if (!initializer) return undefined
  return ts.isJsxExpression(initializer) ? initializer.expression : initializer
}

/**
 * Imports are resolved the way apps/dev's TypeScript resolves them. The shared
 * UI package resolves to its built types there, so it is pointed at its source.
 */
const COMPILER_OPTIONS = (() => {
  const appDir = join(REPO_ROOT, 'apps/dev')
  const { config } = ts.readConfigFile(join(appDir, 'tsconfig.json'), ts.sys.readFile)
  const { options } = ts.convertCompilerOptionsFromJson(config.compilerOptions, appDir)
  options.paths = { ...options.paths, '@nextsparkjs/ui': ['../../packages/ui/src/index.ts'] }
  return options
})()

const RESOLUTION_CACHE = ts.createModuleResolutionCache(REPO_ROOT, name => name, COMPILER_OPTIONS)
const MODULE_KEYS = new Map<string, string>()

/** The file a specifier names from a file of ours, or the specifier itself for a package's module. */
function moduleKey(specifier: string, fromFile: string): string {
  const id = `${fromFile}\0${specifier}`
  const known = MODULE_KEYS.get(id)
  if (known) return known
  const resolved = ts.resolveModuleName(specifier, fromFile, COMPILER_OPTIONS, ts.sys, RESOLUTION_CACHE).resolvedModule
  const key =
    !resolved || resolved.isExternalLibraryImport || resolved.resolvedFileName.includes('/node_modules/')
      ? specifier
      : realpathSync(resolved.resolvedFileName)
  MODULE_KEYS.set(id, key)
  return key
}

/** Where a name in a module comes from: another module's export (`*` for the module itself). */
type Binding = { specifier: string; name: string }

interface ModuleInfo {
  source: ts.SourceFile
  imports: Map<string, Binding>
  /** The names declared at the top of the module, by the identifier that declares them */
  declared: Map<string, ts.Identifier>
  exports: Map<string, Binding | { local: string }>
  starExports: string[]
}

/** The expression inside parentheses, type assertions and `satisfies`. */
function unwrapped(node: ts.Expression): ts.Expression {
  while (
    ts.isParenthesizedExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isTypeAssertionExpression(node) ||
    ts.isNonNullExpression(node)
  ) {
    node = node.expression
  }
  return node
}

const MODULES = new Map<string, ModuleInfo>()

/** What a require() stands for: the module (`*`), or one of its exports (`require('m').Image`, `require('m')['default']`). */
function requiredModule(node: ts.Expression | undefined): Binding | undefined {
  if (!node) return undefined
  const member = memberName(node)
  if (member !== undefined) {
    const module = requiredModule((node as ts.PropertyAccessExpression | ts.ElementAccessExpression).expression)
    return module && module.name === '*' ? { specifier: module.specifier, name: member } : undefined
  }
  if (
    ts.isCallExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'require' &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    return { specifier: node.arguments[0].text, name: '*' }
  }
  return undefined
}

/** The member an access reads by name: `m.Image`, `m['default']`. */
function memberName(node: ts.Node): string | undefined {
  if (ts.isPropertyAccessExpression(node)) return node.name.text
  if (ts.isElementAccessExpression(node) && isStringLiteral(node.argumentExpression)) return node.argumentExpression.text
  return undefined
}

/** The identifiers a binding name declares: `Comp`, or each name inside `{ default: Image, ...rest }`. */
function declaredIdentifiers(name: ts.BindingName): ts.Identifier[] {
  if (ts.isIdentifier(name)) return [name]
  return name.elements.flatMap(element => (ts.isOmittedExpression(element) ? [] : declaredIdentifiers(element.name)))
}

function moduleInfo(file: string): ModuleInfo {
  const known = MODULES.get(file)
  if (known) return known

  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const info: ModuleInfo = { source, imports: new Map(), declared: new Map(), exports: new Map(), starExports: [] }
  const isExported = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword)
  const isDefault = (node: ts.Node) =>
    ts.canHaveModifiers(node) && (ts.getModifiers(node) ?? []).some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword)

  for (const statement of source.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier) && statement.importClause) {
      const specifier = statement.moduleSpecifier.text
      const clause = statement.importClause
      if (clause.name) info.imports.set(clause.name.text, { specifier, name: 'default' })
      if (clause.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
        info.imports.set(clause.namedBindings.name.text, { specifier, name: '*' })
      }
      if (clause.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        for (const element of clause.namedBindings.elements) {
          info.imports.set(element.name.text, { specifier, name: (element.propertyName ?? element.name).text })
        }
      }
    }

    if (
      ts.isImportEqualsDeclaration(statement) &&
      ts.isExternalModuleReference(statement.moduleReference) &&
      ts.isStringLiteral(statement.moduleReference.expression)
    ) {
      info.imports.set(statement.name.text, { specifier: statement.moduleReference.expression.text, name: '*' })
    }

    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        for (const identifier of declaredIdentifiers(declaration.name)) {
          info.declared.set(identifier.text, identifier)
          if (isExported(statement)) info.exports.set(identifier.text, { local: identifier.text })
        }
      }
    }

    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name) {
      info.declared.set(statement.name.text, statement.name)
      if (isExported(statement)) info.exports.set(isDefault(statement) ? 'default' : statement.name.text, { local: statement.name.text })
    }

    if (ts.isExportAssignment(statement) && !statement.isExportEquals && ts.isIdentifier(statement.expression)) {
      info.exports.set('default', { local: statement.expression.text })
    }

    if (ts.isExportDeclaration(statement)) {
      const specifier =
        statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier) ? statement.moduleSpecifier.text : undefined
      if (!statement.exportClause) {
        if (specifier) info.starExports.push(specifier)
      } else if (ts.isNamespaceExport(statement.exportClause)) {
        if (specifier) info.exports.set(statement.exportClause.name.text, { specifier, name: '*' })
      } else {
        for (const element of statement.exportClause.elements) {
          const name = (element.propertyName ?? element.name).text
          info.exports.set(element.name.text, specifier ? { specifier, name } : { local: name })
        }
      }
    }
  }

  MODULES.set(file, info)
  return info
}

const CHECKERS = new Map<string, ts.TypeChecker>()

/**
 * A checker for one module on its own. Imports are left unresolved: all it is
 * asked is which declaration a name inside the module refers to, which is
 * what tells a variable apart from another of the same name in a nested
 * function, or from an import it shadows.
 */
function checkerFor(module: string): ts.TypeChecker {
  const known = CHECKERS.get(module)
  if (known) return known
  const { source } = moduleInfo(module)
  const options: ts.CompilerOptions = { noResolve: true, noLib: true, types: [], jsx: ts.JsxEmit.Preserve }
  const host = ts.createCompilerHost(options)
  host.getSourceFile = file => (file === source.fileName ? source : undefined)
  host.fileExists = file => file === source.fileName
  const checker = ts.createProgram([source.fileName], options, host).getTypeChecker()
  CHECKERS.set(module, checker)
  return checker
}

/** A value a variable is given: an expression, or a member of one (`const { default: Image } = images`). */
type GivenValue = { expression: ts.Expression; member?: string }

const ASSIGNMENTS = new Map<string, Map<ts.Symbol, GivenValue[]>>()

/**
 * The values assigned to each variable of a module after it is declared:
 * `Comp = 'a'`, `Comp ||= 'a'`, `Comp ??= 'a'`, `Comp &&= 'a'`, and each element
 * of an array a `for (Comp of [...])` walks. The variable assigned to is the
 * one the checker resolves, so an assignment inside a nested function to a
 * variable declared there does not count for another of the same name.
 */
function assignmentsIn(module: string): Map<ts.Symbol, GivenValue[]> {
  const known = ASSIGNMENTS.get(module)
  if (known) return known
  const checker = checkerFor(module)
  const assignments = new Map<ts.Symbol, GivenValue[]>()
  const add = (target: ts.Expression, values: GivenValue[]) => {
    const symbol = ts.isIdentifier(target) ? checker.getSymbolAtLocation(target) : undefined
    if (symbol) assignments.set(symbol, [...(assignments.get(symbol) ?? []), ...values])
  }
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) add(node.left, [{ expression: node.right }])
    if (ts.isForOfStatement(node) && !ts.isVariableDeclarationList(node.initializer)) add(node.initializer, elementsOf(node.expression))
    ts.forEachChild(node, visit)
  }
  visit(moduleInfo(module).source)
  ASSIGNMENTS.set(module, assignments)
  return assignments
}

const ASSIGNMENT_OPERATORS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])

/** The elements of an array written out, which a `for...of` over it takes in turn. */
function elementsOf(node: ts.Expression): GivenValue[] {
  node = unwrapped(node)
  if (!ts.isArrayLiteralExpression(node)) return []
  return node.elements.filter(element => !ts.isSpreadElement(element)).map(expression => ({ expression }))
}

/**
 * What a destructured name is read from, when that is a member of a value
 * written out: `const { default: Image } = require('next/image')`, `= images`
 * for a variable that holds the module, or each element of the array a
 * `for (const { default: Image } of [...])` walks.
 */
function destructuredFrom(element: ts.BindingElement): GivenValue[] {
  if (!ts.isObjectBindingPattern(element.parent) || element.dotDotDotToken) return []
  const key = element.propertyName ?? element.name
  const member = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : undefined
  const declaration = element.parent.parent
  if (member === undefined || !ts.isVariableDeclaration(declaration)) return []
  const statement = declaration.parent.parent
  const objects = ts.isForOfStatement(statement)
    ? elementsOf(statement.expression)
    : declaration.initializer
      ? [{ expression: declaration.initializer }]
      : []
  return objects.map(({ expression }) => ({ expression, member }))
}

/**
 * Every value a variable is given: its initializer, or for a destructured name
 * its default and the member it is read from, each element of the array a
 * `for...of` declaring it walks, and every value assigned to it afterwards.
 * A parameter is given only its default: the props a component receives are
 * not known here.
 */
function givenValues(module: string, symbol: ts.Symbol): GivenValue[] {
  const values: GivenValue[] = []
  for (const declaration of symbol.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration)) {
      const statement = declaration.parent.parent
      if (ts.isForOfStatement(statement)) values.push(...elementsOf(statement.expression))
      else if (declaration.initializer) values.push({ expression: declaration.initializer })
    }
    if (ts.isBindingElement(declaration)) {
      if (declaration.initializer) values.push({ expression: declaration.initializer })
      values.push(...destructuredFrom(declaration))
    }
    if (ts.isParameter(declaration) && declaration.initializer) values.push({ expression: declaration.initializer })
  }
  return [...values, ...(assignmentsIn(module).get(symbol) ?? [])]
}

/** Whether a declaration is one of a variable, rather than an import, a function or a class. */
function declaresVariable(declaration: ts.Declaration): boolean {
  return ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration) || ts.isParameter(declaration)
}

function passThrough(file: string, component: string): string[] | undefined {
  return PASS_THROUGH.find(entry => join(REPO_ROOT, entry.file) === file && entry.component === component)?.attributes
}

/**
 * What a component does with a URL attribute: hands it to the browser or an
 * optimizer as given (`loads`), or puts the base path on it itself (`prefixes`).
 */
type Handling = 'loads' | 'prefixes'

const PACKAGE_COMPONENTS: Record<Handling, Record<string, string[]>> = { loads: LOADERS, prefixes: PREFIXERS }

/** The attributes a component of ours handles that way by what it is, rather than by what it renders. */
function ownAttributes(handling: Handling, module: string, name: string): string[] | undefined {
  return handling === 'loads' ? passThrough(module, name) : undefined
}

/** The URL attributes an export handles that way, following re-exports; undefined when it handles none. */
function exportAttributes(handling: Handling, module: string, exportName: string, seen = new Set<string>()): string[] | undefined {
  const id = `${module}#${exportName}`
  if (seen.has(id)) return undefined
  seen.add(id)
  if (PACKAGE_COMPONENTS[handling][id]) return PACKAGE_COMPONENTS[handling][id]
  if (!module.startsWith('/') || !existsSync(module)) return undefined

  const info = moduleInfo(module)
  const exported = info.exports.get(exportName)
  if (exported && 'local' in exported) return localAttributes(handling, module, exported.local, seen) ?? ownAttributes(handling, module, exportName)
  if (exported) return exportAttributes(handling, moduleKey(exported.specifier, module), exported.name, seen)
  for (const specifier of info.starExports) {
    const attributes = exportAttributes(handling, moduleKey(specifier, module), exportName, seen)
    if (attributes) return attributes
  }
  return undefined
}

/**
 * The URL attributes a name at the top of a module handles that way: an import
 * of a component that does, a variable that stands for one, or a component of
 * ours defined there.
 */
function localAttributes(handling: Handling, module: string, name: string, seen = new Set<string>()): string[] | undefined {
  const info = moduleInfo(module)
  const binding = info.imports.get(name)
  if (binding && binding.name !== '*') return exportAttributes(handling, moduleKey(binding.specifier, module), binding.name, seen)
  const declared = info.declared.get(name)
  if (declared) return identifierAttributes(handling, module, declared, seen)
  return ownAttributes(handling, module, name)
}

/**
 * The URL attributes what an identifier names handles that way. The checker
 * says which declaration it refers to: an import is followed to the module it
 * comes from, and a variable counts as every value it is given. A variable
 * given no value that says, such as a prop, is not taken for an import or a
 * component of the same name.
 */
function identifierAttributes(handling: Handling, module: string, identifier: ts.Identifier, seen = new Set<string>()): string[] | undefined {
  const info = moduleInfo(module)
  const symbol = checkerFor(module).getSymbolAtLocation(identifier)
  const declarations = symbol?.declarations ?? []
  const atTop = declarations.some(declaration => (declaration as ts.NamedDeclaration).name === info.declared.get(identifier.text))

  const variable = declarations.find(declaresVariable)
  if (symbol && variable) {
    const id = `${module}#variable:${variable.getStart()}`
    if (seen.has(id)) return undefined
    seen.add(id)
    const given = merged(...givenValues(module, symbol).map(value => valueAttributes(handling, module, value, seen)))
    return given ?? (atTop ? ownAttributes(handling, module, identifier.text) : undefined)
  }

  if (declarations.length === 0 || declarations.some(isImport)) {
    const binding = info.imports.get(identifier.text)
    if (binding && binding.name !== '*') return exportAttributes(handling, moduleKey(binding.specifier, module), binding.name, seen)
    return undefined
  }
  return atTop ? ownAttributes(handling, module, identifier.text) : undefined
}

function isImport(declaration: ts.Declaration): boolean {
  return (
    ts.isImportClause(declaration) ||
    ts.isImportSpecifier(declaration) ||
    ts.isNamespaceImport(declaration) ||
    ts.isImportEqualsDeclaration(declaration)
  )
}

function valueAttributes(handling: Handling, module: string, value: GivenValue, seen: Set<string>): string[] | undefined {
  if (value.member === undefined) return expressionAttributes(handling, module, value.expression, seen)
  const specifier = wholeModule(module, value.expression, seen)
  return specifier ? exportAttributes(handling, moduleKey(specifier, module), value.member, seen) : undefined
}

/**
 * The module an expression stands for as a whole: `require('m')`, a namespace
 * import, or a variable given one of those.
 */
function wholeModule(module: string, node: ts.Expression, seen: Set<string>): string | undefined {
  node = unwrapped(node)
  const required = requiredModule(node)
  if (required) return required.name === '*' ? required.specifier : undefined
  if (!ts.isIdentifier(node)) return undefined

  const symbol = checkerFor(module).getSymbolAtLocation(node)
  const variable = symbol?.declarations?.find(declaresVariable)
  if (symbol && variable) {
    const id = `${module}#module:${variable.getStart()}`
    if (seen.has(id)) return undefined
    seen.add(id)
    for (const value of givenValues(module, symbol)) {
      const specifier = value.member === undefined ? wholeModule(module, value.expression, seen) : undefined
      if (specifier) return specifier
    }
    return undefined
  }
  const binding = moduleInfo(module).imports.get(node.text)
  return binding?.name === '*' ? binding.specifier : undefined
}

/** Every attribute any of the lists names, or undefined when none names one. */
function merged(...lists: (string[] | undefined)[]): string[] | undefined {
  const attributes = [...new Set(lists.flatMap(list => list ?? []))]
  return attributes.length > 0 ? attributes : undefined
}

/**
 * The URL attributes what an expression that stands for a tag handles that
 * way. A tag chosen at run time counts as each tag it can be:
 * `asChild ? Slot : 'a'` and `as ?? 'img'` load what an `<a>` and an `<img>`
 * load. A Slot loads nothing itself; the child it hands the props to is
 * checked where it is written.
 */
function expressionAttributes(handling: Handling, module: string, node: ts.Expression, seen = new Set<string>()): string[] | undefined {
  node = unwrapped(node)
  if (ts.isConditionalExpression(node)) {
    return merged(expressionAttributes(handling, module, node.whenTrue, seen), expressionAttributes(handling, module, node.whenFalse, seen))
  }
  if (
    ts.isBinaryExpression(node) &&
    [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)
  ) {
    return merged(expressionAttributes(handling, module, node.left, seen), expressionAttributes(handling, module, node.right, seen))
  }
  if (isStringLiteral(node)) return handling === 'loads' ? ASSET_ATTRIBUTES[node.text] : undefined
  const member = memberName(node)
  if (member !== undefined) {
    const specifier = wholeModule(module, (node as ts.PropertyAccessExpression | ts.ElementAccessExpression).expression, seen)
    return specifier ? exportAttributes(handling, moduleKey(specifier, module), member, seen) : undefined
  }
  if (ts.isIdentifier(node)) return identifierAttributes(handling, module, node, seen)
  return undefined
}

/** The URL attributes the element a tag names handles that way. */
function tagAttributes(handling: Handling, module: string, tag: ts.JsxTagNameExpression): string[] | undefined {
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return handling === 'loads' ? ASSET_ATTRIBUTES[tag.text] : undefined
  if (ts.isIdentifier(tag) || ts.isPropertyAccessExpression(tag)) return expressionAttributes(handling, module, tag)
  return undefined
}

/** The name of the component or function a node is written in. */
function enclosingDeclarationName(node: ts.Node): string | undefined {
  for (let current = node.parent; current; current = current.parent) {
    if ((ts.isVariableDeclaration(current) || ts.isFunctionDeclaration(current)) && current.name && ts.isIdentifier(current.name)) {
      return current.name.text
    }
  }
  return undefined
}

/** Operands of a chain of `+`, left to right. */
function concatenated(node: ts.Expression): ts.Expression[] {
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    return [...concatenated(node.left), ...concatenated(node.right)]
  }
  return [node]
}

function offendersIn(file: string): string[] {
  const module = realpathSync(file)
  const relativePath = relative(REPO_ROOT, module)
  const { source } = moduleInfo(module)
  const pathVariables = new Map<string, string>()
  const found: string[] = []

  // packages/core/templates/app holds the copy sync writes from apps/dev/app, so an exception
  // named on the file under apps/dev/app covers that copy as well.
  const isAllowedFile = (allowedFile: string) =>
    allowedFile === relativePath ||
    allowedFile.replace(/^apps\/dev\/app\//, 'packages/core/templates/app/') === relativePath

  const report = (node: ts.Node, kind: string, text: string) => {
    const shown = text.replace(/\s+/g, ' ').slice(0, 90)
    if (ALLOWED.some(allowed => isAllowedFile(allowed.file) && node.getText(source).includes(allowed.text))) return
    const { line } = source.getLineAndCharacterOfPosition(node.getStart(source))
    found.push(`${relativePath}:${line + 1}  ${kind}  ${shown}`)
  }

  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && writtenPath(node.initializer)?.startsWith('/')) {
      pathVariables.set(node.name.text, node.initializer!.getText(source))
    }

    if (CALLS.has(calledName(node))) {
      const argument = (node as ts.CallExpression | ts.NewExpression).arguments?.[0]
      if (argument && !isWrapped(argument) && !isElsewhere(argument)) {
        if (writtenPath(argument)?.startsWith('/')) report(node, calledName(node), argument.getText(source))
        else if (ts.isIdentifier(argument) && pathVariables.has(argument.text)) {
          report(node, `${calledName(node)} via variable`, `${argument.text} = ${pathVariables.get(argument.text)}`)
        } else if (!writtenPath(argument) && calledName(node) === 'open') {
          // window.open(url) with a URL that is data: nothing prefixes it
          report(node, 'open', argument.getText(source))
        }
      }
    }

    if (HISTORY_CALLS.has(calledName(node)) && ts.isCallExpression(node)) {
      const argument = node.arguments[2]
      if (argument && !isWrapped(argument) && writtenPath(argument)?.startsWith('/')) {
        report(node, calledName(node), argument.getText(source))
      }
    }

    // <Link> Next.js prefixes; an <a>, an <img>, next/image's <Image> and the rest it does not
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const loaded = tagAttributes('loads', module, node.tagName) ?? []
      const prefixed = tagAttributes('prefixes', module, node.tagName) ?? []
      const attributes = node.attributes.properties

      // <Link href={withBasePath('/docs')}> goes to /base/base/docs
      for (const attribute of attributes) {
        if (!ts.isJsxAttribute(attribute) || !prefixed.includes(attribute.name.getText(source))) continue
        const value = attributeValue(attribute)
        const pathname =
          value && ts.isObjectLiteralExpression(value)
            ? value.properties.find(property => property.name?.getText(source) === 'pathname')
            : undefined
        const url = pathname && ts.isPropertyAssignment(pathname) ? pathname.initializer : value
        if (url && isWrapped(url)) report(attribute, `${tag} ${attribute.name.getText(source)} with the base path added twice`, url.getText(source))
      }

      for (const attribute of attributes) {
        if (!ts.isJsxAttribute(attribute) || !loaded.includes(attribute.name.getText(source))) continue
        const name = attribute.name.getText(source)
        const value = attributeValue(attribute)
        if (!value || isWrapped(value) || isElsewhere(value)) continue
        if (writtenPath(value)?.startsWith('/')) report(attribute, tag === 'a' ? 'anchor' : `${tag} ${name}`, value.getText(source))
        else if (!writtenPath(value)) report(attribute, `${tag} ${name} from data`, value.getText(source))
      }

      // Props handed over whole: a URL among them goes unseen
      const written = new Set(attributes.filter(ts.isJsxAttribute).map(attribute => attribute.name.getText(source)))
      const unseen = loaded.filter(name => !written.has(name))
      if (unseen.length > 0 && attributes.some(ts.isJsxSpreadAttribute)) {
        const component = enclosingDeclarationName(node)
        if (!(component && passThrough(module, component))) {
          report(node, `${tag} ${unseen.join(', ')} in spread props`, node.getText(source))
        }
      }
    }

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source)
      const value = attributeValue(node)

      // Markup handed over whole carries its own links and images
      if (name === 'dangerouslySetInnerHTML' && value) {
        const html = ts.isObjectLiteralExpression(value)
          ? value.properties.find(property => property.name?.getText(source) === '__html')
          : undefined
        const expression = html && ts.isPropertyAssignment(html) ? html.initializer : undefined
        if (expression && !callsOneOf(expression, HTML_HELPERS)) {
          report(node, 'embedded html', node.getText(source))
        }
      }
    }

    // url() in a style: a background built from an upload, or a path written into the CSS
    if (ts.isTemplateExpression(node)) {
      node.templateSpans.forEach((span, index) => {
        const before = index === 0 ? node.head.text : node.templateSpans[index - 1].literal.text
        if (CSS_URL_OPENING.test(before) && !isWrapped(span.expression)) {
          report(span.expression, 'css url() from data', `url(\${${span.expression.getText(source)}})`)
        }
      })
    }
    if (
      (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) || ts.isTemplateHead(node)) &&
      CSS_URL_WITH_PATH.test(node.text)
    ) {
      report(node, 'css url()', node.getText(source))
    }
    // ...or joined to it with +
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      !(ts.isBinaryExpression(node.parent) && node.parent.operatorToken.kind === ts.SyntaxKind.PlusToken)
    ) {
      const operands = concatenated(node)
      operands.forEach((operand, index) => {
        const before = operands[index - 1]
        if (before && isStringLiteral(before) && CSS_URL_OPENING.test(before.text) && !isStringLiteral(operand) && !isWrapped(operand)) {
          report(operand, 'css url() from data', `${before.getText(source)} + ${operand.getText(source)}`)
        }
      })
    }

    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
      const target = node.left.getText(source)
      if (/location\.(href|pathname)$/.test(target) && !isWrapped(node.right) && writtenPath(node.right)?.startsWith('/')) {
        report(node, 'location', `${target} = ${node.right.getText(source)}`)
      }
    }

    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

function scannedFiles(): string[] {
  return TREES.filter(tree => existsSync(join(REPO_ROOT, tree))).flatMap(tree => sourceFiles(join(REPO_ROOT, tree)))
}

/** The Next.js configs, whose headers name endpoints the scan above never reads. */
const CONFIGS = ['apps/dev/next.config.mjs', 'packages/core/templates/next.config.mjs']

describe('in-app URLs carry the base path', () => {
  test('no fetch, URL, EventSource, WebSocket or location assignment takes a bare in-app path', () => {
    expect(scannedFiles().flatMap(offendersIn)).toEqual([])
  })

  test('the scan reads the trees that ship in-app URLs', () => {
    const files = scannedFiles()
    expect(files.length).toBeGreaterThan(500)
    expect(files.some(file => readFileSync(file, 'utf8').includes('withBasePath'))).toBe(true)
    expect(files).toContain(join(REPO_ROOT, 'packages/ui/src/components/Avatar.tsx'))
  })

  test('the scan sees the shapes a line-by-line read misses', () => {
    const offenders = offendersIn(join(REPO_ROOT, 'packages/core/tests/jest/lib/__fixtures__/bare-in-app-urls.tsx'))

    expect(offenders.map(offender => offender.replace(/^.*__fixtures__\//, ''))).toEqual([
      'bare-in-app-urls.tsx:16  fetch via variable  path = `/api/v1/${slug}`',
      'bare-in-app-urls.tsx:20  fetch  \'/api/v1/teams\'',
      'bare-in-app-urls.tsx:26  location  window.location.href = \'/dashboard\'',
      'bare-in-app-urls.tsx:37  pushState  `/dashboard/boards/${id}`',
      'bare-in-app-urls.tsx:38  open  \'/dashboard/reports\'',
      'bare-in-app-urls.tsx:44  anchor  "/pricing"',
      'bare-in-app-urls.tsx:46  a href from data  href',
      'bare-in-app-urls.tsx:59  img src from data  thumbnail',
      'bare-in-app-urls.tsx:61  img src  "/theme/blocks/hero/thumbnail.png"',
      'bare-in-app-urls.tsx:62  a href from data  url',
      'bare-in-app-urls.tsx:64  iframe src from data  url',
      'bare-in-app-urls.tsx:72  embedded html  dangerouslySetInnerHTML={{ __html: body }}',
      'bare-in-app-urls.tsx:79  open  url',
      // next/image's component, under the name it was imported as; lucide's Image icon is not it
      'bare-in-app-urls.tsx:85  NextImage src from data  cover',
      'bare-in-app-urls.tsx:87  NextImage src  "/brand/logo.png"',
      'bare-in-app-urls.tsx:88  NextImage src in spread props  <NextImage {...rest} />',
      'bare-in-app-urls.tsx:97  css url() from data  url(${upload})',
      'bare-in-app-urls.tsx:99  css url()  \'url(/theme/hero.jpg)\'',
      'bare-in-app-urls.tsx:100  css url() from data  url(${upload})',
      // ...as `{ default as X }`, through require(), and through a module that re-exports it
      'bare-in-app-urls.tsx:109  Picture src from data  cover',
      'bare-in-app-urls.tsx:110  RequiredImage src from data  cover',
      'bare-in-app-urls.tsx:111  ReexportedImage src from data  cover',
      // Radix's image and the shared AvatarImage that passes src on to it, however they are reached;
      // core's AvatarImage, which puts the base path on, is not reported
      'bare-in-app-urls.tsx:119  AvatarPrimitive.Image src from data  avatar',
      'bare-in-app-urls.tsx:120  SharedAvatarImage src from data  avatar',
      'bare-in-app-urls.tsx:121  ReexportedAvatarImage src from data  avatar',
      // a URL attribute that is not written out may be inside the spread
      'bare-in-app-urls.tsx:132  img src, srcSet in spread props  <img {...props} />',
      'bare-in-app-urls.tsx:133  img srcSet in spread props  <img src={withBasePathIfInApp(cover)} alt="" {...props} />',
      'bare-in-app-urls.tsx:134  img srcSet from data  cover',
      // url( joined to a value with +
      'bare-in-app-urls.tsx:142  css url() from data  \'url(\' + upload',
      'bare-in-app-urls.tsx:143  css url() from data  "linear-gradient(red, blue), url(\'" + upload',
      // a module-level constant that stands for a loader, exported or not
      'bare-in-app-urls.tsx:155  AliasedImage src from data  cover',
      'bare-in-app-urls.tsx:156  AliasedAvatarImage src from data  cover',
      'bare-in-app-urls.tsx:157  LocalImage src from data  cover',
      // require() with any member of the module, at the top of the file or inside a component
      'bare-in-app-urls.tsx:170  RequiredAvatarImage src from data  avatar',
      'bare-in-app-urls.tsx:171  RequiredByKey src from data  avatar',
      // a tag chosen inside the component is each tag it can be; a Slot loads nothing itself,
      // a <button> carries no URL, and a prop that shadows an import is not what the import is
      'bare-in-app-urls.tsx:178  Comp href in spread props  <Comp {...props} />',
      'bare-in-app-urls.tsx:185  Tag src from data  cover',
      'bare-in-app-urls.tsx:185  Tag srcSet in spread props  <Tag src={cover} {...props} />',
      'bare-in-app-urls.tsx:186  Picture src from data  cover',
      'bare-in-app-urls.tsx:196  Tag href from data  href',
      'bare-in-app-urls.tsx:197  LocalRequired src from data  href',
      // ...including a value assigned to it after it is declared
      'bare-in-app-urls.tsx:214  Comp href  "/pricing"',
      // ...with ||= and ??=
      'bare-in-app-urls.tsx:224  Comp href  "/pricing"',
      'bare-in-app-urls.tsx:225  Other href  "/pricing"',
      // ...declared by a for...of over an array written out, destructured from its elements, or in a for loop's initializer
      'bare-in-app-urls.tsx:232  Media src from data  cover',
      'bare-in-app-urls.tsx:233  LoopImage src from data  cover',
      'bare-in-app-urls.tsx:235  Tag href  "/pricing"',
      // require() destructured inside the component, and a variable that holds the module
      'bare-in-app-urls.tsx:246  DestructuredImage src from data  cover',
      'bare-in-app-urls.tsx:247  AliasedDefault src from data  cover',
      'bare-in-app-urls.tsx:248  FromAlias src from data  cover',
      'bare-in-app-urls.tsx:249  images.default src from data  cover',
      // an assignment counts for the variable it assigns to: one in a closure does, one to a variable
      // of the same name declared in a nested function does not
      'bare-in-app-urls.tsx:269  Chosen href  "/pricing"',
      // <Link> puts the base path on by itself
      'bare-in-app-urls.tsx:279  Link href with the base path added twice  withBasePathIfInApp(\'/docs\')',
      'bare-in-app-urls.tsx:280  Link href with the base path added twice  withBasePath(\'/docs\')',
    ])
  })

  test('every endpoint the security headers name is written under the base path', () => {
    const offenders: string[] = []
    for (const config of CONFIGS) {
      const source = readFileSync(join(REPO_ROOT, config), 'utf8').replace(/\/\/[^\n]*/g, ' ')
      expect(source).toMatch(/const basePath = /)

      // Only the header and CSP lists: a rewrite's source and destination are
      // routes, which Next.js resolves under the base path by itself.
      for (const list of ['cspDirectives', 'securityHeaders']) {
        const block = source.match(new RegExp(`const ${list} = \\[([\\s\\S]*?)\\n {4}\\];`))
        expect(block).not.toBeNull()
        for (const [match, , path] of block![1].matchAll(/(['"\`])((?:(?!\1).)*?\/[\w/-]+)(?:(?!\1).)*\1/g)) {
          if (!path.includes('${basePath}')) offenders.push(`${config}  ${list}  ${match}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})
