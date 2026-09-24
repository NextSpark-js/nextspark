/**
 * Page Generator
 *
 * Generates missing pages from template definitions
 *
 * @module core/scripts/build/registry/post-build/page-generator
 */

import { createRequire } from 'node:module'
import { constants, existsSync } from 'fs'
import { lstat, readdir, readFile } from 'fs/promises'
import { join, dirname, relative, sep } from 'path'
import { fileURLToPath } from 'url'

import { errorWithLines, log, verbose } from '../../../utils/index.mjs'
import { getProtectionLevel, ProtectionLevel } from '../../../../dist/config/protected-paths.js'
import { selectTypeScriptModule, loadTypeScriptFor } from '../shared/typescript-compiler.mjs'
import { projectBackupsDir, projectGeneratedTemplatesDir } from '../project-mode.mjs'
import { ensureBackupsGitignore } from './own-gitignores.mjs'
import { projectFiles } from '../../safe-fs.mjs'

export { selectTypeScriptModule }

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Default rootDir - use cwd() for NPM compatibility (will be overridden by config.projectRoot if provided)
let rootDir = process.cwd()
let generatedTemplatesDir = projectGeneratedTemplatesDir(rootDir)

function generatedHostPath(appPath, root = rootDir) {
  return join(projectGeneratedTemplatesDir(root), '..', appPath.replace(/^app\//, ''))
}

/**
 * Convert string to PascalCase
 */
function toPascalCase(str) {
  return str
    .replace(/[^a-zA-Z0-9]/g, ' ')
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join('')
}

/**
 * Next.js route segment config keys (the `AppSegmentConfigSchema` keys from
 * `next/dist/build/segment-config/app/app-segment-config`). Next.js only
 * reads these when they're declared as a literal `export const` directly in
 * the route file — a re-export doesn't work, so the generated route file
 * must re-declare the value itself rather than forward it.
 */
export const SEGMENT_CONFIG_EXPORTS = [
  'revalidate',
  'dynamicParams',
  'dynamic',
  'fetchCache',
  'preferredRegion',
  'experimental_ppr',
  'runtime',
  'maxDuration',
]

/**
 * Next.js module-level route exports that Next.js is happy to pick up
 * through a re-export (`export { x } from '...'`), unlike segment config.
 */
export const MODULE_LEVEL_EXPORTS = [
  'generateMetadata',
  'generateStaticParams',
  'generateViewport',
  'metadata',
  'viewport',
]

/**
 * Per-key validators for the segment config schema. A value that parses as a
 * literal but doesn't match here would still make Next.js throw at build
 * time (via `parseAppSegmentConfig`), just later and with less context about
 * which theme template caused it.
 */
const SEGMENT_CONFIG_VALIDATORS = {
  revalidate: value => value === false || (typeof value === 'number' && Number.isInteger(value) && value >= 0),
  dynamicParams: value => typeof value === 'boolean',
  dynamic: value => ['auto', 'error', 'force-static', 'force-dynamic'].includes(value),
  fetchCache: value =>
    ['auto', 'default-cache', 'only-cache', 'force-cache', 'force-no-store', 'default-no-store', 'only-no-store'].includes(value),
  preferredRegion: value => typeof value === 'string' || (Array.isArray(value) && value.every(item => typeof item === 'string')),
  experimental_ppr: value => typeof value === 'boolean',
  runtime: value => ['edge', 'nodejs'].includes(value),
  maxDuration: value => typeof value === 'number' && Number.isInteger(value) && value >= 0,
}

let nextParseModulePromise = null

/**
 * Next.js's own module parser and SWC binding loader, resolved from the project
 * and then from core, or null when neither has Next.js.
 */
function loadNextParseModule() {
  if (!nextParseModulePromise) {
    const parseModulePath = 'next/dist/build/analysis/parse-module'
    const swcPath = 'next/dist/build/swc'
    const loadFrom = require => ({
      parseModule: require(parseModulePath).parseModule,
      loadBindings: require(swcPath).loadBindings,
    })
    nextParseModulePromise = Promise.resolve()
      .then(() => loadFrom(createRequire(join(rootDir, 'package.json'))))
      .catch(() => loadFrom(createRequire(import.meta.url)))
      .then(async ({ parseModule, loadBindings }) => {
        await loadBindings()
        return parseModule
      }, () => null)
  }
  return nextParseModulePromise
}

/** Whether Next.js parses `source`; its parser answers null for a module it cannot. */
async function nextParses(filePath, source) {
  const parseModule = await loadNextParseModule()
  return Boolean(parseModule && (await parseModule(filePath, source)))
}

/**
 * Unwrap the syntactic wrappers around a literal that don't change its
 * runtime value: parentheses, `as const`, and `satisfies`.
 */
function unwrapExpression(expression, ts) {
  let current = expression
  while (true) {
    if (ts.isParenthesizedExpression(current)) {
      current = current.expression
    } else if (ts.isAsExpression(current) || ts.isSatisfiesExpression(current)) {
      current = current.expression
    } else {
      return current
    }
  }
}

/**
 * Evaluate an expression node as a JSON-compatible literal. Returns
 * `{ ok: false }` for anything that isn't a literal Next.js could read
 * statically - an expression, an identifier reference, a call, etc.
 */
function evaluateLiteral(expression, ts) {
  const node = unwrapExpression(expression, ts)

  if (node.kind === ts.SyntaxKind.TrueKeyword) return { ok: true, value: true }
  if (node.kind === ts.SyntaxKind.FalseKeyword) return { ok: true, value: false }
  if (ts.isNumericLiteral(node)) return { ok: true, value: Number(node.text.replace(/_/g, '')) }
  if (ts.isStringLiteralLike(node)) return { ok: true, value: node.text }

  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken) {
    const operand = evaluateLiteral(node.operand, ts)
    return operand.ok && typeof operand.value === 'number' ? { ok: true, value: -operand.value } : { ok: false }
  }

  if (ts.isArrayLiteralExpression(node)) {
    const values = []
    for (const element of node.elements) {
      const item = evaluateLiteral(element, ts)
      if (!item.ok) return { ok: false }
      values.push(item.value)
    }
    return { ok: true, value: values }
  }

  return { ok: false }
}

function isExported(node, ts) {
  return Boolean(node.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.ExportKeyword))
}

/**
 * Whether a module has a runtime default export: `export default <expr>`,
 * `export default function`/`class`, or `default` named in an export clause
 * (`export { Layout as default }`, `export { default } from './shell'`).
 * Type-only exports give the route no component.
 */
function declaresDefaultExport(sourceFile, ts) {
  return sourceFile.statements.some(statement => {
    if (ts.isExportAssignment(statement)) return !statement.isExportEquals
    if (ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)) {
      return isExported(statement, ts) && Boolean(statement.modifiers?.some(modifier => modifier.kind === ts.SyntaxKind.DefaultKeyword))
    }
    if (ts.isExportDeclaration(statement) && !statement.isTypeOnly && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      return statement.exportClause.elements.some(element => !element.isTypeOnly && element.name.text === 'default')
    }
    return false
  })
}

/**
 * Parse a theme template's source into a TypeScript AST.
 *
 * The parser recovers from a syntax error by skipping code, exports included. A
 * template Next.js cannot parse either is reported rather than read in part. One
 * it can is read from what TypeScript recovered, with a warning: Next.js compiles
 * templates with SWC, which may know syntax the installed TypeScript does not.
 */
async function parseTemplateSource(source, filePath) {
  const ts = await loadTypeScriptFor(rootDir)
  // Parsed as its own kind of file: a TSX parse reads TypeScript-only syntax in a
  // .ts template (`<T>(props) => ...`, `<Props>value`) as JSX and loses what follows
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(filePath))

  const [parseError] = sourceFile.parseDiagnostics ?? []
  if (parseError) {
    const { line } = sourceFile.getLineAndCharacterOfPosition(parseError.start ?? 0)
    const where = `${filePath}:${line + 1}`
    const reason = ts.flattenDiagnosticMessageText(parseError.messageText, ' ')
    if (!(await nextParses(filePath, source))) {
      throw new Error(`${where}: the template does not parse (${reason}), so its route-level exports cannot be read.`)
    }
    console.warn(
      `${where}: TypeScript cannot parse the template (${reason}) but Next.js can; its route-level exports are read from what TypeScript parsed.`
    )
  }

  return { ts, sourceFile }
}

/**
 * Split a parsed theme template's route-level exports into:
 * - `segmentConfig`: segment config keys that resolve to a literal value the
 *   generated route file can re-declare (`{ name: value }`).
 * - `moduleExports`: exported names (functions, `metadata`, etc.) the
 *   generated route file can safely forward with `export { ... } from`.
 * - `hasDefaultExport`: whether it exports a component as default, read from
 *   the syntax tree so a comment or string mentioning `export default` doesn't
 *   count and `export { Layout as default }` does.
 *
 * - `errors`: one per segment config key that IS exported but not as a
 *   literal `export const` (an expression, an identifier, `let`/`var`, a
 *   re-export, or a value the Next.js schema rejects). Next.js would ignore
 *   such a value and fall back to its default, and nothing in the build would
 *   say so beyond a console warning, so a route file generated from the
 *   template must not be written with it. They are returned rather than
 *   thrown because a template whose app route already exists gets no route
 *   file, and nothing reads its segment config.
 */
function collectRouteExports(sourceFile, ts, filePath) {
  const segmentConfig = {}
  const moduleExports = []
  const seenModuleExports = new Set()
  const errors = []

  const lineOf = node => sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1

  const addModuleExport = name => {
    if (!seenModuleExports.has(name)) {
      seenModuleExports.add(name)
      moduleExports.push(name)
    }
  }

  const recordSegmentError = (name, node, reason) => {
    errors.push(
      `${filePath}:${lineOf(node)}: segment config export "${name}" ${reason}. ` +
        `Next.js only reads segment config when it's a literal declared directly in the route file ` +
        `(\`export const ${name} = ...\`) - anything else is silently ignored and the default is used instead. ` +
        `Use a literal.`
    )
  }

  for (const statement of sourceFile.statements) {
    if (ts.isVariableStatement(statement) && isExported(statement, ts)) {
      const isConst = (statement.declarationList.flags & ts.NodeFlags.Const) !== 0

      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name)) continue
        const name = declaration.name.text

        if (SEGMENT_CONFIG_EXPORTS.includes(name)) {
          if (!isConst) {
            recordSegmentError(name, declaration, 'is declared with "let" or "var"')
            continue
          }
          if (!declaration.initializer) {
            recordSegmentError(name, declaration, 'has no initializer')
            continue
          }

          const literal = evaluateLiteral(declaration.initializer, ts)
          if (!literal.ok) {
            recordSegmentError(name, declaration, 'is not a literal (an expression or identifier)')
            continue
          }

          const validate = SEGMENT_CONFIG_VALIDATORS[name]
          if (!validate(literal.value)) {
            recordSegmentError(name, declaration, `has a value (${JSON.stringify(literal.value)}) outside what Next.js accepts for "${name}"`)
            continue
          }

          segmentConfig[name] = literal.value
        } else if (MODULE_LEVEL_EXPORTS.includes(name)) {
          addModuleExport(name)
        }
      }
    } else if (ts.isFunctionDeclaration(statement) && statement.name && isExported(statement, ts)) {
      const name = statement.name.text
      if (SEGMENT_CONFIG_EXPORTS.includes(name)) {
        recordSegmentError(name, statement, 'is declared as a function, not a literal')
      } else if (MODULE_LEVEL_EXPORTS.includes(name)) {
        addModuleExport(name)
      }
    } else if (ts.isExportDeclaration(statement) && statement.exportClause && ts.isNamedExports(statement.exportClause)) {
      for (const element of statement.exportClause.elements) {
        const exportedName = element.name.text

        if (SEGMENT_CONFIG_EXPORTS.includes(exportedName)) {
          recordSegmentError(
            exportedName,
            element,
            statement.moduleSpecifier
              ? 'is re-exported from another module'
              : 'is exported via `export { }` instead of an inline `export const`'
          )
        } else if (MODULE_LEVEL_EXPORTS.includes(exportedName)) {
          addModuleExport(exportedName)
        }
      }
    }
  }

  return { segmentConfig, moduleExports, hasDefaultExport: declaresDefaultExport(sourceFile, ts), errors }
}

/**
 * Parse a theme template's source and return its route-level exports as
 * `collectRouteExports` splits them, throwing on segment config Next.js
 * wouldn't read.
 */
export async function extractRouteExports(source, filePath) {
  const { ts, sourceFile } = await parseTemplateSource(source, filePath)
  const { errors, ...routeExports } = collectRouteExports(sourceFile, ts, filePath)

  if (errors.length > 0) {
    throw errorWithLines(errors)
  }

  return routeExports
}

/**
 * Resolve a project-root `@/...` template import path to its file on disk,
 * trying both TSX and TS extensions.
 */
function resolveTemplateFilePath(templatePath, root) {
  const baseTemplatePath = templatePath
    .replace('@/', root + '/')
    .replace(/\.(tsx|ts)$/, '')
  return existsSync(baseTemplatePath + '.tsx') ? baseTemplatePath + '.tsx' : baseTemplatePath + '.ts'
}

/**
 * Read a template file and collect its route-level exports. A missing file
 * is treated as having none and as having a default export - a build-time
 * override may point at a template that hasn't been generated yet, and
 * assuming a component exists there keeps that case importing it rather than
 * silently downgrading to metadata-only.
 */
async function readTemplateExports(templatePath, root) {
  const absoluteTemplatePath = resolveTemplateFilePath(templatePath, root)

  let templateContent
  try {
    templateContent = await readFile(absoluteTemplatePath, 'utf8')
  } catch {
    return { segmentConfig: {}, moduleExports: [], hasDefaultExport: true, errors: [] }
  }

  const { ts, sourceFile } = await parseTemplateSource(templateContent, absoluteTemplatePath)
  return collectRouteExports(sourceFile, ts, absoluteTemplatePath)
}

/**
 * Render the segment config keys a template exports as re-declared literals.
 */
function renderSegmentConfigBlock(segmentConfig) {
  return Object.entries(segmentConfig)
    .map(([name, value]) => `export const ${name} = ${JSON.stringify(value)}\n`)
    .join('')
}

/**
 * Render the module-level exports a template exports as a re-export from it.
 */
function renderModuleExportsBlock(moduleExports, templatePathWithoutExtension) {
  return moduleExports.length > 0
    ? `export { ${moduleExports.join(', ')} } from '${templatePathWithoutExtension}'\n`
    : ''
}

/**
 * Generate content for a regular page (page.tsx, error.tsx, etc.)
 */
function generateRegularPageContent(appPath, templatePath, { segmentConfig, moduleExports }) {
  // Remove .tsx/.ts extension from import path (TypeScript doesn't allow file extensions in imports)
  const templatePathWithoutExtension = templatePath.replace(/\.(tsx|ts)$/, '')

  const segmentConfigBlock = renderSegmentConfigBlock(segmentConfig)
  const segmentConfigSection = segmentConfigBlock
    ? `\n// Segment config re-declared as literals: Next.js only reads these when they're declared directly in the route file, not re-exported\n${segmentConfigBlock}`
    : ''

  const moduleExportsBlock = renderModuleExportsBlock(moduleExports, templatePathWithoutExtension)
  const moduleExportsSection = moduleExportsBlock
    ? `\n// Re-export Next.js route-level exports from the theme template\n${moduleExportsBlock}`
    : ''

  return `/**
 * Template page - directly imports from theme
 * Template: ${appPath}
 * Generated by: scripts/build-registry.mjs
 */
import TemplateComponent from '${templatePathWithoutExtension}'

// Direct export of the theme template (no fallback)
export default TemplateComponent
${segmentConfigSection}${moduleExportsSection}`
}

/**
 * Generate content for a layout page
 */
function generateLayoutPageContent(appPath, componentName, templatePath, routeExports) {
  if (templatePath) {
    // Remove .tsx/.ts extension from import path (TypeScript doesn't allow file extensions in imports)
    const templatePathWithoutExtension = templatePath.replace(/\.(tsx|ts)$/, '')

    // Whether the template has a default export (component), and what
    // route-level exports it defines alongside (or instead of) it
    const { hasDefaultExport, segmentConfig, moduleExports } = routeExports

    const segmentConfigBlock = renderSegmentConfigBlock(segmentConfig)
    const moduleExportsBlock = renderModuleExportsBlock(moduleExports, templatePathWithoutExtension)

    if (hasDefaultExport) {
      // Template has a component - import and re-export it, plus any route-level exports it defines
      const forwardedExportsSection = segmentConfigBlock || moduleExportsBlock
        ? `\n// Re-export Next.js route-level exports from the theme template\n${segmentConfigBlock}${moduleExportsBlock}`
        : ''

      return `/**
 * Layout template - directly imports from theme
 * Template: ${appPath}
 * Generated by: scripts/build-registry.mjs
 */
import TemplateComponent from '${templatePathWithoutExtension}'

// Direct export of the theme template (no fallback)
export default TemplateComponent
${forwardedExportsSection}`
    } else if (segmentConfigBlock || moduleExportsBlock) {
      // No component, but the template still defines segment config and/or metadata -
      // re-export those and provide a pass-through component. Only a PROTECTED_RENDER
      // path is labeled as one; anywhere else the template simply has no default export.
      const renderProtected = getProtectionLevel(appPath) === ProtectionLevel.PROTECTED_RENDER
      const description = renderProtected
        ? 'metadata-only (PROTECTED_RENDER)'
        : 'route-level exports only (the theme template has no default export)'
      const passThroughNote = renderProtected
        ? 'actual rendering blocked by PROTECTED_RENDER'
        : 'the theme template exports no component, so this layout renders its children'
      return `/**
 * Layout template - ${description}
 * Template: ${appPath}
 * Generated by: scripts/build-registry.mjs
 */
import type { ReactNode } from 'react'

// Re-export Next.js route-level exports from the theme template
${segmentConfigBlock}${moduleExportsBlock}
// Pass-through component (${passThroughNote})
interface ${componentName}Props {
  children: ReactNode
}

export default function ${componentName}({ children }: ${componentName}Props) {
  return <>{children}</>
}
`
    } else {
      // Empty template file - provide basic wrapper
      return `/**
 * Layout template - empty template file
 * Template: ${appPath}
 * Generated by: scripts/build-registry.mjs
 */
interface ${componentName}Props {
  children: React.ReactNode
}

export default function ${componentName}({ children }: ${componentName}Props) {
  return <>{children}</>
}
`
    }
  } else {
    // Basic layout wrapper for parent directory structure (when no template exists)
    return `/**
 * Basic layout wrapper - maintains Next.js structure
 * Generated by: scripts/build-registry.mjs
 */
interface ${componentName}Props {
  children: React.ReactNode
}

export default function ${componentName}({ children }: ${componentName}Props) {
  return <>{children}</>
}
`
  }
}

/**
 * Add template resolver to existing layout content
 * Respects React directives and import order
 */
function addTemplateResolverToLayout(content, layoutPath) {
  let modifiedContent = content

  // Skip if already has template resolver
  if (content.includes("from '@/core/lib/template-resolver'") || content.includes("from '@/core/lib/registries/template-registry.client'")) {
    return content
  }

  // Find React directives ('use client', 'use server') at the start
  const directiveRegex = /^(\s*['"`]use (client|server)['"`]\s*\n?)/
  const directiveMatch = content.match(directiveRegex)
  const isClientComponent = directiveMatch && directiveMatch[2] === 'client'

  // Use client-safe resolver for client components
  const importStatement = isClientComponent
    ? `import { getTemplateOrDefaultClient } from '@/core/lib/registries/template-registry.client'\n`
    : `import { getTemplateOrDefault } from '@/core/lib/template-resolver'\n`

  const resolverFunction = isClientComponent ? 'getTemplateOrDefaultClient' : 'getTemplateOrDefault'

  if (directiveMatch) {
    // Insert import after directive
    const directive = directiveMatch[0]
    const afterDirective = content.substring(directive.length)
    modifiedContent = directive + `\n${importStatement}` + afterDirective
  } else {
    // Insert import at the beginning
    modifiedContent = importStatement + content
  }

  // Handle different export patterns
  // Pattern 1: export default function FunctionName(...) { ... }
  const inlineFunctionMatch = modifiedContent.match(/export\s+default\s+function\s+([^\s(]+)/)
  if (inlineFunctionMatch) {
    const componentName = inlineFunctionMatch[1]
    // Convert to: function FunctionName(...) { ... } then add wrapped export at end
    modifiedContent = modifiedContent.replace(/export\s+default\s+function/, 'function')
    modifiedContent += `\nexport default ${resolverFunction}('${layoutPath}', ${componentName})\n`
    return modifiedContent
  }

  // Pattern 2: export default ComponentName (component already declared)
  const exportMatch = modifiedContent.match(/export\s+default\s+([^\s;({]+)/)
  if (exportMatch) {
    const componentName = exportMatch[1]
    const newExport = `export default ${resolverFunction}('${layoutPath}', ${componentName})`
    modifiedContent = modifiedContent.replace(/export\s+default\s+[^\s;({]+/, newExport)
  }

  return modifiedContent
}

/**
 * The comment a copy of an app/ layout in src/app/(templates)/ starts with. A
 * comment is not a statement, so a 'use client' directive right after it is
 * still the file's directive.
 */
function layoutCopyHeader(layoutPath) {
  return `/**
 * Generated by the NextSpark registry build: a copy of ${layoutPath}, so theme
 * routes under src/app/(templates) render inside the same layout. Rewritten on every build.
 */
`
}

/**
 * The content of the copy of an app/ layout in src/app/(templates)/. A layout that
 * can't be read is replaced by a pass-through, which keeps the hierarchy.
 */
async function layoutCopyContent(layoutPath, appFiles) {
  const layout = await projectFileContent(layoutPath, appFiles)
  if (layout !== null) {
    return layoutCopyHeader(layoutPath) + layout
  } else {
    const componentName = `PassThroughLayout${toPascalCase(layoutPath.replace(/[^\w]/g, '_'))}`
    return `/**
 * Basic layout wrapper - maintains Next.js structure
 * Generated by: scripts/build-registry.mjs
 */
interface ${componentName}Props {
  children: React.ReactNode
}

export default function ${componentName}({ children }: ${componentName}Props) {
  return <>{children}</>
}
`
  }
}

/**
 * The app/ layouts above a route directory, outermost first, that exist in the
 * project: the ones a route generated into src/app/(templates)/ needs copied beside
 * it to render inside the same hierarchy.
 *
 * @param {string} directory - App directory of a route (e.g. 'app/dashboard/(main)/posts')
 */
function requiredLayoutPaths(directory, appFiles) {
  const layoutPaths = []
  let currentPath = ''
  for (const part of directory.replace(/^app\/?/, '').split('/')) {
    if (!part) continue
    currentPath = currentPath ? `${currentPath}/${part}` : part
    const layoutPath = `app/${currentPath}/layout.tsx`
    const exists = appFiles?.has(layoutPath) ? appFiles.get(layoutPath) !== null : existsSync(generatedHostPath(layoutPath))
    if (exists) {
      layoutPaths.push(layoutPath)
    }
  }
  return layoutPaths
}

/**
 * A file's content, by path from the project root: what `appFiles` gives when
 * it has the path - null standing for a file that is gone - and otherwise what
 * is on disk; null when there is no such file.
 */
async function projectFileContent(path, appFiles) {
  if (appFiles?.has(path)) return appFiles.get(path)
  try {
    return await readFile(generatedHostPath(path), 'utf8')
  } catch {
    return null
  }
}

/**
 * Generate a single template page with template override system
 *
 * What `routeFileAction` decides applies: a template over a route the app
 * already has gets no file, and the result says so; one whose route file would
 * break is rejected before anything is written.
 *
 * @param {Object} template - The template to generate a route file from
 * @param {string} outputPath - Where to write it
 * @param {Map} [analysis] - What `analyzeTemplates` read from the build's templates; taken for this
 *   template when omitted
 * @returns {Promise<{ written: boolean, reason?: string }>}
 */
export async function generateTemplatePage(template, outputPath, analysis = null) {
  const routeExports = analysis ? templateAnalysisFor(analysis, template) : await analyzeTemplate(template, rootDir)

  if (routeFileAction(template, routeExports) === 'skip') {
    return { written: false, reason: `the app already has ${template.appPath}, so no route file is generated for this template` }
  }

  const files = projectFiles(rootDir)
  await files.mkdir(dirname(outputPath), { recursive: true })
  await files.writeFile(outputPath, routeFileContent(template, routeExports), 'utf8')
  verbose(`Generated: ${outputPath.replace(rootDir, '')}`)
  return { written: true }
}

/**
 * Whether `generateMissingPages` will write a route file at `appPath` -
 * importing the template's default export - rather than leaving the app's
 * own file in place and letting the override resolve at runtime through
 * `getTemplateOrDefault`. A layout is always written, since build-time
 * override resolution duplicates it into `src/app/(templates)/` regardless of
 * whether the app already has one; anything else is only written when the
 * app doesn't already have that route.
 *
 * @param {Map<string, string | null>} [appFiles] - Files under app/, by path from the project root, to take as
 *   having this content instead of what is on disk (null: removed)
 */
export function willGenerateRoute(appPath, templateType, root = rootDir, appFiles = undefined) {
  if (templateType === 'layout') return true
  if (appFiles?.has(appPath)) return appFiles.get(appPath) === null
  return !existsSync(generatedHostPath(appPath, root))
}

/**
 * Parse each template once and record what it contributes to the build: its
 * route-level exports, whether it has a default export, and whether the page
 * generator writes a route file for it (`generatesRoute`). The server template
 * registry, the client template registry and the page generator all take
 * these from the result instead of reading the template themselves, so a
 * template that changes while a build runs can't look one way to one of them
 * and another way to the next.
 *
 * Throws for a template the page generator writes a route file for when that
 * file can't work: segment config Next.js wouldn't read, or a page (or any
 * other non-layout route) with no default export to import - a plain .tsx/.ts
 * as much as a standalone .meta.ts, which never has one. A layout with no
 * default export gets a pass-through component instead. A template whose app
 * route already exists gets no route file, so neither applies to it: the
 * override resolves at runtime, metadata included.
 *
 * @param {Array} templates - List of template definitions
 * @param {Object} config - Configuration object with projectRoot
 * @param {Map<string, string | null>} [appFiles] - Files under app/, by path from the project root, to take as
 *   having this content instead of what is on disk (null: removed), so `generatesRoute` answers for the app as
 *   a sync about to run leaves it rather than for the app the analysis runs against
 * @returns {Promise<Map<string, Object>>} Each template's analysis, keyed by its templatePath
 */
export async function analyzeTemplates(templates, config = null, appFiles = undefined) {
  if (config?.projectRoot) {
    rootDir = config.projectRoot
  }

  const analysis = new Map()

  for (const template of templates) {
    if (!analysis.has(template.templatePath)) {
      analysis.set(template.templatePath, await analyzeTemplate(template, rootDir, appFiles))
    }
  }

  return analysis
}

/**
 * Parse one template and collect what `analyzeTemplates` records for it,
 * rejecting it when the route file generated from it can't work: segment
 * config Next.js wouldn't read, or what `routeFileAction` rejects. Every
 * generator that has no analysis to hand reads a template through here.
 *
 * @param {Object} template - The template to read
 * @param {string} root - The project root its path resolves against
 * @param {Map<string, string | null>} [appFiles] - Files under app/ to take as having this content, as for
 *   `analyzeTemplates`
 */
async function analyzeTemplate(template, root, appFiles) {
  const { appPath, templateType, templatePath } = template
  const generatesRoute = willGenerateRoute(appPath, templateType, root, appFiles)
  const { errors, ...routeExports } = await readTemplateExports(templatePath, root)

  if (generatesRoute && errors.length > 0) {
    throw errorWithLines(errors)
  }

  const entry = { ...routeExports, generatesRoute }
  routeFileAction(template, entry)
  return entry
}

/**
 * What becomes of a template's route file, decided from its analysis in this
 * one place for every generator that writes route files or registers template
 * components:
 * - 'write': a route file is generated for it in src/app/(templates)
 * - 'skip': the app already has that route, which stays; the override resolves
 *   at runtime, and nothing is written for it
 *
 * A page (or any other non-layout route) whose route file would import a default
 * export it doesn't have - a plain .tsx/.ts as much as a standalone .meta.ts,
 * which never has one - is rejected. A layout with no default export gets a
 * pass-through component instead.
 *
 * @param {Object} template - The template
 * @param {Object} entry - Its analysis, as `analyzeTemplates` records it
 * @returns {'write' | 'skip'}
 */
export function routeFileAction(template, entry) {
  const { appPath, templateType, templatePath } = template

  if (!entry.generatesRoute) {
    return 'skip'
  }

  if (templateType !== 'layout' && !entry.hasDefaultExport) {
    throw new Error(
      `${templatePath} has no default export, and the app has no existing route at "${appPath}" ` +
        `for a metadata-only override to attach to - the registry build generates "${appPath}" importing this ` +
        `template's default export, which doesn't exist. A page template needs a default export. For a ` +
        `metadata-only override, add one to an app page that already exists at "${appPath}" (a ".meta.ts" file, ` +
        `or a template with no default export, next to it).`
    )
  }

  return 'write'
}

/**
 * The analysis `analyzeTemplates` recorded for a template. Missing means the
 * caller is generating from templates other than the ones it analyzed, and
 * reading the template here would bring back a second, possibly different,
 * answer - so it fails instead.
 */
export function templateAnalysisFor(analysis, template) {
  const entry = analysis?.get(template.templatePath)
  if (!entry) {
    throw new Error(
      `${template.templatePath} was not read by analyzeTemplates() - pass the analysis of the same templates being generated.`
    )
  }
  return entry
}

/**
 * Generate missing pages for templates with layout duplication
 * Creates pages in src/app/(templates)/ with necessary layouts duplicated
 * Only generates pages for templates that actually exist
 *
 * @param {Array} templates - List of template definitions
 * @param {Object} config - Configuration object with projectRoot
 * @param {Map} [analysis] - What `analyzeTemplates` read from these templates; taken for this call when omitted
 * @returns {Promise<{ created: number, updated: number, removed: number, backupDir: string | null, skipped: string[] }>}
 *   What changed in src/app/(templates), and the app paths of the templates that got no route file
 */
export async function generateMissingPages(templates, config = null, analysis = null) {
  // Use config.projectRoot if provided, otherwise fall back to default rootDir
  if (config?.projectRoot) {
    rootDir = config.projectRoot
  }
  generatedTemplatesDir = config?.generatedTemplatesDir || projectGeneratedTemplatesDir(rootDir)
  const templatesDir = generatedTemplatesDir

  // Every template has to pass routeFileAction before anything is written or deleted
  analysis = analysis ?? (await analyzeTemplates(templates, config))
  const skipped = templates
    .filter(template => routeFileAction(template, templateAnalysisFor(analysis, template)) === 'skip')
    .map(({ appPath }) => appPath)

  const { created, updated, removed, backupDir } = await reconcileTemplatesTree(
    templatesDir,
    await planTemplatesTree(templates, analysis)
  )

  if (created > 0 || updated > 0 || removed > 0) {
    log(`src/app/(templates): ${created} new, ${updated} updated, ${removed} removed`, 'success')
  } else {
    verbose('src/app/(templates) is up to date')
  }
  if (backupDir) {
    log(`src/app/(templates): what was replaced or removed is backed up in ${relative(rootDir, backupDir)}`, 'warning')
  }

  return { created, updated, removed, backupDir, skipped }
}

/**
 * What `generateMissingPages` would change in src/app/(templates), worked out
 * without writing anything: the files it would create, the ones it would
 * replace and the ones it would remove - backing up both of those first - as
 * paths from the project root.
 *
 * `appFiles` reaches the analysis too: whether a template gets a route file at
 * all turns on whether the app has one at that path, so a route the sync is
 * about to write - or remove - decides the plan the same way it decides the run.
 *
 * @param {Array} templates - List of template definitions
 * @param {Object} config - Configuration object with projectRoot
 * @param {Map<string, string | null>} [appFiles] - Files under app/, by path from the project root, to take as
 *   having this content instead of what is on disk (null: removed), to plan against changes not written yet
 * @returns {Promise<{ create: string[], replace: string[], remove: string[] }>}
 */
export async function planMissingPages(templates, config = null, appFiles = undefined) {
  if (config?.projectRoot) {
    rootDir = config.projectRoot
  }
  generatedTemplatesDir = config?.generatedTemplatesDir || projectGeneratedTemplatesDir(rootDir)
  const templatesDir = generatedTemplatesDir

  const analysis = await analyzeTemplates(templates, config, appFiles)
  const { create, replace, remove } = await diffTemplatesTree(templatesDir, await planTemplatesTree(templates, analysis, appFiles))

  const fromRoot = path => relative(rootDir, path).split(sep).join('/')
  return { create: create.map(fromRoot), replace: replace.map(fromRoot), remove: remove.map(fromRoot) }
}

/**
 * The route file generated from a template, with its component named after the
 * last static segment of the template's route.
 */
function routeFileContent(template, routeExports) {
  const { appPath, templateType, name, templatePath } = template
  const routeSegments = name.split('/').filter(segment => !segment.startsWith('[') && !segment.endsWith(']'))
  const routeName = routeSegments[routeSegments.length - 1] || 'page'
  const componentName = `AutoGenerated${toPascalCase(routeName)}${toPascalCase(templateType)}`

  return templateType === 'layout'
    ? generateLayoutPageContent(appPath, componentName, templatePath, routeExports)
    : generateRegularPageContent(appPath, templatePath, routeExports)
}

/** Where a file under app/ is generated inside src/app/(templates)/. */
function templatesTreePath(appPath) {
  return join(generatedTemplatesDir, appPath.replace(/^app\//, ''))
}

/**
 * Everything the registry build puts in src/app/(templates), as absolute path to
 * content: a copy of each app/ layout above a template's route, and the route
 * file of each template that gets one. A layout template's route file takes the
 * place of the copy of the app layout at the same path.
 */
async function planTemplatesTree(templates, analysis, appFiles) {
  const files = new Map()

  const directories = new Set(templates.map(({ appPath }) => appPath.replace(/\/[^\/]+$/, '')))
  for (const directory of directories) {
    for (const layoutPath of requiredLayoutPaths(directory, appFiles)) {
      const copyPath = templatesTreePath(layoutPath)
      if (!files.has(copyPath)) {
        files.set(copyPath, await layoutCopyContent(layoutPath, appFiles))
      }
    }
  }

  for (const template of templates) {
    const routeExports = templateAnalysisFor(analysis, template)
    if (routeFileAction(template, routeExports) === 'write') {
      files.set(templatesTreePath(template.appPath), routeFileContent(template, routeExports))
    }
  }

  return files
}

/**
 * Every file under a directory, recursively, dotfiles included; none when it
 * doesn't exist. Finder's .DS_Store is nobody's output and nobody's edit, and
 * is left alone.
 */
async function listFiles(directory) {
  if (!existsSync(directory)) return []

  const files = []
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.DS_Store') continue
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path)))
    } else if (entry.isFile()) {
      files.push(path)
    }
  }
  return files
}

/**
 * Remove a directory the tree needs a file in place of, once the files in it
 * are backed up and removed: the directories left in it, and any .DS_Store.
 */
async function removeDirectoryInTheWay(directory) {
  const files = projectFiles(rootDir)
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) {
      await removeDirectoryInTheWay(path)
    } else if (entry.name === '.DS_Store') {
      await files.unlink(path)
    }
  }
  await files.rmdir(directory)
}

/** Remove the empty directories under `directory`, deepest first, keeping `directory` itself. */
async function removeEmptyDirectories(directory) {
  if (!existsSync(directory)) return

  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue
    const path = join(directory, entry.name)
    await removeEmptyDirectories(path)
    if ((await readdir(path)).length === 0) {
      await projectFiles(rootDir).rmdir(path)
    }
  }
}

/**
 * How src/app/(templates) differs from `files`, as absolute paths: the files
 * `files` has that don't exist yet - a directory where one goes counts as none,
 * since the files in it are removed - the ones that exist with other content,
 * and the files in the tree that `files` doesn't have.
 */
async function diffTemplatesTree(templatesDir, files) {
  const create = []
  const replace = []
  for (const [path, content] of files) {
    if (!existsSync(path) || (await lstat(path)).isDirectory()) {
      create.push(path)
    } else if ((await readFile(path, 'utf8')) !== content) {
      replace.push(path)
    }
  }

  const remove = (await listFiles(templatesDir)).filter(path => !files.has(path))
  return { create, replace, remove }
}

/**
 * Make src/app/(templates) hold exactly `contents`. The registry build owns that tree,
 * but a file about to be replaced with different content, or removed because
 * this build didn't produce it, may hold someone's edit: it is first copied into
 * a directory under .nextspark/backups/ that belongs to this run alone - the
 * time, and a suffix no other run gets - and named in the output. A backup is
 * never written over.
 *
 * Whatever runs the build - build, dev, registry:build or sync:app - the
 * backups are kept out of git by .nextspark/backups/.gitignore, put in place
 * before anything in the tree is written; when one already there can't do
 * that, nothing in the tree is written at all.
 */
async function reconcileTemplatesTree(templatesDir, contents) {
  const { create, replace, remove } = await diffTemplatesTree(templatesDir, contents)
  if (replace.length > 0 || remove.length > 0) {
    await ensureBackupsGitignore(rootDir)
  }
  let backupDir = null
  const files = projectFiles(rootDir)

  const backUp = async absolutePath => {
    if (!backupDir) {
      const backupsRoot = projectBackupsDir(rootDir)
      await files.mkdir(backupsRoot, { recursive: true })
      backupDir = await files.mkdtemp(join(backupsRoot, `${new Date().toISOString().replace(/[:.]/g, '-')}-`))
    }
    const relativePath = relative(rootDir, absolutePath)
    const backupPath = join(backupDir, relativePath)
    await files.mkdir(dirname(backupPath), { recursive: true })
    await files.copyFile(absolutePath, backupPath, constants.COPYFILE_EXCL)
    log(`src/app/(templates): backed up ${relativePath} to ${relative(rootDir, backupPath)}`, 'warning')
  }

  // What stands where a file goes - a file where the tree needs a directory,
  // or the files of a directory where it needs a file - is backed up and
  // removed before anything is created, and new files still come before the
  // rest is replaced or removed
  const inTheWay = new Set(remove.filter(path =>
    create.some(created => created.startsWith(`${path}${sep}`) || path.startsWith(`${created}${sep}`))
  ))
  for (const path of inTheWay) {
    await backUp(path)
    await files.unlink(path)
  }

  for (const path of create) {
    if (existsSync(path)) {
      await removeDirectoryInTheWay(path)
    }
    await files.mkdir(dirname(path), { recursive: true })
    await files.writeFile(path, contents.get(path), 'utf8')
  }

  for (const path of replace) {
    await backUp(path)
    await files.writeFile(path, contents.get(path), 'utf8')
  }

  for (const path of remove.filter(path => !inTheWay.has(path))) {
    await backUp(path)
    await files.unlink(path)
  }

  await removeEmptyDirectories(templatesDir)

  return { created: create.length, updated: replace.length, removed: remove.length, backupDir }
}
