#!/usr/bin/env node

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  generateTemplateRegistry,
  generateTemplateScopeRegistries,
} from '../../packages/core/scripts/build/registry/generators/template-registry.mjs'
import {
  analyzeTemplates,
  generateMissingPages,
} from '../../packages/core/scripts/build/registry/post-build/page-generator.mjs'

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..')
const FIXTURE_ROOT = join(REPO_ROOT, '.e2e/template-route-conformance')
const REGISTRIES = join(FIXTURE_ROOT, '.nextspark/registries')
const NEXT_BIN = join(REPO_ROOT, 'node_modules/next/dist/bin/next')
const CORE_ROUTE = 'app/core/page.tsx'
const PROJECT_ROUTE = 'app/project/page.tsx'
const PROJECT_BRACKET_ROUTE = 'app/shop/[category]/page.tsx'
const DASHBOARD_DYNAMIC_ROUTE = 'app/dashboard/(main)/[entity]/page.tsx'
const DASHBOARD_LITERAL_ROUTE = 'app/dashboard/(main)/media/page.tsx'
const DASHBOARD_MEMBER_TEMPLATE = 'dashboard/(main)/agent-multi/page.tsx'
const DASHBOARD_LITERAL_TEMPLATE = 'dashboard/(main)/media/page.tsx'

async function write(relativePath, content) {
  const path = join(FIXTURE_ROOT, relativePath)
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, content, 'utf8')
}

function template(relativePath, overrides = {}) {
  const fileName = relativePath.split('/').at(-1)
  const appPath = `app/${relativePath}`
  return {
    name: relativePath.replace(/\.(?:tsx|ts)$/, ''),
    themeName: 'fixture',
    templateType: fileName.replace(/\.(?:tsx|ts)$/, ''),
    fileName,
    relativePath,
    appPath,
    templatePath: `@/contents/themes/fixture/templates/${relativePath}`,
    priority: 100,
    metadata: null,
    ...overrides,
  }
}

function coreRoute(importPath) {
  return `import { getTemplateOrDefault } from '${importPath}'

export const dynamic = 'force-static'
export const revalidate = 60
export const dynamicParams = false
export const runtime = 'nodejs'

export async function generateMetadata() {
  return { title: 'Core route' }
}

export async function generateStaticParams() {
  return []
}

function CoreDefaultPage() {
  return <p>core fallback</p>
}

export default getTemplateOrDefault('${CORE_ROUTE}', CoreDefaultPage)
`
}

function dashboardDynamicRoute(importPath) {
  return `import type { ComponentType } from 'react'
import { getTemplateOrDefault } from '${importPath}'

export default async function DashboardEntityPage({ params }: { params: Promise<{ entity: string }> }) {
  const { entity } = await params
  const appPath = \`app/dashboard/(main)/\${entity}/page.tsx\`
  const SpecificTemplate = getTemplateOrDefault(appPath, null) as ComponentType | null
  return SpecificTemplate ? <SpecificTemplate /> : <p>dynamic fallback</p>
}
`
}

function literalDashboardRoute(importPath) {
  return `import { getTemplateOrDefault } from '${importPath}'

function MediaPage() {
  return <p>media fallback</p>
}

export default getTemplateOrDefault('${DASHBOARD_LITERAL_ROUTE}', MediaPage)
`
}

async function createFixture() {
  await rm(FIXTURE_ROOT, { recursive: true, force: true })
  await mkdir(FIXTURE_ROOT, { recursive: true })
  await symlink(join(REPO_ROOT, 'apps/dev/node_modules'), join(FIXTURE_ROOT, 'node_modules'), 'dir')
  await write('package.json', JSON.stringify({
    name: 'nextspark-template-route-conformance',
    private: true,
    type: 'module',
    dependencies: {
      next: '16.3.5',
      react: '19.2.4',
      'react-dom': '19.2.4',
    },
    devDependencies: {
      '@types/node': '20.19.27',
      '@types/react': '19.2.7',
      typescript: '5.9.3',
    },
  }, null, 2))
  await write('next.config.mjs', 'export default {}\n')
  await write('next-env.d.ts', '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n')
  await write('tsconfig.json', JSON.stringify({
    compilerOptions: {
      target: 'ES2022',
      lib: ['dom', 'dom.iterable', 'esnext'],
      strict: true,
      noEmit: true,
      module: 'esnext',
      moduleResolution: 'bundler',
      jsx: 'react-jsx',
      baseUrl: '.',
      paths: {
        '@/*': ['./*'],
        '@nextsparkjs/registries/*': ['./.nextspark/registries/*'],
      },
    },
    include: ['app', 'contents', '.nextspark', 'next-env.d.ts', '.next/types/**/*.ts'],
  }, null, 2))
  await write('app/layout.tsx', `export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html><body>{children}</body></html>
}
`)
  await write('core/config/protected-paths.ts', `export function canOverrideComponent(_appPath: string) { return true }
export function canOverrideMetadata(_appPath: string) { return true }
`)
  await write(CORE_ROUTE, coreRoute('@/baseline-resolver'))
  await write(DASHBOARD_DYNAMIC_ROUTE, dashboardDynamicRoute('@/dynamic-family-reference'))
  await write(
    DASHBOARD_LITERAL_ROUTE,
    literalDashboardRoute('@nextsparkjs/registries/template-scopes/server/dashboard/(main)/media/page'),
  )

  const sharedTemplate = `import ClientBoundary from './client'
export default function RouteTemplate() {
  return <ClientBoundary />
}
`
  const sharedClient = `'use client'
export default function ClientBoundary() {
  return <button type="button">template client boundary</button>
}
`
  await write('contents/themes/fixture/templates/core/page.tsx', sharedTemplate)
  await write('contents/themes/fixture/templates/core/client.tsx', sharedClient)
  await write('contents/themes/fixture/templates/project/page.tsx', sharedTemplate)
  await write('contents/themes/fixture/templates/project/client.tsx', sharedClient)
  await write('contents/themes/fixture/templates/shop/[category]/page.tsx', sharedTemplate)
  await write('contents/themes/fixture/templates/shop/[category]/client.tsx', sharedClient)
  await write(
    `contents/themes/fixture/templates/${DASHBOARD_MEMBER_TEMPLATE}`,
    `import ClientBoundary from './client'
export default function AgentMultiTemplate() { return <ClientBoundary /> }
`,
  )
  await write(
    'contents/themes/fixture/templates/dashboard/(main)/agent-multi/client.tsx',
    `'use client'
import { format } from 'date-fns'
export default function ClientBoundary() { return <p>{typeof format}</p> }
`,
  )
  await write(
    `contents/themes/fixture/templates/${DASHBOARD_LITERAL_TEMPLATE}`,
    `import ClientBoundary from './client'
export default function MediaTemplate() { return <ClientBoundary /> }
`,
  )
  await write(
    'contents/themes/fixture/templates/dashboard/(main)/media/client.tsx',
    `'use client'
import { z } from 'zod'
export default function ClientBoundary() { return <p>{typeof z}</p> }
`,
  )

  const templates = [
    template('core/page.tsx'),
    template('project/page.tsx'),
    template('shop/[category]/page.tsx'),
    template(DASHBOARD_MEMBER_TEMPLATE),
    template(DASHBOARD_LITERAL_TEMPLATE),
  ]
  // Give unrelated templates distinct client dependency graphs. Turbopack
  // deliberately coalesces tiny local modules, while real applications split
  // their UI/vendor dependencies across several chunks. These already-installed
  // packages make the synthetic fan-out visible without adding dependencies.
  const clientImports = [
    ["import { format } from 'date-fns'", 'format'],
    ["import { z } from 'zod'", 'z'],
    ["import { useForm } from 'react-hook-form'", 'useForm'],
    ["import { useQuery } from '@tanstack/react-query'", 'useQuery'],
    ["import { toast } from 'sonner'", 'toast'],
    ["import { Activity } from 'lucide-react'", 'Activity'],
    ["import Image from 'next/image'", 'Image'],
    ["import Link from 'next/link'", 'Link'],
    ["import Script from 'next/script'", 'Script'],
    ["import { useRouter } from 'next/navigation'", 'useRouter'],
    ["import { useTranslations } from 'next-intl'", 'useTranslations'],
    ["import { useMemo } from 'react'", 'useMemo'],
  ]
  for (let index = 0; index < 16; index += 1) {
    const relativePath = `unrelated-${index}/page.tsx`
    const [clientImport, importedName] = clientImports[index % clientImports.length]
    await write(
      `contents/themes/fixture/templates/${relativePath}`,
      `import ClientBoundary from './client'\nexport default function Unrelated() { return <ClientBoundary /> }\n`,
    )
    await write(
      `contents/themes/fixture/templates/unrelated-${index}/client.tsx`,
      `'use client'\n${clientImport}\nexport default function ClientBoundary() { return <p>{typeof ${importedName}}</p> }\n`,
    )
    templates.push(template(relativePath))
  }

  const config = { outputDir: REGISTRIES, projectRoot: FIXTURE_ROOT, isNpmMode: false }
  const analysis = await analyzeTemplates(templates, config)
  const fullRegistry = await generateTemplateRegistry(templates, config, analysis)
  await write('.nextspark/registries/template-registry.ts', fullRegistry)
  await write('baseline-resolver.ts', `import { TEMPLATE_REGISTRY } from '@nextsparkjs/registries/template-registry'
export function getTemplateOrDefault<T>(appPath: string, defaultComponent: T): T {
  return (TEMPLATE_REGISTRY[appPath]?.component as T | undefined) ?? defaultComponent
}
`)

  const scopedRegistry = await generateTemplateRegistry([templates[0]], config, analysis)
  await write('.nextspark/registries/pre-direct-scope.ts', `${scopedRegistry}
export function getTemplateOrDefault<T>(appPath: string, defaultComponent: T): T {
  return (TEMPLATE_REGISTRY[appPath]?.component as T | undefined) ?? defaultComponent
}
`)

  const dynamicFamilyRegistry = await generateTemplateRegistry([templates[3]], config, analysis)
  await write('dynamic-family-reference.ts', `${dynamicFamilyRegistry}
export function getTemplateOrDefault<T>(appPath: string, defaultComponent: T): T {
  return (TEMPLATE_REGISTRY[appPath]?.component as T | undefined) ?? defaultComponent
}
`)

  const scopes = await generateTemplateScopeRegistries(templates, config, analysis)
  const dynamicFamilyScope = scopes.files.find(file =>
    file.path.endsWith('/template-scopes/server/dashboard/(main)/[entity]/page.ts')
  )?.content
  assert.ok(dynamicFamilyScope, 'dynamic entity-list scope must be generated')
  assert.match(dynamicFamilyScope, /dashboard\/\(main\)\/agent-multi\/page/)
  assert.doesNotMatch(dynamicFamilyScope, /dashboard\/\(main\)\/media\/page/)
  const projectBracketScope = scopes.files.find(file =>
    file.path.endsWith('/template-scopes/server/shop/[category]/page.ts')
  )?.content
  assert.ok(projectBracketScope, 'project-only bracket route scope must be generated before its page')
  assert.match(projectBracketScope, /import SelectedTemplate from '@\/contents\/themes\/fixture\/templates\/shop\/\[category\]\/page'/)
  assert.ok(projectBracketScope.includes(`const APP_PATH = ${JSON.stringify(PROJECT_BRACKET_ROUTE)}`))
  assert.doesNotMatch(projectBracketScope, /TEMPLATE_REGISTRY|lazyTemplate|\(\) => import\(/)
  for (const file of scopes.files) {
    await mkdir(dirname(file.path), { recursive: true })
    await writeFile(file.path, file.content, 'utf8')
  }
  await generateMissingPages(templates, config, analysis)
}

function build(label) {
  const result = spawnSync(process.execPath, [NEXT_BIN, 'build', '--turbopack'], {
    cwd: FIXTURE_ROOT,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1', NODE_ENV: 'production' },
    encoding: 'utf8',
    timeout: 300_000,
    maxBuffer: 16 * 1024 * 1024,
  })
  assert.equal(result.status, 0, `${label} build failed\n${result.stdout}\n${result.stderr}`)
  return result
}

// Next 16.3.5 emits the App Router's client graph as one RSC manifest per
// entry instead of the former aggregate .next/app-build-manifest.json.
// Count the same thing here: unique client chunks reachable from that entry.
async function entryChunkCount(entry, relativePath) {
  const source = await readFile(join(FIXTURE_ROOT, '.next/server/app', relativePath), 'utf8')
  const assignment = source.indexOf('= {', source.indexOf('] ='))
  assert.notEqual(assignment, -1, `could not find RSC manifest payload for ${entry}`)
  const manifest = JSON.parse(source.slice(assignment + 2).replace(/;\s*$/, ''))
  const chunks = new Set(
    Object.values(manifest.clientModules ?? {}).flatMap(module => module.chunks ?? [])
  )
  return { entry, chunks: chunks.size }
}

async function chunkCounts() {
  return {
    core: await entryChunkCount('/core/page', 'core/page_client-reference-manifest.js'),
    projectOnly: await entryChunkCount(
      '/(templates)/project/page',
      '(templates)/project/page_client-reference-manifest.js'
    ),
    projectBracket: await entryChunkCount(
      '/(templates)/shop/[category]/page',
      '(templates)/shop/[category]/page_client-reference-manifest.js'
    ),
  }
}

async function dynamicFamilyChunkCounts() {
  return {
    route: await entryChunkCount(
      '/dashboard/[entity]/page',
      'dashboard/(main)/[entity]/page_client-reference-manifest.js'
    ),
    memberOnly: await entryChunkCount(
      '/(templates)/dashboard/agent-multi/page',
      '(templates)/dashboard/(main)/agent-multi/page_client-reference-manifest.js'
    ),
  }
}

async function main() {
  try {
    await createFixture()

    const baselineBuild = build('legacy global-registry')
    if (process.env.NEXTSPARK_KEEP_CONFORMANCE_FIXTURE === '1') process.stderr.write(baselineBuild.stdout)
    const legacyGlobal = await chunkCounts()

    await rm(join(FIXTURE_ROOT, '.next'), { recursive: true, force: true })
    await write(CORE_ROUTE, coreRoute('@nextsparkjs/registries/pre-direct-scope'))
    build('pre-direct one-entry route scope')
    const before = await chunkCounts()

    await rm(join(FIXTURE_ROOT, '.next'), { recursive: true, force: true })
    await write(CORE_ROUTE, coreRoute('@nextsparkjs/registries/template-scopes/server/core/page'))
    build('direct route-scope')
    const after = await chunkCounts()

    await rm(join(FIXTURE_ROOT, '.next'), { recursive: true, force: true })
    await write(
      DASHBOARD_DYNAMIC_ROUTE,
      dashboardDynamicRoute('@nextsparkjs/registries/template-scopes/server/dashboard/(main)/[entity]/page'),
    )
    build('dynamic-family scope with literal look-alike')
    const dynamicFamily = await dynamicFamilyChunkCounts()

    assert.ok(legacyGlobal.core.chunks > legacyGlobal.projectOnly.chunks, `legacy baseline must expose registry fan-out: ${JSON.stringify(legacyGlobal)}`)
    assert.equal(before.core.chunks, before.projectOnly.chunks, `pre-direct scoped core route must already avoid global fan-out: ${JSON.stringify(before)}`)
    assert.equal(after.core.chunks, after.projectOnly.chunks, `direct core route must match the project-only shape: ${JSON.stringify(after)}`)
    assert.equal(after.projectBracket.chunks, after.projectOnly.chunks, `project-only bracket route must match the project-only shape: ${JSON.stringify(after)}`)
    assert.ok(after.core.chunks < legacyGlobal.core.chunks, `direct core route must improve over the global registry: ${JSON.stringify({ legacyGlobal, after })}`)
    assert.equal(
      dynamicFamily.route.chunks,
      dynamicFamily.memberOnly.chunks,
      `dynamic family scope must exclude the look-alike literal route: ${JSON.stringify(dynamicFamily)}`,
    )

    console.log(JSON.stringify({ legacyGlobal, before, after, dynamicFamily }, null, 2))
  } finally {
    if (process.env.NEXTSPARK_KEEP_CONFORMANCE_FIXTURE !== '1') {
      await rm(FIXTURE_ROOT, { recursive: true, force: true })
    }
  }
}

await main()
