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
 * An element is recognised by the type TypeScript's checker gives its tag where
 * the tag is written, narrowed there as the checker narrows it. One lazy
 * program covers every source and fixture, and its SourceFiles are the ones
 * walked. Its host follows apps/dev's paths and lib; from a source it loads the
 * declarations of React, of the LOADERS and PREFIXERS entry modules and of
 * Radix, and of no other package. Each member of the tag's type counts:
 *  - a tag name, as that element (`'img' | 'video'` is both), unless the type
 *    admits every element name, as `ElementType` does, which says nothing of
 *    which one it is
 *  - a component, as one of LOADERS, PREFIXERS or PASS_THROUGH when it has that
 *    component's type, or takes that component's very props type: `memo(Image)`
 *    is a NamedExoticComponent of next/image's props
 * So a name is what the checker resolves it to, through imports, re-exports,
 * namespace members, `satisfies` and shadowing: core's AvatarImage, which puts
 * the base path on, is told apart from the shared one it wraps, and lucide's
 * Image icon from next/image's. A call is what its return type says:
 * `identity(Image)`, `useMemo(() => Image)` and `lazy(() => import('next/image'))`
 * are next/image, `second(Image, Sink)` is Sink. A variable, a member of an
 * object or a class field is what its type still admits where the tag reads it:
 * `let C: typeof Image | 'span' = Image; C = 'span'` reads as a span, and a
 * branch that leaves Image in keeps it in.
 *
 * A module's `require('m')` is typed as what it loads, `typeof import('m')`, as
 * TypeScript types it in a JavaScript file, unless the module declares a
 * `require` of its own. The declarations go after the module's text, so every
 * position and line in it is the one written.
 *
 * What the types do not tell, and so the scan does not report:
 *  - a component whose type is `any`: one from a package the program does not
 *    load (next/dynamic's, lucide's icons), or a require() of a specifier not
 *    written out. A union with such a member is `any` as a whole, so a tag
 *    chosen between one of those and next/image or an <a> is lost
 *  - a component typed as components in general, `ComponentType` or
 *    `ElementType`, and whatever holds or returns one: `Image as
 *    ComponentType<Props>` is no longer next/image, and `let C: ElementType =
 *    Image` reads as `FunctionComponent<any>`
 *  - an assignment a closure makes, where the closure is called: TypeScript
 *    narrows by the function that reads, so `let C: typeof Image | typeof Sink =
 *    Image; swap(); <C>` reads as next/image after swap() sets Sink, and as Sink
 *    after one that sets Image. A read inside a closure made before the
 *    variable's last assignment is the declared type
 *  - an assignment to a variable whose declared type is not a union, which
 *    TypeScript does not narrow by: `let C = Image` stays next/image
 * And one thing the types tell wrongly: a component with the very type or props
 * type of a known one counts as it, so `memo((props: ComponentProps<typeof
 * Image>) => …)` is reported as next/image even when it puts the base path on.
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
 * component (`<Box as="a" href="/pricing" />` reads as a Box), a wrapper that
 * renders the component inside it (`forwardRef((props, ref) => <Image {...props} />)`,
 * where the `<Image>` inside is what gets checked), elements built with
 * createElement or cloneElement, a URL assigned to a DOM property
 * (`image.src = …`), a `url(` held in a variable before the value is joined to
 * it, and `redirect()` or `router.push()` given a URL with the base path on. In
 * these trees, createElement renders an icon, or a component looked up by name,
 * with the props it was given, and the URLs assigned to DOM properties are
 * object URLs of a file being uploaded or exported.
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
  'apps/dev/src/app',
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

/** Every attribute a tag the scan knows takes a URL in. */
const URL_ATTRIBUTES = new Set(
  [...Object.values(ASSET_ATTRIBUTES), ...Object.values(LOADERS), ...Object.values(PREFIXERS), ...PASS_THROUGH.map(entry => entry.attributes)].flat()
)

/** The text before a `url(` whose argument is the value that follows it. */
const CSS_URL_OPENING = /url\(\s*['"]?$/i

/** A `url()` whose argument is written out as an in-app path. */
const CSS_URL_WITH_PATH = /url\(\s*['"]?\/(?!\/)/i

/** Helpers that put the base path on a URL, or on every URL inside markup. */
const HELPERS = new Set(['withBasePath', 'withBasePathIfInApp', 'withBasePathInHtml', 'withBasePathInSrcset'])

/** Helpers that hand back markup with its in-app URLs already prefixed. */
const HTML_HELPERS = new Set(['sanitizeBlockHtml', 'sanitizePostHtml', 'withBasePathInHtml'])

/** A URL of its own, not one this app serves. */
const ALLOWED = [
  {
    file: 'packages/core/src/lib/mcp/executor.ts',
    text: 'INTERNAL_ORIGIN',
    why: 'a request handed straight to a route handler, which is given its URL without the base path',
  },
  {
    file: 'apps/dev/src/app/layout.tsx',
    text: 'domain',
    why: 'preconnect and dns-prefetch name the billing provider’s origin, not a path this app serves',
  },
  {
    file: 'apps/dev/src/app/layout.ppr.tsx',
    text: 'domain',
    why: 'preconnect and dns-prefetch name the billing provider’s origin, not a path this app serves',
  },
  {
    file: 'apps/dev/blocks/video-hero/component.tsx',
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
    file: 'packages/core/templates/projects/blog/components/editor/WysiwygEditor.tsx',
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

/** The package entry modules the program loads declarations from: React's, and those of the loaders and prefixers. */
const TYPED_ENTRY_MODULES = new Map(
  ['react', 'react/jsx-runtime', ...COMPONENT_MODULES].flatMap(specifier => {
    const file = resolveComponentModule(specifier)?.resolvedFileName
    return file ? [[packagePath(file), file] as const] : []
  })
)

/** A call of `require` with the specifier written out. */
function requiredSpecifier(node: ts.Node): string | undefined {
  if (!ts.isCallExpression(node) || !ts.isIdentifier(node.expression) || node.expression.text !== 'require') return undefined
  const [argument] = node.arguments
  return node.arguments.length === 1 && isStringLiteral(argument) ? argument.text : undefined
}

/** Whether a node declares a name `require`: a function, variable, parameter, class or import of that name. */
function declaresRequire(node: ts.Node): boolean {
  const name =
    ts.isFunctionDeclaration(node) ||
    ts.isVariableDeclaration(node) ||
    ts.isParameter(node) ||
    ts.isBindingElement(node) ||
    ts.isClassDeclaration(node) ||
    ts.isImportClause(node) ||
    ts.isImportSpecifier(node) ||
    ts.isNamespaceImport(node) ||
    ts.isImportEqualsDeclaration(node)
      ? node.name
      : undefined
  return name !== undefined && ts.isIdentifier(name) && name.text === 'require'
}

/**
 * A module's text with each `require('m')` it writes typed as what that loads,
 * `typeof import('m')`, the way TypeScript types it in a JavaScript file.
 * Undefined for a module that requires nothing that way, or declares a
 * `require` of its own.
 */
function withTypedRequire(source: ts.SourceFile): string | undefined {
  if (!ts.isExternalModule(source) || !/\brequire\s*\(/.test(source.text)) return undefined
  const specifiers = new Set<string>()
  let declared = false
  const visit = (node: ts.Node) => {
    const specifier = requiredSpecifier(node)
    if (specifier !== undefined) specifiers.add(specifier)
    declared ||= declaresRequire(node)
    ts.forEachChild(node, visit)
  }
  visit(source)
  if (declared || specifiers.size === 0) return undefined
  const overloads = [...specifiers].map(specifier => {
    const literal = JSON.stringify(specifier)
    return `declare function require(specifier: ${literal}): typeof import(${literal})`
  })
  // after the module's own text, so every position and line in it is the one written
  return `${source.text}\n${overloads.join('\n')}\ndeclare function require(specifier: string): any\n`
}

interface ProgramState {
  program: ts.Program
  checker: ts.TypeChecker
}

let PROGRAM: ProgramState | undefined

/**
 * Radix's packages, whose primitives a component here picks instead of a tag
 * (`asChild ? Slot : 'a'`). A union with a member the program has no type for
 * is `any` as a whole, and the tag in it is lost.
 */
const RADIX = '@radix-ui/'

/**
 * One program covers the sources under review, the fixtures and the entry
 * modules of the loaders and prefixers. From a source, it loads the
 * declarations of React, of those entry modules and of Radix, and of no other
 * package; from inside a package, imports resolve in full.
 */
function programState(): ProgramState {
  if (PROGRAM) return PROGRAM
  const roots = [...new Set([...scannedFiles(), ...sourceFiles(FIXTURES_DIR), ...TYPED_ENTRY_MODULES.values()])]
  const options: ts.CompilerOptions = { ...COMPILER_OPTIONS, types: [], noEmit: true }
  const host = ts.createCompilerHost(options)
  host.resolveModuleNameLiterals = (literals, containingFile, redirectedReference, compilerOptions) =>
    literals.map(literal => {
      const resolved = ts.resolveModuleName(
        literal.text,
        containingFile,
        compilerOptions,
        host,
        RESOLUTION_CACHE,
        redirectedReference
      ).resolvedModule
      const packageFile = resolved && packagePath(resolved.resolvedFileName)
      const loaded =
        !packageFile ||
        packagePath(containingFile) !== undefined ||
        TYPED_ENTRY_MODULES.has(packageFile) ||
        packageFile.startsWith(RADIX)
      return { resolvedModule: loaded ? resolved : undefined }
    })
  const getSourceFile = host.getSourceFile
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) => {
    const source = getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)
    const text = source && !packagePath(fileName) ? withTypedRequire(source) : undefined
    return text === undefined ? source : ts.createSourceFile(fileName, text, languageVersion)
  }
  const program = ts.createProgram(roots, options, host)
  PROGRAM = { program, checker: program.getTypeChecker() }
  return PROGRAM
}

function sourceFor(file: string): ts.SourceFile | undefined {
  return programState().program.getSourceFile(realpathSync(file))
}

function passThrough(file: string, component: string): string[] | undefined {
  return PASS_THROUGH.find(entry => join(REPO_ROOT, entry.file) === file && entry.component === component)?.attributes
}

/** Every attribute any of the lists names, or undefined when none names one. */
function merged(...lists: (string[] | undefined)[]): string[] | undefined {
  const attributes = [...new Set(lists.flatMap(list => list ?? []))]
  return attributes.length > 0 ? attributes : undefined
}

/** The props each of a component's call and construct signatures takes. */
function propsOf(type: ts.Type): ts.Type[] {
  const checker = programState().checker
  return [ts.SignatureKind.Call, ts.SignatureKind.Construct]
    .flatMap(kind => checker.getSignaturesOfType(type, kind))
    .flatMap(signature => (signature.parameters.length > 0 ? [checker.getTypeOfSymbol(signature.parameters[0])] : []))
}

const UNKNOWABLE = ts.TypeFlags.Any | ts.TypeFlags.Unknown | ts.TypeFlags.Never

type Handling = 'loads' | 'prefixes'
interface KnownComponent {
  name: string
  type: ts.Type
  props: ts.Type[]
  attributes: string[]
}

let KNOWN: Record<Handling, KnownComponent[]> | undefined

/** The type of a module's export, through its re-exports and aliases. */
function exportedType(source: ts.SourceFile | undefined, name: string): ts.Type | undefined {
  const checker = programState().checker
  const moduleSymbol = source && checker.getSymbolAtLocation(source)
  const symbol = moduleSymbol && checker.tryGetMemberInModuleExports(name, moduleSymbol)
  if (!symbol) return undefined
  return checker.getTypeOfSymbol(symbol.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(symbol) : symbol)
}

/**
 * The components the scan knows, each with the type and props the program
 * gives it. A component without a type of its own there would match nothing,
 * or anything, so it stops the scan.
 */
function knownComponents(handling: Handling): KnownComponent[] {
  if (!KNOWN) {
    const known = (name: string, source: ts.SourceFile | undefined, exported: string, attributes: string[]): KnownComponent => {
      const type = exportedType(source, exported)
      const props = type ? propsOf(type) : []
      if (!type || type.flags & UNKNOWABLE || props.length === 0 || props.some(prop => prop.flags & UNKNOWABLE)) {
        throw new Error(`${name} has no type of its own in the scan's program`)
      }
      return { name, type, props, attributes }
    }
    const fromPackages = (components: Record<string, string[]>) =>
      Object.entries(components).map(([key, attributes]) => {
        const at = key.lastIndexOf('#')
        const file = resolveComponentModule(key.slice(0, at))?.resolvedFileName
        return known(key, file ? sourceFor(file) : undefined, key.slice(at + 1), attributes)
      })
    KNOWN = {
      loads: [
        ...fromPackages(LOADERS),
        ...PASS_THROUGH.map(entry => known(`${entry.file}#${entry.component}`, sourceFor(join(REPO_ROOT, entry.file)), entry.component, entry.attributes)),
      ],
      prefixes: fromPackages(PREFIXERS),
    }
  }
  return KNOWN[handling]
}

/** The known components a member of a tag's type is: by its own type, or by the props it takes. */
function componentsOf(handling: Handling, type: ts.Type): KnownComponent[] {
  if (type.flags & UNKNOWABLE) return []
  const props = propsOf(type)
  return knownComponents(handling).filter(known => known.type === type || props.some(prop => known.props.includes(prop)))
}

let ELEMENT_NAMES: Set<string> | undefined

/** The URL attributes the element a tag names handles that way, by the type the checker gives the tag there. */
function tagAttributes(handling: Handling, tag: ts.JsxTagNameExpression): string[] | undefined {
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return handling === 'loads' ? ASSET_ATTRIBUTES[tag.text] : undefined
  if (!ts.isIdentifier(tag) && !ts.isPropertyAccessExpression(tag)) return undefined
  const checker = programState().checker
  ELEMENT_NAMES ??= new Set(checker.getJsxIntrinsicTagNamesAt(tag).map(symbol => symbol.name))
  const type = checker.getTypeAtLocation(tag)
  const members = type.isUnion() ? type.types : [type]
  const names = members.flatMap(member => (member.isStringLiteral() ? [member.value] : []))
  // a type that admits every element name, as ElementType does, does not say which one the tag is
  const anyElement = [...ELEMENT_NAMES].every(name => names.includes(name))
  return merged(
    ...(handling === 'loads' && !anyElement ? names.map(name => ASSET_ATTRIBUTES[name]) : []),
    ...members.flatMap(member => componentsOf(handling, member).map(known => known.attributes))
  )
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

  // packages/core/templates/app holds the copy sync writes from apps/dev/src/app, so an exception
  // named on the file under apps/dev/src/app covers that copy as well.
  const isAllowedFile = (allowedFile: string) =>
    allowedFile === relativePath ||
    allowedFile.replace(/^apps\/dev\/src\/app\//, 'packages/core/templates/app/') === relativePath

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
      const attributes = node.attributes.properties
      // an element with neither a URL attribute nor a spread has nothing to report, whatever its tag is
      const mayCarryUrl = attributes.some(attribute => !ts.isJsxAttribute(attribute) || URL_ATTRIBUTES.has(attribute.name.getText(source)))
      const loaded = (mayCarryUrl && tagAttributes('loads', node.tagName)) || []
      const prefixed = (mayCarryUrl && tagAttributes('prefixes', node.tagName)) || []

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
      // a tag whose type is a choice of tags is each tag it can be, a prop typed so included; a Slot loads
      // nothing itself, a <button> carries no URL, and a prop that shadows an import is not what the import is
      'bare-in-app-urls.tsx:178  Comp href in spread props  <Comp {...props} />',
      'bare-in-app-urls.tsx:185  Tag src from data  cover',
      'bare-in-app-urls.tsx:185  Tag srcSet, poster in spread props  <Tag src={cover} {...props} />',
      'bare-in-app-urls.tsx:186  Picture src from data  cover',
      'bare-in-app-urls.tsx:196  Tag href from data  href',
      'bare-in-app-urls.tsx:197  LocalRequired src from data  href',
      // ...as narrowed by a value assigned to it after it is declared
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
      // not reported: a variable of the same name declared in a nested function, and a closure's assignment
      // where the closure is called, which TypeScript's narrowing does not follow
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

  test('a tag is the type the checker gives it where it is written, and a call what its return type says', () => {
    const offenders = offendersIn(join(FIXTURES_DIR, 'flow-and-calls.tsx'))

    // Not reported: a value every path overwrites before the read, one given after the read with no loop
    // back to it, a closure's assignment where the closure is called, a call handed a variable already
    // overwritten, the wrapper around an <Image>, core's AvatarImage however it is wrapped, a call that
    // returns the argument it is not handed as a loader, a function that returns a wrapper of its own, and
    // a closure that assigns next/image after the element is built
    expect(offenders.map(offender => offender.replace(/^.*__fixtures__\//, ''))).toEqual([
      // a call returns what its return type says: the argument's type for identity(), next/image's props for memo()
      'flow-and-calls.tsx:15  GenericImage src from data  cover',
      'flow-and-calls.tsx:20  MemoImage src from data  cover',
      'flow-and-calls.tsx:25  NestedMemoImage src from data  cover',
      'flow-and-calls.tsx:30  ConditionalImage src from data  cover',
      'flow-and-calls.tsx:35  MemoSharedAvatar src from data  cover',
      "flow-and-calls.tsx:40  MemoLink href with the base path added twice  withBasePath('/docs')",
      'flow-and-calls.tsx:45  images.default src from data  cover',
      // a path that keeps the value: the catch of a try, a later turn of a loop
      'flow-and-calls.tsx:53  C src from data  cover',
      'flow-and-calls.tsx:60  C src from data  cover',
      // a read in a closure made before the variable's last assignment, which is its declared type
      'flow-and-calls.tsx:78  C src from data  cover',
      // the <Image> inside a forwardRef wrapper
      'flow-and-calls.tsx:83  Image src in spread props  <Image {...props} ref={ref} alt="" width={1} height={1} />',
      // a member of a local module, read by key or destructured
      'flow-and-calls.tsx:139  ByKey src from data  cover',
      'flow-and-calls.tsx:140  Destructured src from data  cover',
      // a string handed to a call
      'flow-and-calls.tsx:154  Anchor href  "/pricing"',
      // functions whose return type is next/image, with no argument or a default one
      'flow-and-calls.tsx:187  C src from data  cover',
      'flow-and-calls.tsx:192  C src from data  cover',
      // one branch leaves the loader in, in either order
      'flow-and-calls.tsx:208  C src from data  cover',
      'flow-and-calls.tsx:218  C src from data  cover',
      // a closure that swaps the loader out before the render: TypeScript narrows by the function that
      // reads, which does not see the closure's assignment when it is called
      'flow-and-calls.tsx:227  C src from data  cover',
    ])
  })

  test('a component typed only as ComponentType is not told apart from any other', () => {
    expect(offendersIn(join(FIXTURES_DIR, 'component-type.tsx'))).toEqual([])
  })

  test('a module that declares its own require keeps it', () => {
    expect(offendersIn(join(FIXTURES_DIR, 'local-require.tsx'))).toEqual([])
  })

  test('a member of an object is the type of that member, not an export of the same name', () => {
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
