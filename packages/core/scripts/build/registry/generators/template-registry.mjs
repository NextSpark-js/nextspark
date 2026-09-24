/**
 * Template Registry Generator
 *
 * Generates template-registry.ts and template-registry.client.ts
 *
 * @module core/scripts/build/registry/generators/template-registry
 */

import { lstat, readdir, readFile } from 'fs/promises'
import { join, dirname, relative, sep } from 'path'
import { fileURLToPath } from 'url'

import { verbose } from '../../../utils/index.mjs'
import {
  canOverrideComponent,
  canOverrideMetadata,
  isProtectedPath
} from '../../../../dist/config/protected-paths.js'
import { convertCorePath } from '../config.mjs'
import { projectGeneratedAppDir } from '../project-mode.mjs'
import { analyzeTemplates, routeFileAction, templateAnalysisFor } from '../post-build/page-generator.mjs'
import { loadTypeScriptFor } from '../shared/typescript-compiler.mjs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)
// Path from packages/core/scripts/build/registry/generators/ to project root
// packages/core/scripts/build/registry/generators -> packages/core/scripts/build/registry -> packages/core/scripts/build -> packages/core/scripts -> packages/core -> packages -> root
const rootDir = join(__dirname, '../../../../../..')

/**
 * The analysis a generator works from: the one the registry build passes in,
 * or - for a caller using the signature without it - one taken for this call,
 * against the project root template files are resolved from here.
 */
async function analysisFor(templates, config, analysis) {
  return analysis ?? analyzeTemplates(templates, { projectRoot: config?.projectRoot || rootDir })
}

/**
 * Group templates by app path (highest priority first), each with whether its
 * highest-priority template has a default export. That answer comes from
 * `analyzeTemplates`, which parsed the template once for the whole build: the
 * server registry, the client registry and the page generator all take it
 * from there, so none of them can see a different version of the file.
 */
function resolveTemplateEntries(templates, analysis) {
  const templatesByPath = {}

  templates.forEach(template => {
    if (!templatesByPath[template.appPath]) {
      templatesByPath[template.appPath] = []
    }
    templatesByPath[template.appPath].push(template)
  })

  Object.keys(templatesByPath).forEach(appPath => {
    templatesByPath[appPath].sort((a, b) => b.priority - a.priority)
  })

  // A template whose route file would break is rejected here too, whoever built the analysis
  for (const template of templates) {
    routeFileAction(template, templateAnalysisFor(analysis, template))
  }

  return Object.entries(templatesByPath).map(([appPath, pathTemplates]) => {
    const highestPriorityTemplate = pathTemplates[0]
    const { hasDefaultExport } = templateAnalysisFor(analysis, highestPriorityTemplate)
    return { appPath, pathTemplates, highestPriorityTemplate, hasDefaultExport }
  })
}

/**
 * Generate the template registry file
 * @param {Array} templates - Discovered templates
 * @param {object} config - Configuration object from getConfig()
 * @param {Map} [analysis] - What `analyzeTemplates` read from these templates; taken for this call when omitted
 * @returns {Promise<string>} Generated TypeScript content
 */
export async function generateTemplateRegistry(templates, config, analysis = null) {
  const entries = resolveTemplateEntries(templates, await analysisFor(templates, config, analysis))

  // Generate registry entries. Each component is a deferred import, so a route
  // pulls in the template it renders and no others.
  const registryEntries = entries
    .map(({ appPath, pathTemplates, highestPriorityTemplate, hasDefaultExport }) => {
      // Strip .tsx/.ts extension - Next.js resolves extensions automatically on all platforms
      let templatePath = highestPriorityTemplate.templatePath
      if (templatePath.endsWith('.tsx')) {
        templatePath = templatePath.slice(0, -4)
      } else if (templatePath.endsWith('.ts')) {
        templatePath = templatePath.slice(0, -3)
      }

      // Metadata-only templates (PROTECTED_RENDER, standalone .meta.ts, or a
      // template with no default export) have no component to load
      const isMetaOnly = highestPriorityTemplate.fileName?.endsWith('.meta.ts')
      const componentRef = canOverrideComponent(appPath) && !isMetaOnly && hasDefaultExport
        ? `lazyTemplate('${appPath}', () => import('${templatePath}'))`
        : 'null'

      return `  '${appPath}': {
    appPath: '${appPath}',
    component: ${componentRef},
    template: ${JSON.stringify(highestPriorityTemplate, null, 4).replace(/^/gm, '    ')},
    alternatives: ${JSON.stringify(pathTemplates.slice(1), null, 4).replace(/^/gm, '    ')}
  }`
    })
    .join(',\n')

  // Generate utility functions for template resolution
  const templatePaths = entries.map(({ appPath }) => appPath)
  const templateTypeMap = {}

  templates.forEach(template => {
    if (!templateTypeMap[template.templateType]) {
      templateTypeMap[template.templateType] = []
    }
    templateTypeMap[template.templateType].push(template.appPath)
  })

  return `/**
 * Auto-generated Template Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Templates discovered: ${templates.length}
 * App paths with overrides: ${templatePaths.length}
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build-registry.mjs
 */

import React from 'react'

/**
 * Wrap a template module in an async Server Component that imports it while
 * rendering, so a route's bundle carries the template it renders instead of
 * every template in the app.
 *
 * Deliberately not next/dynamic: that wraps the component in a Suspense
 * boundary, which would let a response commit a 200 before a template's own
 * notFound() could run (#129). An async component has no such boundary — it
 * awaits exactly like the data fetching these routes already do.
 */
function lazyTemplate(appPath: string, loader: () => Promise<{ default: any }>) {
  return async function TemplateOverride(props: any) {
    const templateModule = await loader()

    // A template with no default export used to fall back to the app's own
    // component; now that the module is only read at render time, name the
    // template that is wrong instead of failing as an invalid element type.
    if (!templateModule.default) {
      throw new Error(
        'Template override for "' + appPath + '" has no default export. ' +
        'Add a default export to the template, or remove it from the theme.'
      )
    }

    return React.createElement(templateModule.default, props)
  }
}

export interface TemplateOverride {
  name: string
  themeName: string
  templateType: string
  fileName: string
  relativePath: string
  appPath: string
  templatePath: string
  priority: number
  metadata?: any
}

export interface TemplateRegistryEntry {
  appPath: string
  component: any
  template: TemplateOverride
  alternatives: TemplateOverride[]
}

export const TEMPLATE_REGISTRY: Record<string, TemplateRegistryEntry> = {
${registryEntries}
}

export type TemplatePath = keyof typeof TEMPLATE_REGISTRY extends never ? string : keyof typeof TEMPLATE_REGISTRY

/**
 * Template registry metadata
 */
export const TEMPLATE_METADATA = {
  totalTemplates: ${templates.length},
  uniquePaths: ${templatePaths.length},
  templateTypes: ${JSON.stringify(Object.keys(templateTypeMap))},
  themeDistribution: ${JSON.stringify(
    templates.reduce((acc, t) => {
      acc[t.themeName] = (acc[t.themeName] || 0) + 1
      return acc
    }, {})
  )},
  generatedAt: '${new Date().toISOString()}',
  paths: [${templatePaths.map(p => `'${p}'`).join(', ')}]
}
`
}

/**
 * Check if a template file has server-only exports
 * Server-only exports: generateMetadata, generateStaticParams, revalidate, dynamic, fetchCache, runtime
 * @param {string} filePath - Path to the template file
 * @returns {Promise<boolean>} Whether the file has server-only exports
 */
async function hasServerOnlyExports(filePath, projectRoot) {
  try {
    const content = await readFile(filePath, 'utf8')
    // Prefer the compiler's import declarations: unlike a source scan they
    // distinguish a real import from a comment/string and cover multiline
    // named imports as well as the usual side-effect `import 'server-only'`.
    try {
      const ts = await loadTypeScriptFor(projectRoot)
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true,
        ts.getScriptKindFromFileName(filePath)
      )
      for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
          if (statement.moduleSpecifier.text === 'next/headers' || statement.moduleSpecifier.text === 'server-only') {
            return true
          }
        }
      }
    } catch {
      // A project without the compiler API can still use the deliberately
      // anchored fallback below. The other checks have always been scans.
    }
    // Check for server-only function exports
    const serverFunctionExports = [
      /export\s+(async\s+)?function\s+generateMetadata/,
      /export\s+(async\s+)?function\s+generateStaticParams/,
    ]
    // Check for server-only const exports
    const serverConstExports = [
      /export\s+const\s+revalidate\s*=/,
      /export\s+const\s+dynamic\s*=/,
      /export\s+const\s+fetchCache\s*=/,
      /export\s+const\s+runtime\s*=/,
      /export\s+const\s+metadata\s*[=:]/,
    ]

    // Check for server-only module imports
    const serverOnlyImports = [
      /(?:^|[;\r\n])\s*import\s+(?:type\s+)?(?:(?:[\w*$][^;'"`]*?)\s+from\s+)?(['"])next\/headers\1\s*;?/m,
      /(?:^|[;\r\n])\s*import\s+(?:type\s+)?(?:(?:[\w*$][^;'"`]*?)\s+from\s+)?(['"])server-only\1\s*;?/m,
    ]

    // Check if default export is an async function (server component marker in Next.js)
    // async components cannot be used in 'use client' files
    const asyncDefaultExport = [
      /export\s+default\s+async\s+function/,
    ]

    for (const pattern of [...serverFunctionExports, ...serverConstExports, ...serverOnlyImports, ...asyncDefaultExport]) {
      if (pattern.test(content)) {
        return true
      }
    }
    return false
  } catch {
    return false
  }
}

/**
 * Generate client-safe template registry with deferred imports
 * Only includes page templates that can be safely imported in client components
 * Excludes templates with server-only exports (generateMetadata, revalidate, etc.)
 * @param {Array} templates - Discovered templates
 * @param {object} config - Configuration object from getConfig()
 * @param {Map} [analysis] - What `analyzeTemplates` read from these templates; taken for this call when omitted
 * @returns {Promise<string>} Generated TypeScript content
 */
export async function generateTemplateRegistryClient(templates, config, analysis = null) {
  const outputFilePath = join(config.outputDir, 'template-registry.client.ts')
  const projectRoot = config.projectRoot || rootDir
  const entries = resolveTemplateEntries(templates, await analysisFor(templates, config, analysis))

  // Filter for client-compatible templates: pages and layouts, not protected,
  // with a default export according to the build's analysis - the same answer
  // the server registry uses. Also exclude templates with server-only exports.
  const clientCompatibleTemplatesPromises = entries
    .filter(({ appPath, highestPriorityTemplate, hasDefaultExport }) =>
      (highestPriorityTemplate.templateType === 'page' || highestPriorityTemplate.templateType === 'layout') &&
      canOverrideComponent(appPath) &&
      hasDefaultExport
    )
    .map(async ({ appPath, highestPriorityTemplate }) => {
      // Get actual file path from template path
      // Template paths may or may not have extension, ensure we check the .tsx file
      let actualFilePath = highestPriorityTemplate.templatePath.replace('@/', projectRoot + '/')
      // If path doesn't end with .tsx or .ts, add .tsx
      if (!actualFilePath.endsWith('.tsx') && !actualFilePath.endsWith('.ts')) {
        actualFilePath += '.tsx'
      }

      // Check for server-only exports
      const hasServerExports = await hasServerOnlyExports(actualFilePath, projectRoot)
      if (hasServerExports) {
        verbose(`Excluding ${appPath} from client registry (has server-only exports)`)
        return null
      }
      return { appPath, highestPriorityTemplate }
    })

  const clientCompatibleTemplatesResults = await Promise.all(clientCompatibleTemplatesPromises)
  const clientCompatibleTemplates = clientCompatibleTemplatesResults.filter(Boolean)

  // Generate registry entries as deferred imports, so a route loads the
  // template it renders and no others
  const registryEntries = clientCompatibleTemplates
    .map(({ appPath, highestPriorityTemplate }) => {
      // Strip .tsx/.ts extension - Next.js resolves extensions automatically on all platforms
      let templatePath = highestPriorityTemplate.templatePath
      if (templatePath.endsWith('.tsx')) {
        templatePath = templatePath.slice(0, -4)
      } else if (templatePath.endsWith('.ts')) {
        templatePath = templatePath.slice(0, -3)
      }
      return `  '${appPath}': dynamic(() => import('${templatePath}'))`
    })
    .join(',\n')

  return `/**
 * Auto-generated Client Template Registry
 *
 * Generated at: ${new Date().toISOString()}
 * Client-compatible templates: ${clientCompatibleTemplates.length}
 *
 * DO NOT EDIT - This file is auto-generated by scripts/build-registry.mjs
 */

'use client'

import { ComponentType } from 'react'
import dynamic from 'next/dynamic'
import { isProtectedPath } from '${convertCorePath('@/core/config/protected-paths', outputFilePath, config)}'

// Client-safe registry of deferred imports (auto-generated).
// next/dynamic rather than a static import: these are client components, so
// the lazy binding needs the Suspense boundary next/dynamic provides.
const CLIENT_TEMPLATE_REGISTRY: Record<string, ComponentType<any>> = {
${registryEntries}
}

/**
 * Check if template override exists (client-safe)
 */
export function hasTemplateOverrideClient(appPath: string): boolean {
  return appPath in CLIENT_TEMPLATE_REGISTRY
}

/**
 * Get template component (client-safe)
 * Use this in client components to avoid metadata conflicts
 */
export function getTemplateOrDefaultClient<T extends ComponentType<any>>(
  appPath: string,
  defaultComponent: T
): T {
  // Check if path is protected
  if (isProtectedPath(appPath)) {
    return defaultComponent
  }

  // Check if template override exists
  if (!hasTemplateOverrideClient(appPath)) {
    return defaultComponent
  }

  // Return statically imported template component
  const TemplateComponent = CLIENT_TEMPLATE_REGISTRY[appPath]
  return TemplateComponent as T
}

/**
 * Higher-order component for template overrides (client-safe)
 */
export function withTemplateOverrideForClient<P extends object>(appPath: string) {
  return function<T extends ComponentType<P>>(WrappedComponent: T): T {
    return getTemplateOrDefaultClient(appPath, WrappedComponent)
  }
}
`
}

// Route scopes deliberately contain their own, small registry. In particular,
// do not import TemplateService or the full template registry here: a route
// importing a scope must not reconnect its bundle to every theme template.
const SCOPE_MARKER = 'Auto-generated route-scoped template registry'
const TYPE_SCRIPT_ROUTE = /\.(?:tsx|ts)$/

/** Turn an app route filename into its matching safe server/client scope filename. */
function scopeFileFor(appPath, scopeDirectory, client = false) {
  if (typeof appPath !== 'string' || !appPath.startsWith('app/') || !TYPE_SCRIPT_ROUTE.test(appPath)) {
    throw new Error(`Invalid template scope app path: ${String(appPath)}`)
  }
  const route = appPath.slice('app/'.length).replace(TYPE_SCRIPT_ROUTE, '')
  const segments = route.split('/')
  if (!route || segments.some(segment => !segment || segment === '.' || segment === '..' || segment.includes('\\'))) {
    throw new Error(`Invalid template scope app path: ${appPath}`)
  }
  return join(scopeDirectory, client ? 'client' : 'server', `${route}.ts`)
}

/** Read actual route modules without following symlinks or descending into node_modules. */
async function discoverAppRoutePaths(projectRoot) {
  const appDirectory = projectGeneratedAppDir(projectRoot)
  const routePaths = []
  async function visit(directory) {
    let entries
    try {
      entries = await readdir(directory, { withFileTypes: true })
    } catch (error) {
      if (error?.code === 'ENOENT') return
      throw error
    }
    for (const entry of entries) {
      if (entry.name === 'node_modules') continue
      // The registry build writes generated template routes and layout copies
      // here after scopes are planned. They are implementation artifacts, not
      // application routes, so never let a later build turn them into scopes.
      if (directory === appDirectory && entry.name === '(templates)') continue
      const absolute = join(directory, entry.name)
      // Dirent is a hint only; lstat prevents traversing a changed symlink.
      const stat = await lstat(absolute)
      if (stat.isSymbolicLink()) continue
      if (stat.isDirectory()) await visit(absolute)
      else if (stat.isFile() && TYPE_SCRIPT_ROUTE.test(entry.name) && !entry.name.endsWith('.d.ts')) {
        routePaths.push(`app/${relative(appDirectory, absolute).split(sep).join('/')}`)
      }
    }
  }
  await visit(appDirectory)
  return routePaths
}

function scopedServerResolver(outputFilePath, config) {
  const protectedPaths = convertCorePath('@/core/config/protected-paths', outputFilePath, config)
  return `

import { canOverrideComponent, canOverrideMetadata } from '${protectedPaths}'

/**
 * The dynamic application routes need to ask about a runtime-generated
 * app path. Keep this small compatibility surface local to their bounded
 * scope instead of importing the global service, whose registry has every
 * template in the application.
 */
export function hasTemplateOverride(appPath: string): boolean {
  return appPath in TEMPLATE_REGISTRY
}

/** Return the selected component using the global service's get-component semantics. */
export function getTemplateComponent(appPath: string): any | null {
  return TEMPLATE_REGISTRY[appPath]?.component || null
}

/** Resolve only this route's selected template; no global registry is imported. */
export function getTemplateOrDefault<T = any>(appPath: string, defaultComponent: T): T {
  if (!canOverrideComponent(appPath)) return defaultComponent
  const component = TEMPLATE_REGISTRY[appPath]?.component
  return component ? component as T : defaultComponent
}

/** Resolve metadata from only this route's selected template. */
export function getMetadataOrDefault(appPath: string, defaultMetadata: any): any {
  if (!canOverrideMetadata(appPath)) return defaultMetadata
  const metadata = TEMPLATE_REGISTRY[appPath]?.template?.metadata
  return metadata ? metadata : defaultMetadata
}
`
}

const PUBLIC_DYNAMIC_CATCH_ALL_PATH = 'app/(public)/[...slug]/page.tsx'
const DASHBOARD_DYNAMIC_LIST_PATH = 'app/dashboard/(main)/[entity]/page.tsx'
const DASHBOARD_DYNAMIC_DETAIL_PATH = 'app/dashboard/(main)/[entity]/[id]/page.tsx'
const DYNAMIC_SCOPE_PATHS = new Set([
  PUBLIC_DYNAMIC_CATCH_ALL_PATH,
  DASHBOARD_DYNAMIC_LIST_PATH,
  DASHBOARD_DYNAMIC_DETAIL_PATH,
])

function withoutTypeScriptExtension(templatePath) {
  return templatePath.replace(/\.(?:tsx|ts)$/, '')
}

/**
 * Exact route scopes have a compile-time-selected override. Emit that binding
 * directly instead of carrying even a one-entry runtime registry into the
 * route graph. The app route itself stays untouched, so every segment config
 * and arbitrary named export it declares remains exactly where Next.js reads it.
 */
async function generateDirectServerScope(templates, appPath, config, analysis) {
  const [entry] = resolveTemplateEntries(templates, await analysisFor(templates, config, analysis))
  const selected = entry?.highestPriorityTemplate
  const hasOverride = Boolean(selected)
  const hasComponent = Boolean(
    selected &&
    canOverrideComponent(appPath) &&
    !selected.fileName?.endsWith('.meta.ts') &&
    entry.hasDefaultExport
  )
  const componentImport = hasComponent
    ? `import SelectedTemplate from '${withoutTypeScriptExtension(selected.templatePath)}'\n`
    : ''
  const componentValue = hasComponent ? 'SelectedTemplate' : 'null'
  const metadata = JSON.stringify(selected?.metadata ?? null, null, 2)

  return `${componentImport}
const APP_PATH = ${JSON.stringify(appPath)}
const HAS_OVERRIDE = ${hasOverride}
const COMPONENT_OVERRIDE_ALLOWED = ${canOverrideComponent(appPath)}
const METADATA_OVERRIDE_ALLOWED = ${canOverrideMetadata(appPath)}
const TemplateComponent: any = ${componentValue}
const templateMetadata: any = ${metadata}

export function hasTemplateOverride(candidatePath: string): boolean {
  return HAS_OVERRIDE && candidatePath === APP_PATH
}

export function getTemplateComponent(candidatePath: string): any | null {
  return candidatePath === APP_PATH ? TemplateComponent : null
}

export function getTemplateOrDefault<T = any>(candidatePath: string, defaultComponent: T): T {
  if (candidatePath !== APP_PATH || !COMPONENT_OVERRIDE_ALLOWED || !TemplateComponent) return defaultComponent
  return TemplateComponent as T
}

export function getMetadataOrDefault(candidatePath: string, defaultMetadata: any): any {
  if (candidatePath !== APP_PATH || !METADATA_OVERRIDE_ALLOWED || !templateMetadata) return defaultMetadata
  return templateMetadata
}
`
}

async function generateDirectClientScope(templates, appPath, config, analysis) {
  const [entry] = resolveTemplateEntries(templates, await analysisFor(templates, config, analysis))
  const selected = entry?.highestPriorityTemplate
  let hasComponent = Boolean(
    selected &&
    (selected.templateType === 'page' || selected.templateType === 'layout') &&
    entry.hasDefaultExport &&
    canOverrideComponent(appPath)
  )

  if (hasComponent) {
    let actualFilePath = selected.templatePath.replace('@/', (config.projectRoot || rootDir) + '/')
    if (!actualFilePath.endsWith('.tsx') && !actualFilePath.endsWith('.ts')) actualFilePath += '.tsx'
    hasComponent = !(await hasServerOnlyExports(actualFilePath, config.projectRoot || rootDir))
  }

  const componentImport = hasComponent
    ? `import SelectedTemplate from '${withoutTypeScriptExtension(selected.templatePath)}'\n`
    : ''
  const componentValue = hasComponent ? 'SelectedTemplate' : 'null'

  return `'use client'

import type { ComponentType } from 'react'
${componentImport}
const APP_PATH = ${JSON.stringify(appPath)}
const HAS_OVERRIDE = ${hasComponent}
const TEMPLATE_OVERRIDE_ALLOWED = ${!isProtectedPath(appPath)}
const TemplateComponent: ComponentType<any> | null = ${componentValue}

export function hasTemplateOverrideClient(candidatePath: string): boolean {
  return HAS_OVERRIDE && candidatePath === APP_PATH
}

export function getTemplateOrDefaultClient<T extends ComponentType<any>>(
  candidatePath: string,
  defaultComponent: T
): T {
  if (candidatePath !== APP_PATH || !TEMPLATE_OVERRIDE_ALLOWED || !TemplateComponent) return defaultComponent
  return TemplateComponent as T
}

export function withTemplateOverrideForClient<P extends object>(appPath: string) {
  return function<T extends ComponentType<P>>(WrappedComponent: T): T {
    return getTemplateOrDefaultClient(appPath, WrappedComponent)
  }
}
`
}

/**
 * The dynamic routes construct their target template path from an entity at
 * runtime. Their scope therefore needs the possible templates for *that
 * route family*, rather than an exact path that cannot be known at build time.
 *
 * These predicates intentionally describe the strings built in the three route
 * modules. Do not widen them to an area prefix: doing so would recreate the
 * full-registry fan-out this generator exists to avoid.
 */
function isPublicDynamicEntityTemplate(appPath) {
  return /^app\/\(public\)\/(?:.+\/)?\[(?:slug|entity)\]\/page\.(?:tsx|ts)$/.test(appPath)
}

function isDashboardDynamicDetailTemplate(appPath) {
  return /^app\/dashboard\/\(main\)\/[^/]+\/\[id\]\/page\.(?:tsx|ts)$/.test(appPath)
}

function isDashboardDynamicListTemplate(appPath) {
  return /^app\/dashboard\/\(main\)\/[^/]+\/page\.(?:tsx|ts)$/.test(appPath)
}

function dynamicFamilyForTemplate(appPath, discoveredRoutePaths) {
  // A real app route wins over a dynamic sibling in Next.js routing, so its
  // override belongs only to that route's exact scope.
  if (discoveredRoutePaths.has(appPath)) return null
  if (isPublicDynamicEntityTemplate(appPath)) return PUBLIC_DYNAMIC_CATCH_ALL_PATH
  if (isDashboardDynamicListTemplate(appPath)) return DASHBOARD_DYNAMIC_LIST_PATH
  if (isDashboardDynamicDetailTemplate(appPath)) return DASHBOARD_DYNAMIC_DETAIL_PATH
  return null
}

function hasBracketSegment(appPath) {
  return appPath.split('/').some(segment => /^\[[^/]+\]$/.test(segment))
}

function assertKnownRuntimeTemplatedPaths(templates, discoveredRoutePaths, analysis) {
  for (const template of templates) {
    if (
      hasBracketSegment(template.appPath) &&
      !discoveredRoutePaths.has(template.appPath) &&
      // A project-only template is an exact route: generateMissingPages will
      // materialize it later in this same build.
      !templateAnalysisFor(analysis, template).generatesRoute &&
      !dynamicFamilyForTemplate(template.appPath, discoveredRoutePaths)
    ) {
      throw new Error(
        `Unsupported runtime-templated app path "${template.appPath}": it is not an existing app route ` +
        'or a member of a known dynamic route family. Add explicit family handling before generating its scope.'
      )
    }
  }
}

function templatesForScope(templates, scopeAppPath, discoveredRoutePaths) {
  return templates.filter(template => {
    if (template.appPath === scopeAppPath) return true
    return dynamicFamilyForTemplate(template.appPath, discoveredRoutePaths) === scopeAppPath
  })
}

/**
 * Fail while constructing the complete write plan if two app route extensions
 * normalize to the same scope module. This happens before registry.mjs can
 * delete stale files or write any replacement scopes.
 */
function assertUniqueScopeOutputs(appPaths, scopeDirectory) {
  const outputs = new Map()
  for (const appPath of appPaths) {
    for (const client of [false, true]) {
      const outputPath = scopeFileFor(appPath, scopeDirectory, client)
      const previous = outputs.get(outputPath)
      if (previous && previous !== appPath) {
        throw new Error(
          `Ambiguous template scope output ${outputPath}: both ${previous} and ${appPath} normalize to this file. ` +
          'Keep only one route extension (.ts or .tsx) for the route before generating registries.'
        )
      }
      outputs.set(outputPath, appPath)
    }
  }
}

/**
 * Generate route-scoped server/client modules as paths and content. The build
 * writes this plan via safe-fs; empty scopes preserve a route fallback when a
 * theme change removes its override.
 */
export async function generateTemplateScopeRegistries(templates, config, analysis = null) {
  const scopeDirectory = join(config.outputDir, 'template-scopes')
  const resolvedAnalysis = await analysisFor(templates, config, analysis)
  const discoveredRoutePaths = new Set(await discoverAppRoutePaths(config.projectRoot))
  assertKnownRuntimeTemplatedPaths(templates, discoveredRoutePaths, resolvedAnalysis)
  const paths = new Set(discoveredRoutePaths)
  for (const template of templates) paths.add(template.appPath)
  assertUniqueScopeOutputs(paths, scopeDirectory)
  const files = []
  for (const appPath of [...paths].sort()) {
    const selected = templatesForScope(templates, appPath, discoveredRoutePaths)
    const serverPath = scopeFileFor(appPath, scopeDirectory)
    const clientPath = scopeFileFor(appPath, scopeDirectory, true)
    const dynamicScope = DYNAMIC_SCOPE_PATHS.has(appPath)
    const serverRegistry = dynamicScope
      ? `${await generateTemplateRegistry(selected, config, resolvedAnalysis)}${scopedServerResolver(serverPath, config)}`
      : await generateDirectServerScope(selected, appPath, config, resolvedAnalysis)
    const clientRegistry = dynamicScope
      ? await generateTemplateRegistryClient(selected, config, resolvedAnalysis)
      : await generateDirectClientScope(selected, appPath, config, resolvedAnalysis)
    files.push(
      { path: serverPath, content: `/** ${SCOPE_MARKER}; do not edit. */\nimport 'server-only'\n${serverRegistry}` },
      { path: clientPath, content: `/** ${SCOPE_MARKER}; do not edit. */\n${clientRegistry}` }
    )
  }
  return { directory: scopeDirectory, files }
}

/** Marker used to restrict stale cleanup to files this generator owns. */
export { SCOPE_MARKER }
