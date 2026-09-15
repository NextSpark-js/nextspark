/**
 * Page Generator
 *
 * Generates missing pages from template definitions
 *
 * @module core/scripts/build/registry/post-build/page-generator
 */

import { createRequire } from 'node:module'
import { existsSync } from 'fs'
import { readFile, writeFile, mkdir } from 'fs/promises'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

import { log, verbose } from '../../../utils/index.mjs'
import { cleanupOrphanedTemplates } from './route-cleanup.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Default rootDir - use cwd() for NPM compatibility (will be overridden by config.projectRoot if provided)
let rootDir = process.cwd()

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

// Loaded lazily (and only once) since not every consumer of this module needs
// to parse a template - npm-mode builds without a template needing this path
// shouldn't pay for loading a TypeScript compiler up front.
let typescriptModulePromise = null

/** The TypeScript 5/6 compiler API this generator parses templates with. TypeScript 7's
 * native port doesn't ship it - its package exports are `./lib/version.cjs` plus
 * `./unstable/*` - so a candidate module is checked for these, not just for existing. */
function hasCompilerApi(ts) {
  return Boolean(ts && typeof ts.createSourceFile === 'function' && typeof ts.getScriptKindFromFileName === 'function' && ts.ScriptKind)
}

/**
 * Try each TypeScript candidate in order and return the first module whose API this
 * generator needs. A candidate that loads but lacks the API is recorded and the next
 * one is tried, rather than failing on the first hit - the point of trying more than
 * one candidate at all.
 */
export async function selectTypeScriptModule(candidates) {
  const rejected = []

  for (const candidate of candidates) {
    let loaded
    try {
      loaded = await candidate.load()
    } catch (error) {
      rejected.push(`${candidate.label}: could not be loaded (${error.message})`)
      continue
    }

    const ts = loaded?.default ?? loaded
    if (hasCompilerApi(ts)) {
      return ts
    }
    rejected.push(
      `${candidate.label}: found TypeScript ${ts?.version ?? 'of an unknown version'}, which does not export the TypeScript 5/6 ` +
        'compiler API (createSourceFile, getScriptKindFromFileName, ScriptKind) the registry build needs'
    )
  }

  throw new Error(
    'Parsing route-level exports out of a theme template requires the TypeScript 5 or 6 compiler API, but no candidate provided it:\n' +
      rejected.map(reason => `  - ${reason}`).join('\n')
  )
}

/**
 * The TypeScript compiler, resolved from core first and then from the project: it is
 * a dependency of core, so it is always found there regardless of the TypeScript
 * version the project itself has installed; the project is a fallback for setups
 * where core's own copy is not reachable from this file's location on disk.
 */
function loadTypeScript() {
  if (!typescriptModulePromise) {
    typescriptModulePromise = selectTypeScriptModule([
      { label: '@nextsparkjs/core', load: () => import('typescript') },
      { label: `the project at ${rootDir}`, load: async () => createRequire(join(rootDir, 'package.json'))('typescript') },
    ])
  }
  return typescriptModulePromise
}

let nextParseModulePromise = null

/**
 * Next.js's own module parser (SWC), resolved from the project and then from
 * core, or null when neither has Next.js.
 */
function loadNextParseModule() {
  if (!nextParseModulePromise) {
    const path = 'next/dist/build/analysis/parse-module'
    nextParseModulePromise = Promise.resolve()
      .then(() => createRequire(join(rootDir, 'package.json'))(path))
      .catch(() => createRequire(import.meta.url)(path))
      .then(module => module.parseModule, () => null)
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
 * Parse a theme template's source and split its route-level exports into:
 * - `segmentConfig`: segment config keys that resolve to a literal value the
 *   generated route file can re-declare (`{ name: value }`).
 * - `moduleExports`: exported names (functions, `metadata`, etc.) the
 *   generated route file can safely forward with `export { ... } from`.
 * - `hasDefaultExport`: whether it exports a component as default, read from
 *   the syntax tree so a comment or string mentioning `export default` doesn't
 *   count and `export { Layout as default }` does.
 *
 * A segment config key that IS exported but not as a literal `export const`
 * (an expression, an identifier, `let`/`var`, a re-export, or a value the
 * Next.js schema rejects) throws instead of silently dropping it - Next.js
 * would otherwise ignore the value and fall back to its default, and nothing
 * in the build would say so beyond a console warning.
 */
export async function extractRouteExports(source, filePath) {
  const ts = await loadTypeScript()
  // Parsed as its own kind of file: a TSX parse reads TypeScript-only syntax in a
  // .ts template (`<T>(props) => ...`, `<Props>value`) as JSX and loses what follows
  const sourceFile = ts.createSourceFile(filePath, source, ts.ScriptTarget.Latest, true, ts.getScriptKindFromFileName(filePath))

  // The parser recovers from a syntax error by skipping code, exports included. A
  // template Next.js cannot parse either is reported rather than read in part. One
  // it can is read from what TypeScript recovered, with a warning: Next.js compiles
  // templates with SWC, which may know syntax the installed TypeScript does not (a
  // source phase import, for one).
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

  if (errors.length > 0) {
    throw new Error(errors.join('\n'))
  }

  return { segmentConfig, moduleExports, hasDefaultExport: declaresDefaultExport(sourceFile, ts) }
}

/**
 * Resolve a `@/contents/...` template import path to its file on disk,
 * trying both TSX and TS extensions.
 */
function resolveTemplateFilePath(templatePath) {
  const baseTemplatePath = templatePath
    .replace('@/', rootDir + '/')
    .replace(/\.(tsx|ts)$/, '')
  return existsSync(baseTemplatePath + '.tsx') ? baseTemplatePath + '.tsx' : baseTemplatePath + '.ts'
}

/**
 * Read a template file and extract its route-level exports. A missing file
 * is treated as having none, since a build-time override may point at a
 * template that hasn't been generated yet; a template that fails to parse
 * its segment config is not swallowed the same way, and propagates instead.
 */
async function readRouteExports(templatePath) {
  const absoluteTemplatePath = resolveTemplateFilePath(templatePath)

  let templateContent
  try {
    templateContent = await readFile(absoluteTemplatePath, 'utf8')
  } catch {
    return { segmentConfig: {}, moduleExports: [], hasDefaultExport: false }
  }

  return extractRouteExports(templateContent, absoluteTemplatePath)
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
async function generateRegularPageContent(appPath, templatePath) {
  // Remove .tsx/.ts extension from import path (TypeScript doesn't allow file extensions in imports)
  const templatePathWithoutExtension = templatePath.replace(/\.(tsx|ts)$/, '')

  const { segmentConfig, moduleExports } = await readRouteExports(templatePath)

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
async function generateLayoutPageContent(appPath, componentName, templatePath) {
  if (templatePath) {
    // Remove .tsx/.ts extension from import path (TypeScript doesn't allow file extensions in imports)
    const templatePathWithoutExtension = templatePath.replace(/\.(tsx|ts)$/, '')
    const absoluteTemplatePath = resolveTemplateFilePath(templatePath)

    // Check if template file has a default export (component), and what
    // route-level exports it defines alongside (or instead of) it
    let templateContent = null
    try {
      templateContent = await readFile(absoluteTemplatePath, 'utf8')
    } catch {
      // Can't read the file - fall through to the default-export assumption below
    }

    let hasDefaultExport = true
    let segmentConfig = {}
    let moduleExports = []
    if (templateContent !== null) {
      ;({ segmentConfig, moduleExports, hasDefaultExport } = await extractRouteExports(templateContent, absoluteTemplatePath))
    }

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
      // re-export those and provide a pass-through component
      return `/**
 * Layout template - metadata-only (PROTECTED_RENDER)
 * Template: ${appPath}
 * Generated by: scripts/build-registry.mjs
 */
import type { ReactNode } from 'react'

// Re-export Next.js route-level exports from the theme template
${segmentConfigBlock}${moduleExportsBlock}
// Pass-through component (actual rendering blocked by PROTECTED_RENDER)
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
 * Duplicate a layout file to (templates) directory
 * Uses BUILD-TIME resolution: checks if template override exists and generates direct import
 * NO runtime resolver needed - all decisions made at build time
 *
 * @param {string} sourcePath - Path to original layout in app/
 * @param {string} targetPath - Path to write in app/(templates)/
 * @param {string} layoutPath - Relative layout path (e.g., 'app/dashboard/layout.tsx')
 * @param {Array} templates - All discovered templates (for build-time override check)
 */
async function duplicateLayoutDirect(sourcePath, targetPath, layoutPath, templates) {
  // Create target directory if it doesn't exist
  const targetDir = dirname(targetPath)
  await mkdir(targetDir, { recursive: true })

  // BUILD-TIME CHECK: Does a template override exist for this layout?
  const layoutOverride = templates.find(t =>
    t.appPath === layoutPath && t.templateType === 'layout'
  )

  if (layoutOverride) {
    // Template override exists - generate direct import to it
    const templatePathWithoutExtension = layoutOverride.templatePath.replace(/\.(tsx|ts)$/, '')
    const componentName = `Layout${toPascalCase(layoutPath.replace(/[^\w]/g, '_'))}`

    const { segmentConfig, moduleExports } = await readRouteExports(layoutOverride.templatePath)
    const segmentConfigBlock = renderSegmentConfigBlock(segmentConfig)
    const moduleExportsBlock = renderModuleExportsBlock(moduleExports, templatePathWithoutExtension)
    const forwardedExportsSection = segmentConfigBlock || moduleExportsBlock
      ? `\n// Re-export Next.js route-level exports from the theme template\n${segmentConfigBlock}${moduleExportsBlock}`
      : ''

    const content = `/**
 * Layout with template override - directly imports from theme
 * Template: ${layoutPath}
 * Override: ${layoutOverride.templatePath}
 * Generated by: scripts/build-registry.mjs (build-time resolution)
 */
import TemplateLayout from '${templatePathWithoutExtension}'

export default TemplateLayout
${forwardedExportsSection}`
    await writeFile(targetPath, content, 'utf8')
    verbose(`Generated layout with template override: ${layoutPath}`)
    return
  }

  // No override - copy original layout as-is (simple pass-through)
  try {
    const originalContent = await readFile(sourcePath, 'utf8')
    await writeFile(targetPath, originalContent, 'utf8')
    verbose(`Copied original layout: ${layoutPath}`)
  } catch (error) {
    // If reading fails, generate a basic pass-through wrapper
    const componentName = `PassThroughLayout${toPascalCase(layoutPath.replace(/[^\w]/g, '_'))}`
    const basicContent = `/**
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
    await writeFile(targetPath, basicContent, 'utf8')
    verbose(`Generated basic layout wrapper for ${layoutPath}`)
  }
}

/**
 * Generate required parent layouts for a template page
 * Duplicates layouts from app/ to app/(templates)/ to preserve Next.js hierarchy
 * Uses BUILD-TIME resolution to check for template overrides
 *
 * @param {string} appPath - App path (e.g., 'app/dashboard/(main)/posts/page.tsx')
 * @param {string} templatesDir - Output directory for (templates)
 * @param {Array} templates - All discovered templates (for build-time override check)
 */
async function generateRequiredLayouts(appPath, templatesDir, templates) {
  let layoutsGenerated = 0

  // Extract the directory path from app path (remove filename)
  // Example: app/dashboard/(main)/plugins/page.tsx -> dashboard/(main)/plugins
  const pathParts = appPath.replace('app/', '').replace(/\/[^\/]+$/, '').split('/')

  // Generate all parent directories and check for layouts
  let currentPath = ''
  for (const part of pathParts) {
    if (!part) continue

    currentPath = currentPath ? `${currentPath}/${part}` : part
    const layoutPath = `app/${currentPath}/layout.tsx`
    const coreLayoutPath = join(rootDir, layoutPath)
    const templateLayoutPath = join(templatesDir, `${currentPath}/layout.tsx`)

    // Check if core layout exists and template layout doesn't
    if (existsSync(coreLayoutPath) && !existsSync(templateLayoutPath)) {
      // Pass templates for build-time override resolution
      await duplicateLayoutDirect(coreLayoutPath, templateLayoutPath, layoutPath, templates)
      layoutsGenerated++
    }
  }

  return layoutsGenerated
}

/**
 * Generate a single template page with template override system
 */
export async function generateTemplatePage(template, outputPath) {
  const { appPath, templateType, name, templatePath } = template

  // Create directory if it doesn't exist
  const dir = dirname(outputPath)
  await mkdir(dir, { recursive: true })

  // Determine the component name and content based on template type
  const routeSegments = name.split('/').filter(segment => !segment.startsWith('[') && !segment.endsWith(']'))
  const routeName = routeSegments[routeSegments.length - 1] || 'page'
  const componentName = `AutoGenerated${toPascalCase(routeName)}${toPascalCase(templateType)}`

  let content

  if (templateType === 'layout') {
    content = await generateLayoutPageContent(appPath, componentName, templatePath)
  } else {
    content = await generateRegularPageContent(appPath, templatePath)
  }

  // Write the file
  await writeFile(outputPath, content, 'utf8')
  verbose(`Generated: ${outputPath.replace(rootDir, '')}`)
}

/**
 * Generate missing pages for templates with layout duplication
 * Creates pages in app/(templates)/ with necessary layouts duplicated
 * Only generates pages for templates that actually exist
 *
 * @param {Array} templates - List of template definitions
 * @param {Object} config - Configuration object with projectRoot
 */
export async function generateMissingPages(templates, config = null) {
  // Use config.projectRoot if provided, otherwise fall back to default rootDir
  if (config?.projectRoot) {
    rootDir = config.projectRoot
  }
  const templatesDir = join(rootDir, 'app', '(templates)')

  // First, clean up orphaned files before generating new ones
  // Note: This is also called in registry.mjs before generateMissingPages,
  // but we keep it here for standalone usage of this function
  await cleanupOrphanedTemplates(templates, config)

  if (templates.length === 0) {
    return
  }

  let generated = 0
  let layoutsDuplicated = 0

  // Track all unique directory paths that need layouts
  const layoutPathsNeeded = new Set()

  // Group templates by their directory path to identify needed layouts
  const templatesByPath = new Map()

  for (const template of templates) {
    const { appPath, templateType } = template
    const templatePagePath = join(rootDir, 'app', '(templates)', appPath.replace('app/', ''))

    // Track the directory path for layout generation
    layoutPathsNeeded.add(appPath)

    // Check if core page exists (skip generation if it does)
    // IMPORTANT: Always generate layouts, even if core layout exists
    const corePagePath = join(rootDir, appPath)
    if (existsSync(corePagePath) && templateType !== 'layout') {
      continue
    }

    // Track template for potential generation/update
    templatesByPath.set(appPath, { template, templatePagePath })
  }

  // Generate required layouts for ALL template page directories (even if layout override doesn't exist)
  // This ensures that pages in app/(templates)/ have the necessary layout hierarchy
  // Extract unique directories from all templates (not just layout templates)
  const uniqueDirectories = new Set()
  for (const template of templates) {
    const { appPath } = template
    // Extract directory path from page path
    const dirPath = appPath.replace(/\/[^\/]+$/, '')
    uniqueDirectories.add(dirPath)
  }

  for (const dirPath of uniqueDirectories) {
    // Pass templates for build-time override resolution
    const layoutsGenerated = await generateRequiredLayouts(`${dirPath}/page.tsx`, templatesDir, templates)
    layoutsDuplicated += layoutsGenerated
  }

  // Generate or update template pages (regenerate if content differs - e.g., theme changed)
  let updated = 0
  for (const [appPath, { template, templatePagePath }] of templatesByPath) {
    const { templateType, name, templatePath } = template

    // Generate expected content
    const routeSegments = name.split('/').filter(segment => !segment.startsWith('[') && !segment.endsWith(']'))
    const routeName = routeSegments[routeSegments.length - 1] || 'page'
    const componentName = `AutoGenerated${toPascalCase(routeName)}${toPascalCase(templateType)}`

    let expectedContent
    if (templateType === 'layout') {
      expectedContent = await generateLayoutPageContent(appPath, componentName, templatePath)
    } else {
      expectedContent = await generateRegularPageContent(appPath, templatePath)
    }

    // Check if file exists and compare content
    if (existsSync(templatePagePath)) {
      try {
        const currentContent = await readFile(templatePagePath, 'utf8')
        if (currentContent === expectedContent) {
          // Content matches, skip
          continue
        }
        // Content differs (theme changed), update file
        await writeFile(templatePagePath, expectedContent, 'utf8')
        updated++
        verbose(`Updated (theme changed): ${templatePagePath.replace(rootDir, '')}`)
      } catch (error) {
        // Error reading, regenerate
        await generateTemplatePage(template, templatePagePath)
        generated++
      }
    } else {
      // File doesn't exist, generate
      await generateTemplatePage(template, templatePagePath)
      generated++
    }
  }

  if (generated > 0 || updated > 0 || layoutsDuplicated > 0) {
    const parts = []
    if (generated > 0) parts.push(`${generated} new`)
    if (updated > 0) parts.push(`${updated} updated`)
    if (layoutsDuplicated > 0) parts.push(`${layoutsDuplicated} layouts`)
    log(`Template pages: ${parts.join(', ')}`, 'success')
  } else {
    verbose('All template pages up to date')
  }
}
