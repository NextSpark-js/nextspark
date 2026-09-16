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
 *  - the attributes that name a navigation or an asset: an `<a href>`, an
 *    `<img src>`, an `<iframe src>`
 *  - the `src` of next/image's `<Image>`: the optimizer fetches that URL from
 *    the app itself, and it is not prefixed any more than an `<img src>` is
 *  - `url()` inside a style, such as a background image built from an upload
 *  - markup handed to dangerouslySetInnerHTML, which carries its own URLs
 *  - the config files, whose headers name endpoints as plain strings
 *
 * The scan reads the syntax tree, not lines of text: the call and its path can
 * sit on different lines, and the path is just as often built into a variable
 * or handed over as data.
 */
import ts from 'typescript'
import { readdirSync, readFileSync, existsSync } from 'fs'
import { join, relative } from 'path'

const REPO_ROOT = join(__dirname, '../../../../..')

const TREES = [
  'packages/core/src',
  'packages/core/templates',
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

/** The modules whose default export is next/image's `<Image>`, under whatever name it is imported. */
const IMAGE_MODULES = new Set(['next/image', 'next/legacy/image'])

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
  return callsOneOf(node, HELPERS)
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

/** The tag an attribute belongs to, or '' when the node is not in an element. */
function owningTag(attribute: ts.JsxAttribute, source: ts.SourceFile): string {
  const element = attribute.parent.parent
  return ts.isJsxOpeningElement(element) || ts.isJsxSelfClosingElement(element)
    ? element.tagName.getText(source)
    : ''
}

function attributeValue(attribute: ts.JsxAttribute): ts.Node | undefined {
  const initializer = attribute.initializer
  if (!initializer) return undefined
  return ts.isJsxExpression(initializer) ? initializer.expression : initializer
}

function offendersIn(file: string): string[] {
  const relativePath = relative(REPO_ROOT, file)
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const pathVariables = new Map<string, string>()
  const found: string[] = []

  // The names next/image's component goes by in this file
  const imageComponents = new Set<string>()
  for (const statement of source.statements) {
    if (
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      IMAGE_MODULES.has(statement.moduleSpecifier.text) &&
      statement.importClause?.name
    ) {
      imageComponents.add(statement.importClause.name.text)
    }
  }

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

    if (ts.isJsxAttribute(node)) {
      const name = node.name.getText(source)
      const tag = owningTag(node, source)
      const value = attributeValue(node)

      // <Link> Next.js prefixes; an <a>, an <img>, next/image's <Image> and the rest it does not
      const isAsset = ASSET_ATTRIBUTES[tag]?.includes(name) || (imageComponents.has(tag) && name === 'src')
      if (value && isAsset && !isWrapped(value) && !isElsewhere(value)) {
        if (writtenPath(value)?.startsWith('/')) report(node, tag === 'a' ? 'anchor' : `${tag} ${name}`, value.getText(source))
        else if (!writtenPath(value)) report(node, `${tag} ${name} from data`, value.getText(source))
      }

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

    // next/image's <Image> handed its props whole: the src among them goes unseen
    if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = node.tagName.getText(source)
      const attributes = node.attributes.properties
      if (
        imageComponents.has(tag) &&
        attributes.some(ts.isJsxSpreadAttribute) &&
        !attributes.some(attribute => ts.isJsxAttribute(attribute) && attribute.name.getText(source) === 'src')
      ) {
        report(node, `${tag} src in spread props`, node.getText(source))
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
  })

  test('the scan sees the shapes a line-by-line read misses', () => {
    const offenders = offendersIn(join(REPO_ROOT, 'packages/core/tests/jest/lib/__fixtures__/bare-in-app-urls.tsx'))

    expect(offenders.map(offender => offender.replace(/^.*__fixtures__\//, ''))).toEqual([
      'bare-in-app-urls.tsx:9  fetch via variable  path = `/api/v1/${slug}`',
      'bare-in-app-urls.tsx:13  fetch  \'/api/v1/teams\'',
      'bare-in-app-urls.tsx:19  location  window.location.href = \'/dashboard\'',
      'bare-in-app-urls.tsx:30  pushState  `/dashboard/boards/${id}`',
      'bare-in-app-urls.tsx:31  open  \'/dashboard/reports\'',
      'bare-in-app-urls.tsx:37  anchor  "/pricing"',
      'bare-in-app-urls.tsx:39  a href from data  href',
      'bare-in-app-urls.tsx:52  img src from data  thumbnail',
      'bare-in-app-urls.tsx:54  img src  "/theme/blocks/hero/thumbnail.png"',
      'bare-in-app-urls.tsx:55  a href from data  url',
      'bare-in-app-urls.tsx:57  iframe src from data  url',
      'bare-in-app-urls.tsx:65  embedded html  dangerouslySetInnerHTML={{ __html: body }}',
      'bare-in-app-urls.tsx:72  open  url',
      // next/image's component, under the name it was imported as; lucide's Image icon is not it
      'bare-in-app-urls.tsx:78  NextImage src from data  cover',
      'bare-in-app-urls.tsx:80  NextImage src  "/brand/logo.png"',
      'bare-in-app-urls.tsx:81  NextImage src in spread props  <NextImage {...rest} />',
      'bare-in-app-urls.tsx:90  css url() from data  url(${upload})',
      'bare-in-app-urls.tsx:92  css url()  \'url(/theme/hero.jpg)\'',
      'bare-in-app-urls.tsx:93  css url() from data  url(${upload})',
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
