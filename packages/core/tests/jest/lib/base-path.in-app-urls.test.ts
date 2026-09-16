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
 * namespace or with require(), and followed through re-exports and through
 * module-level constants that stand for it (`export const Picture = NextImage`).
 * So core's AvatarImage, which puts the base path on, is told apart from the
 * shared one it wraps, and lucide's Image icon from next/image's.
 *
 * Props handed over whole count too: an element that loads a URL and receives
 * a spread, without that attribute written out, is reported, since the URL
 * inside the spread goes unseen.
 *
 * What the scan does not follow, by design: a tag chosen at run time or
 * inside a component (`const Tag = asChild ? Slot : 'a'`), elements built with
 * createElement or cloneElement, a component loaded with import() or
 * next/dynamic, a URL assigned to a DOM property (`image.src = …`), and a `url(`
 * held in a variable before the value is joined to it. None of those carries an
 * in-app URL in these trees today.
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
  /** Module-level constants that stand for another name: `const Picture = NextImage` */
  aliases: Map<string, ts.Expression>
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

function requiredModule(node: ts.Expression | undefined): Binding | undefined {
  if (!node) return undefined
  if (ts.isPropertyAccessExpression(node) && node.name.text === 'default') {
    const module = requiredModule(node.expression)
    return module && { specifier: module.specifier, name: 'default' }
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

function moduleInfo(file: string): ModuleInfo {
  const known = MODULES.get(file)
  if (known) return known

  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const info: ModuleInfo = { source, imports: new Map(), aliases: new Map(), exports: new Map(), starExports: [] }
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
        const required = requiredModule(declaration.initializer)
        if (required && ts.isIdentifier(declaration.name)) info.imports.set(declaration.name.text, required)
        const initializer = declaration.initializer && unwrapped(declaration.initializer)
        if (
          !required &&
          initializer &&
          ts.isIdentifier(declaration.name) &&
          (ts.isIdentifier(initializer) || ts.isPropertyAccessExpression(initializer))
        ) {
          info.aliases.set(declaration.name.text, initializer)
        }
        if (required && required.name === '*' && ts.isObjectBindingPattern(declaration.name)) {
          for (const element of declaration.name.elements) {
            if (!ts.isIdentifier(element.name)) continue
            const imported = element.propertyName && ts.isIdentifier(element.propertyName) ? element.propertyName.text : element.name.text
            info.imports.set(element.name.text, { specifier: required.specifier, name: imported })
          }
        }
        if (isExported(statement) && ts.isIdentifier(declaration.name)) {
          info.exports.set(declaration.name.text, { local: declaration.name.text })
        }
      }
    }

    if ((ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) && statement.name && isExported(statement)) {
      info.exports.set(isDefault(statement) ? 'default' : statement.name.text, { local: statement.name.text })
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

function passThrough(file: string, component: string): string[] | undefined {
  return PASS_THROUGH.find(entry => join(REPO_ROOT, entry.file) === file && entry.component === component)?.attributes
}

/** The URL attributes an export hands on as given, following re-exports; undefined when it hands on none. */
function loaderExport(module: string, exportName: string, seen = new Set<string>()): string[] | undefined {
  const id = `${module}#${exportName}`
  if (seen.has(id)) return undefined
  seen.add(id)
  if (LOADERS[id]) return LOADERS[id]
  if (!module.startsWith('/') || !existsSync(module)) return undefined

  const info = moduleInfo(module)
  const exported = info.exports.get(exportName)
  if (exported && 'local' in exported) return loaderLocal(module, exported.local, seen) ?? passThrough(module, exportName)
  if (exported) return loaderExport(moduleKey(exported.specifier, module), exported.name, seen)
  for (const specifier of info.starExports) {
    const attributes = loaderExport(moduleKey(specifier, module), exportName, seen)
    if (attributes) return attributes
  }
  return undefined
}

/**
 * The URL attributes a name in a module hands on as given: an import of a
 * loader, a constant that stands for one, or a pass-through defined there.
 */
function loaderLocal(module: string, name: string, seen = new Set<string>()): string[] | undefined {
  const id = `${module}#local:${name}`
  if (seen.has(id)) return undefined
  seen.add(id)
  const info = moduleInfo(module)
  const binding = info.imports.get(name)
  if (binding && binding.name !== '*') return loaderExport(moduleKey(binding.specifier, module), binding.name, seen)
  const alias = info.aliases.get(name)
  if (alias) return loaderReference(module, alias, seen) ?? passThrough(module, name)
  return passThrough(module, name)
}

/** The URL attributes a component reference hands on as given: `Name` or `Namespace.Member`. */
function loaderReference(module: string, reference: ts.Node, seen = new Set<string>()): string[] | undefined {
  if (ts.isIdentifier(reference)) return loaderLocal(module, reference.text, seen)
  if (ts.isPropertyAccessExpression(reference) && ts.isIdentifier(reference.expression)) {
    const binding = moduleInfo(module).imports.get(reference.expression.text)
    if (binding?.name === '*') return loaderExport(moduleKey(binding.specifier, module), reference.name.text, seen)
  }
  return undefined
}

/** The URL attributes the element a tag names loads or navigates to as given. */
function loaderTag(module: string, tag: ts.JsxTagNameExpression): string[] | undefined {
  if (ts.isIdentifier(tag) && /^[a-z]/.test(tag.text)) return ASSET_ATTRIBUTES[tag.text]
  return loaderReference(module, tag)
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
      const loaded = loaderTag(module, node.tagName) ?? []
      const attributes = node.attributes.properties

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
