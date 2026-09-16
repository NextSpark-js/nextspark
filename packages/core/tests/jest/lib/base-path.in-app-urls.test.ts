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
 * A component is recognised by where it comes from, not by its name. One lazy
 * TypeScript program covers every source and fixture, reusing its SourceFiles
 * for the walk. Its host follows apps/dev's paths and loads package declarations
 * only for the loader and prefixer entry modules; imports below node_modules do
 * not resolve further. The checker follows each immediate alias through imports,
 * re-exports and namespace members until its declaration reaches that package
 * boundary. A member without a checker symbol falls back to CommonJS only when
 * `require` has no declaration in the sources under review. So core's
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
 *  - each value assigned to it with `=`, `||=`, `??=` or `&&=`, or by a
 *    `for...of` over an array written out; an assignment later in the same
 *    innermost function is excluded unless an iteration statement contains both
 *    it and the use
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
const FIXTURES_DIR = join(REPO_ROOT, 'packages/core/tests/jest/lib/__fixtures__')

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

function packagePath(file: string): string | undefined {
  const marker = '/node_modules/'
  const at = file.lastIndexOf(marker)
  return at === -1 ? undefined : file.slice(at + marker.length)
}

/** The package-relative declaration files of the loader and prefixer entry modules. */
const COMPONENT_MODULES = new Set(
  Object.keys({ ...LOADERS, ...PREFIXERS }).map(key => key.slice(0, key.lastIndexOf('#')))
)
function resolveComponentModule(specifier: string): ts.ResolvedModuleFull | undefined {
  const fromApp = ts.resolveModuleName(specifier, join(REPO_ROOT, 'apps/dev/index.ts'), COMPILER_OPTIONS, ts.sys, RESOLUTION_CACHE).resolvedModule
  return fromApp ?? ts.resolveModuleName(specifier, join(FIXTURES_DIR, 'bare-in-app-urls.tsx'), COMPILER_OPTIONS, ts.sys, RESOLUTION_CACHE).resolvedModule
}

const RESOLVED_COMPONENT_MODULES = new Set(
  [...COMPONENT_MODULES].flatMap(specifier => {
    const file = resolveComponentModule(specifier)?.resolvedFileName
    return file ? [packagePath(file)] : []
  })
)

interface ProgramState {
  program: ts.Program
  checker: ts.TypeChecker
}

let PROGRAM: ProgramState | undefined

/**
 * One program covers the sources under review and the fixtures. It only loads
 * declaration files for the package entry points that identify known components;
 * declarations below node_modules do not resolve further imports.
 */
function programState(): ProgramState {
  if (PROGRAM) return PROGRAM
  const roots = [...new Set([...scannedFiles(), ...sourceFiles(FIXTURES_DIR)])]
  const options: ts.CompilerOptions = { ...COMPILER_OPTIONS, noLib: true, types: [], noEmit: true }
  const host = ts.createCompilerHost(options)
  host.resolveModuleNameLiterals = (literals, containingFile, redirectedReference, compilerOptions) =>
    literals.map(literal => {
      if (packagePath(containingFile)) return { resolvedModule: undefined }
      const resolved = ts.resolveModuleName(
        literal.text,
        containingFile,
        compilerOptions,
        host,
        RESOLUTION_CACHE,
        redirectedReference
      ).resolvedModule
      if (!resolved) return { resolvedModule: undefined }
      const relativePackagePath = packagePath(resolved.resolvedFileName)
      return !relativePackagePath || RESOLVED_COMPONENT_MODULES.has(relativePackagePath)
        ? { resolvedModule: resolved }
        : { resolvedModule: undefined }
    })
  const program = ts.createProgram(roots, options, host)
  PROGRAM = { program, checker: program.getTypeChecker() }
  return PROGRAM
}

function sourceFor(file: string): ts.SourceFile | undefined {
  return programState().program.getSourceFile(realpathSync(file))
}

/** A value a variable is given: an expression, or a member of one (`const { default: Image } = images`). */
type GivenValue = { expression: ts.Expression; member?: string; assignment?: ts.Node }

const ASSIGNMENTS = new Map<string, Map<ts.Symbol, GivenValue[]>>()
const ASSIGNMENT_OPERATORS = new Set([
  ts.SyntaxKind.EqualsToken,
  ts.SyntaxKind.BarBarEqualsToken,
  ts.SyntaxKind.QuestionQuestionEqualsToken,
  ts.SyntaxKind.AmpersandAmpersandEqualsToken,
])

/** The elements of an array written out, which a `for...of` over it takes in turn. */
function elementsOf(node: ts.Expression, assignment?: ts.Node): GivenValue[] {
  node = unwrapped(node)
  if (!ts.isArrayLiteralExpression(node)) return []
  return node.elements.filter(element => !ts.isSpreadElement(element)).map(expression => ({ expression, assignment }))
}

/** The innermost function (or source file) that contains a use or assignment. */
function valueScope(node: ts.Node): ts.Node {
  for (let current: ts.Node | undefined = node; current; current = current.parent) {
    if (ts.isFunctionLike(current) || ts.isSourceFile(current)) return current
  }
  return node.getSourceFile()
}

function contains(node: ts.Node, other: ts.Node): boolean {
  return node.getStart() <= other.getStart() && other.getEnd() <= node.getEnd()
}

/** An assignment after a use in a straight-line function body cannot choose that use's tag. */
function assignmentCountsForUse(assignment: ts.Node | undefined, use: ts.Node): boolean {
  if (!assignment || assignment.getStart() <= use.getStart()) return true
  const scope = valueScope(use)
  if (scope !== valueScope(assignment)) return true
  let crossesIteration = false
  const visit = (node: ts.Node) => {
    if (ts.isIterationStatement(node, false) && contains(node, assignment) && contains(node, use)) crossesIteration = true
    ts.forEachChild(node, visit)
  }
  visit(scope)
  return crossesIteration
}

/** Values assigned to each variable, distinguished by the program checker's symbol. */
function assignmentsIn(source: ts.SourceFile): Map<ts.Symbol, GivenValue[]> {
  const key = source.fileName
  const known = ASSIGNMENTS.get(key)
  if (known) return known
  const checker = programState().checker
  const assignments = new Map<ts.Symbol, GivenValue[]>()
  const add = (target: ts.Expression, values: GivenValue[]) => {
    const symbol = ts.isIdentifier(target) ? checker.getSymbolAtLocation(target) : undefined
    if (symbol) assignments.set(symbol, [...(assignments.get(symbol) ?? []), ...values])
  }
  const visit = (node: ts.Node) => {
    if (ts.isBinaryExpression(node) && ASSIGNMENT_OPERATORS.has(node.operatorToken.kind)) {
      add(node.left, [{ expression: node.right, assignment: node }])
    }
    if (ts.isForOfStatement(node) && !ts.isVariableDeclarationList(node.initializer)) {
      add(node.initializer, elementsOf(node.expression, node))
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  ASSIGNMENTS.set(key, assignments)
  return assignments
}

/** What a destructured name is read from, when that is a member of a value written out. */
function destructuredFrom(element: ts.BindingElement): GivenValue[] {
  if (!ts.isObjectBindingPattern(element.parent) || element.dotDotDotToken) return []
  const key = element.propertyName ?? element.name
  const member = ts.isIdentifier(key) || ts.isStringLiteral(key) ? key.text : undefined
  const declaration = element.parent.parent
  if (member === undefined || !ts.isVariableDeclaration(declaration)) return []
  const statement = declaration.parent.parent
  const objects = ts.isForOfStatement(statement)
    ? elementsOf(statement.expression, statement)
    : declaration.initializer
      ? [{ expression: declaration.initializer }]
      : []
  return objects.map(({ expression, assignment }) => ({ expression, member, assignment }))
}

/** Every value a variable is given that can affect this particular use. */
function givenValues(symbol: ts.Symbol, use: ts.Node): GivenValue[] {
  const values: GivenValue[] = []
  for (const declaration of symbol.declarations ?? []) {
    if (ts.isVariableDeclaration(declaration)) {
      const statement = declaration.parent.parent
      if (ts.isForOfStatement(statement)) values.push(...elementsOf(statement.expression, statement))
      else if (declaration.initializer) values.push({ expression: declaration.initializer })
    }
    if (ts.isBindingElement(declaration)) {
      if (declaration.initializer) values.push({ expression: declaration.initializer })
      values.push(...destructuredFrom(declaration))
    }
    if (ts.isParameter(declaration) && declaration.initializer) values.push({ expression: declaration.initializer })
  }
  const source = symbol.declarations?.[0]?.getSourceFile()
  const assigned = source ? assignmentsIn(source).get(symbol) ?? [] : []
  return [...values, ...assigned.filter(value => assignmentCountsForUse(value.assignment, use))]
}

/** Whether a declaration is one of a variable, rather than an import, a function or a class. */
function declaresVariable(declaration: ts.Declaration): boolean {
  return ts.isVariableDeclaration(declaration) || ts.isBindingElement(declaration) || ts.isParameter(declaration)
}

function passThrough(file: string, component: string): string[] | undefined {
  return PASS_THROUGH.find(entry => join(REPO_ROOT, entry.file) === file && entry.component === component)?.attributes
}

type Handling = 'loads' | 'prefixes'
function resolvedComponentAttributes(components: Record<string, string[]>): Record<string, string[]> {
  return Object.fromEntries(
    Object.entries(components).flatMap(([key, attributes]) => {
      const at = key.lastIndexOf('#')
      const resolved = resolveComponentModule(key.slice(0, at))
      const module = resolved && packagePath(resolved.resolvedFileName)
      return module ? [[`${module}${key.slice(at)}`, attributes]] : []
    })
  )
}
const PACKAGE_COMPONENTS: Record<Handling, Record<string, string[]>> = {
  loads: resolvedComponentAttributes(LOADERS),
  prefixes: resolvedComponentAttributes(PREFIXERS),
}

function ownAttributes(handling: Handling, source: ts.SourceFile, name: string): string[] | undefined {
  return handling === 'loads' ? passThrough(source.fileName, name) : undefined
}

function packageAttributes(handling: Handling, source: ts.SourceFile, name: string): string[] | undefined {
  const module = packagePath(source.fileName)
  return module ? PACKAGE_COMPONENTS[handling][`${module}#${name}`] : undefined
}

/** Every attribute any of the lists names, or undefined when none names one. */
function merged(...lists: (string[] | undefined)[]): string[] | undefined {
  const attributes = [...new Set(lists.flatMap(list => list ?? []))]
  return attributes.length > 0 ? attributes : undefined
}

function symbolAttributes(handling: Handling, symbol: ts.Symbol | undefined, use: ts.Node, seen = new Set<string>()): string[] | undefined {
  const checker = programState().checker
  while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    const declaration = symbol.declarations?.[0]
    const source = declaration?.getSourceFile()
    if (source && packagePath(source.fileName)) return packageAttributes(handling, source, symbol.name)
    const alias = checker.getImmediateAliasedSymbol(symbol)
    if (!alias || alias === symbol) return undefined
    symbol = alias
  }
  if (!symbol?.declarations?.length) return undefined
  const declaration = symbol.declarations[0]
  const source = declaration.getSourceFile()
  const fromPackage = packageAttributes(handling, source, symbol.name)
  if (fromPackage) return fromPackage
  if (packagePath(source.fileName)) return undefined

  const variable = symbol.declarations.find(declaresVariable)
  if (variable) {
    const id = `${source.fileName}#variable:${variable.getStart()}`
    if (seen.has(id)) return undefined
    seen.add(id)
    const given = merged(...givenValues(symbol, use).map(value => valueAttributes(handling, value, use, seen)))
    const atTopLevel = !symbol.declarations.some(declaration => {
      for (let current = declaration.parent; current && !ts.isSourceFile(current); current = current.parent) {
        if (ts.isFunctionLike(current)) return true
      }
      return false
    })
    return given ?? (atTopLevel ? ownAttributes(handling, source, symbol.name) : undefined)
  }

  const exportedValue = symbol.declarations.find(ts.isExportAssignment)
  if (exportedValue && ts.isExportAssignment(exportedValue)) {
    return expressionAttributes(handling, unwrapped(exportedValue.expression), use, seen)
  }
  return ownAttributes(handling, source, symbol.name)
}

/** A require() is CommonJS only when it is not a function declared in our sources. */
function isCommonJsRequire(call: ts.CallExpression): boolean {
  if (!ts.isIdentifier(call.expression) || call.expression.text !== 'require') return false
  const declarations = programState().checker.getSymbolAtLocation(call.expression)?.declarations ?? []
  return !declarations.some(declaration => !packagePath(declaration.getSourceFile().fileName))
}

/** The file or package entry a CommonJS expression denotes. */
function requiredModule(node: ts.Expression | undefined): { source?: ts.SourceFile; package?: string } | undefined {
  if (!node) return undefined
  node = unwrapped(node)
  if (
    ts.isCallExpression(node) &&
    isCommonJsRequire(node) &&
    node.arguments.length === 1 &&
    ts.isStringLiteral(node.arguments[0])
  ) {
    const resolved = ts.resolveModuleName(node.arguments[0].text, node.getSourceFile().fileName, COMPILER_OPTIONS, ts.sys, RESOLUTION_CACHE).resolvedModule
    if (!resolved) return undefined
    const packageFile = packagePath(resolved.resolvedFileName)
    return packageFile ? { package: packageFile } : { source: sourceFor(resolved.resolvedFileName) }
  }
  return undefined
}

function moduleMemberAttributes(
  handling: Handling,
  module: { source?: ts.SourceFile; package?: string },
  member: string,
  use: ts.Node,
  seen: Set<string>
): string[] | undefined {
  if (module.package) return PACKAGE_COMPONENTS[handling][`${module.package}#${member}`]
  if (!module.source) return undefined
  const checker = programState().checker
  const moduleSymbol = checker.getSymbolAtLocation(module.source)
  return symbolAttributes(handling, moduleSymbol && checker.tryGetMemberInModuleExports(member, moduleSymbol), use, seen)
}

function valueAttributes(handling: Handling, value: GivenValue, use: ts.Node, seen: Set<string>): string[] | undefined {
  if (value.member === undefined) return expressionAttributes(handling, value.expression, use, seen)
  const module = wholeModule(value.expression, use, seen)
  return module ? moduleMemberAttributes(handling, module, value.member, use, seen) : undefined
}

/**
 * The module an expression stands for as a whole: `require('m')`, a name the
 * checker resolves to a module (a namespace import or export, `import m =
 * require('m')`), or a variable given one of those.
 */
function wholeModule(
  node: ts.Expression,
  use: ts.Node,
  seen: Set<string>
): { source?: ts.SourceFile; package?: string } | undefined {
  node = unwrapped(node)
  const required = requiredModule(node)
  if (required) return required
  if (!ts.isIdentifier(node)) return undefined
  const checker = programState().checker
  let symbol = checker.getSymbolAtLocation(node)
  while (symbol && symbol.flags & ts.SymbolFlags.Alias) {
    const alias = checker.getImmediateAliasedSymbol(symbol)
    if (!alias || alias === symbol) return undefined
    symbol = alias
  }
  const variable = symbol?.declarations?.find(declaresVariable)
  if (symbol && variable) {
    const id = `${variable.getSourceFile().fileName}#module:${variable.getStart()}`
    if (seen.has(id)) return undefined
    seen.add(id)
    for (const value of givenValues(symbol, use)) {
      if (value.member === undefined) {
        const module = wholeModule(value.expression, use, seen)
        if (module) return module
      }
    }
    return undefined
  }
  const source = symbol?.declarations?.find(ts.isSourceFile)
  if (!source) return undefined
  const packageFile = packagePath(source.fileName)
  return packageFile ? { package: packageFile } : { source }
}

/** The URL attributes what an expression that stands for a tag handles that way. */
function expressionAttributes(handling: Handling, node: ts.Expression, use: ts.Node = node, seen = new Set<string>()): string[] | undefined {
  node = unwrapped(node)
  if (ts.isConditionalExpression(node)) {
    return merged(expressionAttributes(handling, node.whenTrue, use, seen), expressionAttributes(handling, node.whenFalse, use, seen))
  }
  if (ts.isBinaryExpression(node) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(node.operatorToken.kind)) {
    return merged(expressionAttributes(handling, node.left, use, seen), expressionAttributes(handling, node.right, use, seen))
  }
  if (isStringLiteral(node)) return handling === 'loads' ? ASSET_ATTRIBUTES[node.text] : undefined
  const member = memberName(node)
  if (member !== undefined) {
    const memberNode = ts.isPropertyAccessExpression(node) ? node.name : node.argumentExpression
    const direct = memberNode && programState().checker.getSymbolAtLocation(memberNode)
    const resolved = symbolAttributes(handling, direct, use, seen)
    if (resolved) return resolved
    const module = wholeModule((node as ts.PropertyAccessExpression | ts.ElementAccessExpression).expression, use, seen)
    return module ? moduleMemberAttributes(handling, module, member, use, seen) : undefined
  }
  if (ts.isIdentifier(node)) return symbolAttributes(handling, programState().checker.getSymbolAtLocation(node), use, seen)
  return undefined
}

/** The URL attributes the element a tag names handles that way. */
function tagAttributes(handling: Handling, tag: ts.JsxTagNameExpression): string[] | undefined {
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return handling === 'loads' ? ASSET_ATTRIBUTES[tag.text] : undefined
  if (ts.isIdentifier(tag) || ts.isPropertyAccessExpression(tag)) return expressionAttributes(handling, tag, tag)
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
  const source = sourceFor(module)
  if (!source) throw new Error(`Program did not include ${module}`)
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
      const loaded = tagAttributes('loads', node.tagName) ?? []
      const prefixed = tagAttributes('prefixes', node.tagName) ?? []
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
      // checker aliases across default exports, namespace exports, namespace imports and re-export chains
      'bare-in-app-urls.tsx:296  DefaultReexportedImage src from data  cover',
      'bare-in-app-urls.tsx:297  ImageNamespace.default src from data  cover',
      'bare-in-app-urls.tsx:298  NS.default src from data  cover',
      'bare-in-app-urls.tsx:299  Loaders.ReexportedImage src from data  cover',
      'bare-in-app-urls.tsx:300  TwiceReexportedImage src from data  cover',
      'bare-in-app-urls.tsx:301  X.default src from data  cover',
    ])
  })

  test('a locally declared require is not CommonJS', () => {
    expect(offendersIn(join(FIXTURES_DIR, 'local-require.tsx'))).toEqual([])
  })

  test('a member of a value that is not a module is not read from the exports of the file it is declared in', () => {
    expect(offendersIn(join(FIXTURES_DIR, 'object-members.tsx'))).toEqual([])
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
