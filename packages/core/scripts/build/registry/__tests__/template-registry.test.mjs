/**
 * Tests for the template-registry generator.
 *
 * What matters here is the BINDING the generator emits. A static
 * `import Template_0 from '...'` per template makes every route that touches
 * the registry pull in the whole template graph (#183), so both registries
 * have to emit a deferred import instead — and the server one has to do it
 * without a Suspense boundary, which would let a response commit a 200 before
 * a template's own notFound() runs (#129).
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/template-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdtemp, mkdir, readdir, readFile, writeFile, rm, symlink } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  generateTemplateRegistry,
  generateTemplateRegistryClient,
  generateTemplateScopeRegistries
} from '../generators/template-registry.mjs'
import { analyzeTemplates } from '../post-build/page-generator.mjs'

const pageTemplate = {
  name: '(public)/page',
  themeName: 'default',
  templateType: 'page',
  fileName: 'page.tsx',
  relativePath: '(public)/page.tsx',
  appPath: 'app/(public)/page.tsx',
  templatePath: '@/contents/themes/default/templates/(public)/page.tsx',
  priority: 10
}

const protectedTemplate = {
  ...pageTemplate,
  name: 'dashboard/layout',
  templateType: 'layout',
  fileName: 'layout.meta.ts',
  relativePath: 'dashboard/layout.meta.ts',
  appPath: 'app/dashboard/layout.tsx',
  templatePath: '@/contents/themes/default/templates/dashboard/layout.meta.ts'
}

const config = { outputDir: '/tmp/registries', projectRoot: '/tmp/project' }
const CORE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', '..')
const E2E_DIR = join(CORE_DIR, '..', '..', '.e2e')

async function worktreeFixture(prefix) {
  await mkdir(E2E_DIR, { recursive: true })
  return mkdtemp(join(E2E_DIR, prefix))
}

async function markAsNpmProject(root) {
  const storePackage = join(root, 'node_modules/.pnpm/local/node_modules/@nextsparkjs/core')
  await mkdir(dirname(storePackage), { recursive: true })
  await symlink(CORE_DIR, storePackage, 'dir')
  const packageLink = join(root, 'node_modules/@nextsparkjs/core')
  await mkdir(dirname(packageLink), { recursive: true })
  await symlink('../.pnpm/local/node_modules/@nextsparkjs/core', packageLink, 'dir')
}

// The registry build parses the templates once, with analyzeTemplates, and
// hands the same analysis to both registries. These do the same.
async function generateServerRegistry(templates, config) {
  return generateTemplateRegistry(templates, config, await analyzeTemplates(templates, config))
}

async function generateClientRegistry(templates, config) {
  return generateTemplateRegistryClient(templates, config, await analyzeTemplates(templates, config))
}

test('server registry defers the import instead of hoisting a static one', async () => {
  const out = await generateServerRegistry([pageTemplate], config)

  assert.match(
    out,
    /component: lazyTemplate\('app\/\(public\)\/page\.tsx', \(\) => import\('@\/contents\/themes\/default\/templates\/\(public\)\/page'\)\)/
  )
  assert.doesNotMatch(out, /^import Template_\d+ from/m)
})

test('names the template in the error when it has no default export', async () => {
  const out = await generateServerRegistry([pageTemplate], config)

  // Without the module loaded up front, React would otherwise fail with a bare
  // "invalid element type" and no clue which template is at fault
  assert.match(out, /has no default export/)
  assert.match(out, /if \(!templateModule\.default\)/)
})

test('server registry loads templates without a Suspense boundary', async () => {
  const out = await generateServerRegistry([pageTemplate], config)

  // An async Server Component awaits inline; next/dynamic would wrap the
  // template in Suspense and break notFound()'s hold on the status code.
  assert.match(out, /return async function TemplateOverride/)
  assert.doesNotMatch(out, /^import .* from 'next\/dynamic'/m)
})

test('metadata-only templates still carry no component', async () => {
  const out = await generateServerRegistry([protectedTemplate], config)

  assert.match(out, /component: null/)
  assert.doesNotMatch(out, /layout\.meta'\)\)/)
})

test('client registry defers the import through next/dynamic', async () => {
  const out = await generateClientRegistry([pageTemplate], config)

  assert.match(out, /import dynamic from 'next\/dynamic'/)
  assert.match(
    out,
    /'app\/\(public\)\/page\.tsx': dynamic\(\(\) => import\('@\/contents\/themes\/default\/templates\/\(public\)\/page'\)\)/
  )
  assert.doesNotMatch(out, /^import ClientTemplate_\d+ from/m)
})

// --- a template file with no default export registers as metadata-only (#197) --

async function writeThemeTemplate(root, relativePath, content) {
  const absolutePath = join(root, 'contents/themes/testtheme/templates', relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
  return `@/contents/themes/testtheme/templates/${relativePath}`
}

async function writeAppRoute(root, appPath, content = 'export default function Page() { return null }\n') {
  const absolutePath = join(root, appPath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
}

test('a layout template with no default export is registered as metadata-only, like a .meta.ts file', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'docs/layout.tsx',
      "export const metadata = { title: 'Docs' }\n"
    )
    const template = {
      name: 'docs/layout',
      themeName: 'testtheme',
      templateType: 'layout',
      fileName: 'layout.tsx',
      relativePath: 'docs/layout.tsx',
      appPath: 'app/docs/layout.tsx',
      templatePath,
      priority: 10
    }

    const out = await generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root })

    assert.match(out, /'app\/docs\/layout\.tsx': \{\n\s*appPath: 'app\/docs\/layout\.tsx',\n\s*component: null,/)
    assert.doesNotMatch(out, /layout'\)\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a layout template exported through `export { X as default }` is registered as a deferred import', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'docs/layout.tsx',
      'function DocsLayout({ children }) { return children }\nexport { DocsLayout as default }\n'
    )
    const template = {
      name: 'docs/layout',
      themeName: 'testtheme',
      templateType: 'layout',
      fileName: 'layout.tsx',
      relativePath: 'docs/layout.tsx',
      appPath: 'app/docs/layout.tsx',
      templatePath,
      priority: 10
    }

    const out = await generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root })

    assert.match(
      out,
      /component: lazyTemplate\('app\/docs\/layout\.tsx', \(\) => import\('@\/contents\/themes\/testtheme\/templates\/docs\/layout'\)\)/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- a page template with no default export is metadata-only only over an app page that already exists (#197) --

test('a page template with no default export and no existing app page fails the registry build with a clear message', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    const templatePath = await writeThemeTemplate(root, 'docs/page.tsx', "export const metadata = { title: 'Docs' }\n")
    const template = {
      name: 'docs/page',
      themeName: 'testtheme',
      templateType: 'page',
      fileName: 'page.tsx',
      relativePath: 'docs/page.tsx',
      appPath: 'app/docs/page.tsx',
      templatePath,
      priority: 10
    }

    // No app/docs/page.tsx written - the page generator would write one importing
    // this template's (missing) default export.
    await assert.rejects(
      () => generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root }),
      error => {
        assert.match(error.message, new RegExp(templatePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        assert.match(error.message, /no existing route at "app\/docs\/page\.tsx"/)
        assert.match(error.message, /default export/)
        assert.match(error.message, /\.meta\.ts/)
        return true
      }
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a page template with no default export overriding an existing app page is registered as metadata-only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    const templatePath = await writeThemeTemplate(root, 'docs/page.tsx', "export const metadata = { title: 'Docs' }\n")
    await writeAppRoute(root, 'app/docs/page.tsx')
    const template = {
      name: 'docs/page',
      themeName: 'testtheme',
      templateType: 'page',
      fileName: 'page.tsx',
      relativePath: 'docs/page.tsx',
      appPath: 'app/docs/page.tsx',
      templatePath,
      priority: 10
    }

    const out = await generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root })

    assert.match(out, /'app\/docs\/page\.tsx': \{\n\s*appPath: 'app\/docs\/page\.tsx',\n\s*component: null,/)
    assert.doesNotMatch(out, /page'\)\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- segment config is only validated for a template the page generator writes a route file for (#197) --

test('a page template with a default export and an invalid segment config export does not fail the registry build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    // revalidate = 60 * 60 is an expression, not a literal - a generated route
    // file couldn't carry it, but this app page already exists, so none is generated.
    const templatePath = await writeThemeTemplate(
      root,
      'pricing/page.tsx',
      'export const revalidate = 60 * 60\nexport default function Page() { return null }\n'
    )
    await writeAppRoute(root, 'app/pricing/page.tsx')
    const template = {
      name: 'pricing/page',
      themeName: 'testtheme',
      templateType: 'page',
      fileName: 'page.tsx',
      relativePath: 'pricing/page.tsx',
      appPath: 'app/pricing/page.tsx',
      templatePath,
      priority: 10
    }

    const out = await generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root })

    assert.match(
      out,
      /component: lazyTemplate\('app\/pricing\/page\.tsx', \(\) => import\('@\/contents\/themes\/testtheme\/templates\/pricing\/page'\)\)/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- a standalone .meta.ts page needs an existing app page too, same as a .tsx with no default export (#197) --

test('a standalone .meta.ts page template with no existing app page fails the registry build with a clear message', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    // A standalone .meta.ts never has a default export - it only exports metadata.
    const templatePath = await writeThemeTemplate(root, 'docs/page.meta.ts', "export const metadata = { title: 'Docs' }\n")
    const template = {
      name: 'docs/page',
      themeName: 'testtheme',
      templateType: 'page',
      fileName: 'page.meta.ts',
      relativePath: 'docs/page.meta.ts',
      appPath: 'app/docs/page.tsx',
      templatePath,
      priority: 10
    }

    // No app/docs/page.tsx - the page generator would write one importing this
    // .meta.ts file's (nonexistent) default export.
    await assert.rejects(
      () => generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root }),
      error => {
        assert.match(error.message, new RegExp(templatePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
        assert.match(error.message, /no existing route at "app\/docs\/page\.tsx"/)
        return true
      }
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a standalone .meta.ts page template overriding an existing app page is registered as metadata-only', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    const templatePath = await writeThemeTemplate(root, 'docs/page.meta.ts', "export const metadata = { title: 'Docs' }\n")
    await writeAppRoute(root, 'app/docs/page.tsx')
    const template = {
      name: 'docs/page',
      themeName: 'testtheme',
      templateType: 'page',
      fileName: 'page.meta.ts',
      relativePath: 'docs/page.meta.ts',
      appPath: 'app/docs/page.tsx',
      templatePath,
      priority: 10
    }

    const out = await generateServerRegistry([template], { outputDir: '/tmp/registries', projectRoot: root })

    assert.match(out, /'app\/docs\/page\.tsx': \{\n\s*appPath: 'app\/docs\/page\.tsx',\n\s*component: null,/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- both registries take the default-export answer from the same analysis (#197) --

test('a layout with no default export is component: null on the server and has no entry at all on the client', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    // viewport isn't one of hasServerOnlyExports' patterns, so nothing but the
    // default-export answer keeps this out of the client registry.
    const templatePath = await writeThemeTemplate(root, 'docs/layout.tsx', "export const viewport = { themeColor: 'black' }\n")
    const template = {
      name: 'docs/layout',
      themeName: 'testtheme',
      templateType: 'layout',
      fileName: 'layout.tsx',
      relativePath: 'docs/layout.tsx',
      appPath: 'app/docs/layout.tsx',
      templatePath,
      priority: 10
    }
    const config = { outputDir: '/tmp/registries', projectRoot: root }
    const analysis = await analyzeTemplates([template], config)

    const serverOut = await generateTemplateRegistry([template], config, analysis)
    assert.match(serverOut, /'app\/docs\/layout\.tsx': \{\n\s*appPath: 'app\/docs\/layout\.tsx',\n\s*component: null,/)

    const clientOut = await generateTemplateRegistryClient([template], config, analysis)
    assert.doesNotMatch(clientOut, /app\/docs\/layout\.tsx/)
    assert.doesNotMatch(clientOut, /docs\/layout'\)\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('route scopes isolate template imports, retain empty fallbacks, and preserve the full registries', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    const publicPath = await writeThemeTemplate(
      root,
      '(public)/page.tsx',
      'export default function PublicTemplate() { return null }\n'
    )
    const aiPath = await writeThemeTemplate(
      root,
      'ai/page.tsx',
      'export default function AiTemplate() { return null }\n'
    )
    const metadataPath = await writeThemeTemplate(
      root,
      'layout.meta.ts',
      "export const metadata = { title: 'Theme brand' }\n"
    )
    await writeAppRoute(root, 'app/(public)/page.tsx')
    await writeAppRoute(root, 'app/ai/page.tsx')
    await writeAppRoute(root, 'app/(auth)/empty/page.tsx')
    await writeAppRoute(root, 'app/layout.tsx')

    const templates = [
      { ...pageTemplate, themeName: 'public', templatePath: publicPath },
      { ...pageTemplate, name: 'ai/page', themeName: 'ai', relativePath: 'ai/page.tsx', appPath: 'app/ai/page.tsx', templatePath: aiPath },
      {
        ...protectedTemplate,
        name: 'root/layout',
        themeName: 'brand',
        relativePath: 'layout.meta.ts',
        appPath: 'app/layout.tsx',
        templatePath: metadataPath,
        metadata: { title: 'Theme brand' }
      }
    ]
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const analysis = await analyzeTemplates(templates, scopedConfig)
    const { files } = await generateTemplateScopeRegistries(templates, scopedConfig, analysis)
    const file = suffix => files.find(candidate => candidate.path.endsWith(suffix))?.content
    const publicServer = file('/template-scopes/server/(public)/page.ts')
    const aiServer = file('/template-scopes/server/ai/page.ts')
    const publicClient = file('/template-scopes/client/(public)/page.ts')
    const emptyServer = file('/template-scopes/server/(auth)/empty/page.ts')
    const protectedServer = file('/template-scopes/server/layout.ts')

    assert.match(publicServer, /import SelectedTemplate from '@\/contents\/themes\/testtheme\/templates\/\(public\)\/page'/)
    assert.doesNotMatch(publicServer, /templates\/ai\/page/)
    assert.match(aiServer, /import SelectedTemplate from '@\/contents\/themes\/testtheme\/templates\/ai\/page'/)
    assert.doesNotMatch(aiServer, /templates\/\(public\)\/page/)
    assert.match(publicClient, /import SelectedTemplate from '@\/contents\/themes\/testtheme\/templates\/\(public\)\/page'/)
    assert.doesNotMatch(publicClient, /templates\/ai\/page/)
    assert.doesNotMatch(publicClient, /CLIENT_TEMPLATE_REGISTRY|dynamic\(\(\) => import\(/)
    assert.match(emptyServer, /const HAS_OVERRIDE = false/)
    assert.match(emptyServer, /export function getTemplateOrDefault/)
    assert.doesNotMatch(emptyServer, /TemplateService|template-registry'|TEMPLATE_REGISTRY/)
    assert.match(protectedServer, /const TemplateComponent: any = null/)
    assert.match(protectedServer, /const METADATA_OVERRIDE_ALLOWED = true/)

    const full = await generateTemplateRegistry(templates, scopedConfig, analysis)
    assert.match(full, /app\/\(public\)\/page\.tsx/)
    assert.match(full, /app\/ai\/page\.tsx/)
    const client = await generateTemplateRegistryClient(templates, scopedConfig, analysis)
    assert.doesNotMatch(client, /layout\.tsx/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an exact core route scope imports its override directly without changing any core route exports', async () => {
  const root = await worktreeFixture('nextspark-template-direct-scope-test-')
  try {
    const coreRoute = [
      "import { getTemplateOrDefault } from '@nextsparkjs/registries/template-scopes/server/(auth)/login/page'",
      "export const dynamic = 'force-dynamic'",
      'export const revalidate = 0',
      'export const dynamicParams = false',
      "export const runtime = 'nodejs'",
      'export async function generateMetadata() { return { title: \'Core\' } }',
      'export async function generateStaticParams() { return [] }',
      "export const nonTemplateExport = 'kept'",
      'function CoreLoginPage() { return null }',
      "export default getTemplateOrDefault('app/(auth)/login/page.tsx', CoreLoginPage)",
      '',
    ].join('\n')
    await writeAppRoute(root, 'app/(auth)/login/page.tsx', coreRoute)
    const templatePath = await writeThemeTemplate(
      root,
      '(auth)/login/page.tsx',
      'export default function ThemeLoginPage() { return null }\n'
    )
    const template = {
      ...pageTemplate,
      name: '(auth)/login/page',
      relativePath: '(auth)/login/page.tsx',
      appPath: 'app/(auth)/login/page.tsx',
      templatePath,
    }
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const analysis = await analyzeTemplates([template], scopedConfig)
    const { files } = await generateTemplateScopeRegistries([template], scopedConfig, analysis)
    const scope = files.find(file => file.path.endsWith('/template-scopes/server/(auth)/login/page.ts')).content

    assert.match(scope, /import SelectedTemplate from '@\/contents\/themes\/testtheme\/templates\/\(auth\)\/login\/page'/)
    assert.doesNotMatch(scope, /TEMPLATE_REGISTRY|lazyTemplate|\(\) => import\(/)
    assert.equal(await readFile(join(root, 'app/(auth)/login/page.tsx'), 'utf8'), coreRoute)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an exact core route scope with no override keeps the default resolver path', async () => {
  const root = await worktreeFixture('nextspark-template-empty-direct-scope-test-')
  try {
    await writeAppRoute(root, 'app/(auth)/login/page.tsx')
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const { files } = await generateTemplateScopeRegistries([], scopedConfig)
    const scope = files.find(file => file.path.endsWith('/template-scopes/server/(auth)/login/page.ts')).content

    assert.doesNotMatch(scope, /import SelectedTemplate|TEMPLATE_REGISTRY|lazyTemplate|\(\) => import\(/)
    assert.match(scope, /return defaultComponent/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// The scoped module is TypeScript, but its resolvers have no runtime
// dependencies beyond the generated registry and protected-path predicates.
// Execute exactly that emitted code so semantic parity is not just a snapshot.
function scopedResolvers(scopeContent, registry, canOverrideComponent = () => true, canOverrideMetadata = () => true) {
  const start = scopeContent.indexOf('export function hasTemplateOverride')
  assert.notEqual(start, -1, 'scope should contain scoped resolvers')
  const emitted = scopeContent
    .slice(start)
    .replace('export function hasTemplateOverride(appPath: string): boolean {', 'function hasTemplateOverride(appPath) {')
    .replace('export function getTemplateComponent(appPath: string): any | null {', 'function getTemplateComponent(appPath) {')
    .replace('export function getTemplateOrDefault<T = any>(appPath: string, defaultComponent: T): T {', 'function getTemplateOrDefault(appPath, defaultComponent) {')
    .replace('component as T', 'component')
    .replace('export function getMetadataOrDefault(appPath: string, defaultMetadata: any): any {', 'function getMetadataOrDefault(appPath, defaultMetadata) {')
  return Function('TEMPLATE_REGISTRY', 'canOverrideComponent', 'canOverrideMetadata', `${emitted}\nreturn { hasTemplateOverride, getTemplateComponent, getTemplateOrDefault, getMetadataOrDefault }`)(
    registry,
    canOverrideComponent,
    canOverrideMetadata
  )
}

function directScopeResolvers(scopeContent, selectedTemplate = null) {
  const start = scopeContent.indexOf('const APP_PATH')
  assert.notEqual(start, -1, 'scope should contain direct resolver constants')
  const emitted = scopeContent
    .slice(start)
    .replace('const TemplateComponent: any = SelectedTemplate', 'const TemplateComponent = selectedTemplate')
    .replace('const TemplateComponent: any = null', 'const TemplateComponent = null')
    .replace('const templateMetadata: any =', 'const templateMetadata =')
    .replace('export function hasTemplateOverride(candidatePath: string): boolean {', 'function hasTemplateOverride(candidatePath) {')
    .replace('export function getTemplateComponent(candidatePath: string): any | null {', 'function getTemplateComponent(candidatePath) {')
    .replace('export function getTemplateOrDefault<T = any>(candidatePath: string, defaultComponent: T): T {', 'function getTemplateOrDefault(candidatePath, defaultComponent) {')
    .replace('return TemplateComponent as T', 'return TemplateComponent')
    .replace('export function getMetadataOrDefault(candidatePath: string, defaultMetadata: any): any {', 'function getMetadataOrDefault(candidatePath, defaultMetadata) {')
  return Function('selectedTemplate', `${emitted}\nreturn { hasTemplateOverride, getTemplateComponent, getTemplateOrDefault, getMetadataOrDefault }`)(selectedTemplate)
}

test('scoped metadata runtime preserves legacy truthy fallback semantics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    await writeAppRoute(root, 'app/metadata.ts')
    const templatePath = await writeThemeTemplate(root, 'metadata.ts', 'export default function Template() { return null }\n')
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const fallback = { title: 'application default' }

    for (const metadata of [false, 0, '', null, undefined]) {
      const template = { ...pageTemplate, appPath: 'app/metadata.ts', templatePath, metadata }
      const { files } = await generateTemplateScopeRegistries([template], scopedConfig, await analyzeTemplates([template], scopedConfig))
      const scope = files.find(file => file.path.endsWith('/template-scopes/server/metadata.ts')).content
      const { getMetadataOrDefault } = directScopeResolvers(scope)
      assert.equal(getMetadataOrDefault('app/metadata.ts', fallback), fallback)
    }
    const override = { title: 'theme override' }
    const template = { ...pageTemplate, appPath: 'app/metadata.ts', templatePath, metadata: override }
    const { files } = await generateTemplateScopeRegistries([template], scopedConfig, await analyzeTemplates([template], scopedConfig))
    const scope = files.find(file => file.path.endsWith('/template-scopes/server/metadata.ts')).content
    const { getMetadataOrDefault } = directScopeResolvers(scope)
    assert.deepEqual(getMetadataOrDefault('app/metadata.ts', fallback), override)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scoped dynamic lookups preserve TemplateService has/get fallback semantics', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    await writeAppRoute(root, 'app/(public)/[...slug]/page.tsx')
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const { files } = await generateTemplateScopeRegistries([], scopedConfig)
    const scope = files.find(file => file.path.endsWith('/template-scopes/server/(public)/[...slug]/page.ts')).content
    const component = () => 'template'
    const { hasTemplateOverride, getTemplateComponent } = scopedResolvers(scope, {
      'app/(public)/blog/[slug]/page.tsx': { component },
      'app/(public)/metadata-only/page.tsx': { component: null }
    })

    assert.equal(hasTemplateOverride('app/(public)/blog/[slug]/page.tsx'), true)
    assert.equal(hasTemplateOverride('app/(public)/missing/page.tsx'), false)
    assert.equal(getTemplateComponent('app/(public)/blog/[slug]/page.tsx'), component)
    assert.equal(getTemplateComponent('app/(public)/metadata-only/page.tsx'), null)
    assert.equal(getTemplateComponent('app/(public)/missing/page.tsx'), null)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scopes use separate server/client trees and reject extension output ambiguity before writes', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    await writeAppRoute(root, 'app/foo.ts')
    await writeAppRoute(root, 'app/foo.client.ts')
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const { files } = await generateTemplateScopeRegistries([], scopedConfig)
    const paths = new Set(files.map(file => file.path))
    for (const path of [
      '/template-scopes/server/foo.ts',
      '/template-scopes/client/foo.ts',
      '/template-scopes/server/foo.client.ts',
      '/template-scopes/client/foo.client.ts'
    ]) assert.ok([...paths].some(candidate => candidate.endsWith(path)), `missing ${path}`)

    await writeAppRoute(root, 'app/ambiguous.ts')
    await writeAppRoute(root, 'app/ambiguous.tsx')
    await assert.rejects(
      () => generateTemplateScopeRegistries([], scopedConfig),
      /Ambiguous template scope output .*ambiguous\.ts.*app\/ambiguous\.ts.*app\/ambiguous\.tsx/s
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('client scopes exclude side-effect and multiline server-only imports with either quote style', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-registry-test-'))
  try {
    const sideEffectPath = await writeThemeTemplate(root, 'server-only/page.tsx', "import 'server-only'\nexport default function Page() { return null }\n")
    const multilinePath = await writeThemeTemplate(root, 'quoted/layout.tsx', 'import {\n  marker\n} from "server-only"\nexport default function Layout() { return null }\n')
    const templates = [
      { ...pageTemplate, appPath: 'app/server-only/page.tsx', relativePath: 'server-only/page.tsx', templatePath: sideEffectPath },
      { ...pageTemplate, appPath: 'app/quoted/layout.tsx', templateType: 'layout', relativePath: 'quoted/layout.tsx', templatePath: multilinePath }
    ]
    const out = await generateClientRegistry(templates, { outputDir: join(root, '.nextspark/registries'), projectRoot: root })
    assert.doesNotMatch(out, /app\/server-only\/page\.tsx/)
    assert.doesNotMatch(out, /app\/quoted\/layout\.tsx/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('scoped resolver keeps highest template selection while empty and protected scopes fall back', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    const lowPath = await writeThemeTemplate(root, 'priority/low.tsx', 'export default function Low() { return null }\n')
    const highPath = await writeThemeTemplate(root, 'priority/high.tsx', 'export default function High() { return null }\n')
    await writeAppRoute(root, 'app/priority/page.tsx')
    await writeAppRoute(root, 'app/empty/page.tsx')
    await writeAppRoute(root, 'app/dashboard/layout.tsx')
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const templates = [
      { ...pageTemplate, appPath: 'app/priority/page.tsx', templatePath: lowPath, priority: 1 },
      { ...pageTemplate, appPath: 'app/priority/page.tsx', templatePath: highPath, priority: 10 },
      { ...pageTemplate, appPath: 'app/dashboard/layout.tsx', templateType: 'layout', templatePath: highPath, priority: 10 }
    ]
    const { files } = await generateTemplateScopeRegistries(templates, scopedConfig, await analyzeTemplates(templates, scopedConfig))
    const priorityScope = files.find(file => file.path.endsWith('/template-scopes/server/priority/page.ts')).content
    const emptyScope = files.find(file => file.path.endsWith('/template-scopes/server/empty/page.ts')).content
    const protectedScope = files.find(file => file.path.endsWith('/template-scopes/server/dashboard/layout.ts')).content
    assert.match(priorityScope, new RegExp(highPath.replace(/\.(?:tsx|ts)$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))
    assert.doesNotMatch(priorityScope, new RegExp(lowPath.replace(/\.(?:tsx|ts)$/, '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')))

    const fallback = () => 'fallback'
    const override = () => 'override'
    assert.equal(directScopeResolvers(emptyScope).getTemplateOrDefault('app/empty/page.tsx', fallback), fallback)
    assert.equal(directScopeResolvers(priorityScope, override).getTemplateOrDefault('app/priority/page.tsx', fallback), override)
    assert.equal(directScopeResolvers(protectedScope, override).getTemplateOrDefault('app/dashboard/layout.tsx', fallback), fallback)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('dynamic route scopes contain only their runtime target family, not the full registry', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    await writeAppRoute(root, 'app/(public)/[...slug]/page.tsx')
    await writeAppRoute(root, 'app/dashboard/(main)/[entity]/page.tsx')
    await writeAppRoute(root, 'app/dashboard/(main)/[entity]/[id]/page.tsx')
    await writeAppRoute(root, 'app/dashboard/(main)/boards/[id]/[cardId]/page.tsx')

    const publicDynamic = await writeThemeTemplate(root, '(public)/blog/[slug]/page.tsx', 'export default function Blog() { return null }\n')
    const dashboardDetail = await writeThemeTemplate(root, 'dashboard/(main)/projects/[id]/page.tsx', 'export default function Project() { return null }\n')
    const nestedDashboardDetail = await writeThemeTemplate(root, 'dashboard/(main)/boards/[id]/[cardId]/page.tsx', 'export default function Card() { return null }\n')
    const dashboardAi = await writeThemeTemplate(root, 'dashboard/(main)/agent-multi/page.tsx', 'export default function Agent() { return null }\n')
    const observability = await writeThemeTemplate(root, 'superadmin/ai-observability/page.tsx', 'export default function Observability() { return null }\n')
    const templates = [
      { ...pageTemplate, appPath: 'app/(public)/blog/[slug]/page.tsx', relativePath: '(public)/blog/[slug]/page.tsx', templatePath: publicDynamic },
      { ...pageTemplate, appPath: 'app/dashboard/(main)/projects/[id]/page.tsx', relativePath: 'dashboard/(main)/projects/[id]/page.tsx', templatePath: dashboardDetail },
      { ...pageTemplate, appPath: 'app/dashboard/(main)/boards/[id]/[cardId]/page.tsx', relativePath: 'dashboard/(main)/boards/[id]/[cardId]/page.tsx', templatePath: nestedDashboardDetail },
      { ...pageTemplate, appPath: 'app/dashboard/(main)/agent-multi/page.tsx', relativePath: 'dashboard/(main)/agent-multi/page.tsx', templatePath: dashboardAi },
      { ...pageTemplate, appPath: 'app/superadmin/ai-observability/page.tsx', relativePath: 'superadmin/ai-observability/page.tsx', templatePath: observability }
    ]
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const { files } = await generateTemplateScopeRegistries(templates, scopedConfig, await analyzeTemplates(templates, scopedConfig))
    const file = suffix => files.find(candidate => candidate.path.endsWith(suffix))?.content
    const publicServer = file('/template-scopes/server/(public)/[...slug]/page.ts')
    const publicClient = file('/template-scopes/client/(public)/[...slug]/page.ts')
    const dashboardListServer = file('/template-scopes/server/dashboard/(main)/[entity]/page.ts')
    const dashboardServer = file('/template-scopes/server/dashboard/(main)/[entity]/[id]/page.ts')

    assert.match(publicServer, /templates\/\(public\)\/blog\/\[slug\]\/page'\)\)/)
    assert.match(publicServer, /export function hasTemplateOverride/)
    assert.match(publicServer, /export function getTemplateComponent/)
    assert.doesNotMatch(publicServer, /agent-multi|ai-observability|projects\/\[id\]/)
    assert.match(publicClient, /templates\/\(public\)\/blog\/\[slug\]\/page'\)\)/)
    assert.doesNotMatch(publicClient, /agent-multi|ai-observability|projects\/\[id\]/)

    assert.match(dashboardListServer, /templates\/dashboard\/\(main\)\/agent-multi\/page'\)\)/)
    assert.doesNotMatch(dashboardListServer, /\(public\)\/blog|projects\/\[id\]|boards\/\[id\]\/\[cardId\]|ai-observability/)

    assert.match(dashboardServer, /templates\/dashboard\/\(main\)\/projects\/\[id\]\/page'\)\)/)
    assert.doesNotMatch(dashboardServer, /\(public\)\/blog|boards\/\[id\]\/\[cardId\]|agent-multi|ai-observability/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a literal dashboard route override keeps its exact scope and stays out of the dynamic entity-list family', async () => {
  const root = await worktreeFixture('nextspark-template-literal-dashboard-scope-test-')
  try {
    await writeAppRoute(root, 'app/dashboard/(main)/[entity]/page.tsx')
    await writeAppRoute(root, 'app/dashboard/(main)/media/page.tsx')

    const mediaTemplatePath = await writeThemeTemplate(
      root,
      'dashboard/(main)/media/page.tsx',
      'export default function Media() { return null }\n'
    )
    const mediaTemplate = {
      ...pageTemplate,
      appPath: 'app/dashboard/(main)/media/page.tsx',
      relativePath: 'dashboard/(main)/media/page.tsx',
      templatePath: mediaTemplatePath,
    }
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const analysis = await analyzeTemplates([mediaTemplate], scopedConfig)
    const { files } = await generateTemplateScopeRegistries([mediaTemplate], scopedConfig, analysis)
    const file = suffix => files.find(candidate => candidate.path.endsWith(suffix))?.content
    const dynamicListScope = file('/template-scopes/server/dashboard/(main)/[entity]/page.ts')
    const dynamicListClientScope = file('/template-scopes/client/dashboard/(main)/[entity]/page.ts')
    const mediaScope = file('/template-scopes/server/dashboard/(main)/media/page.ts')

    assert.doesNotMatch(dynamicListScope, /templates\/dashboard\/\(main\)\/media\/page/)
    assert.doesNotMatch(dynamicListClientScope, /templates\/dashboard\/\(main\)\/media\/page/)
    assert.match(mediaScope, /import SelectedTemplate from '@\/contents\/themes\/testtheme\/templates\/dashboard\/\(main\)\/media\/page'/)
    assert.match(mediaScope, /const APP_PATH = "app\/dashboard\/\(main\)\/media\/page\.tsx"/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a project-only bracket route builds and gets an exact direct scope before its page is generated', async () => {
  const root = await worktreeFixture('nextspark-template-project-bracket-scope-test-')
  try {
    await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
    await writeFile(join(root, 'package.json'), '{}\n')
    await mkdir(join(root, 'app'), { recursive: true })
    await markAsNpmProject(root)
    await writeAppRoute(root, 'contents/themes/acme/config/theme.config.ts', 'export const acmeThemeConfig = {}\n')
    const template = join(root, 'contents/themes/acme/templates/shop/[category]/page.tsx')
    await mkdir(dirname(template), { recursive: true })
    await writeFile(template, 'export default function CategoryPage() { return null }\n')

    runRegistryBuild(root)

    assert.equal(
      existsSync(join(root, 'app/(templates)/shop/[category]/page.tsx')),
      true,
      'the project-only bracket route is generated later in the registry pipeline'
    )
    const scope = await readFile(
      join(root, '.nextspark/registries/template-scopes/server/shop/[category]/page.ts'),
      'utf8'
    )
    assert.match(scope, /import SelectedTemplate from '@\/contents\/themes\/acme\/templates\/shop\/\[category\]\/page'/)
    assert.match(scope, /const APP_PATH = "app\/shop\/\[category\]\/page\.tsx"/)
    assert.doesNotMatch(scope, /TEMPLATE_REGISTRY|lazyTemplate|\(\) => import\(/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a bracket path orphaned after analysis fails scope generation clearly', async () => {
  const root = await worktreeFixture('nextspark-template-unknown-dynamic-scope-test-')
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'custom/[tenant]/page.tsx',
      'export default function TenantPage() { return null }\n'
    )
    const unsupportedTemplate = {
      ...pageTemplate,
      appPath: 'app/custom/[tenant]/page.tsx',
      relativePath: 'custom/[tenant]/page.tsx',
      templatePath,
    }
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    await writeAppRoute(root, unsupportedTemplate.appPath)
    const analysis = await analyzeTemplates([unsupportedTemplate], scopedConfig)
    assert.equal(analysis.get(templatePath).generatesRoute, false)
    await rm(join(root, unsupportedTemplate.appPath))

    await assert.rejects(
      generateTemplateScopeRegistries([unsupportedTemplate], scopedConfig, analysis),
      /Unsupported runtime-templated app path "app\/custom\/\[tenant\]\/page\.tsx".*known dynamic route family/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

async function scopedFiles(root) {
  const directory = join(root, '.nextspark/registries/template-scopes')
  const files = []
  async function visit(path, relative = '') {
    for (const entry of await readdir(path, { withFileTypes: true })) {
      const entryPath = join(path, entry.name)
      const entryRelative = relative ? `${relative}/${entry.name}` : entry.name
      if (entry.isDirectory()) await visit(entryPath, entryRelative)
      else if (entry.isFile()) files.push([entryRelative, await readFile(entryPath, 'utf8')])
    }
  }
  await visit(directory)
  return files.sort(([left], [right]) => left.localeCompare(right))
}

function runRegistryBuild(root) {
  const result = spawnSync('node', ['scripts/build/registry.mjs'], {
    cwd: CORE_DIR,
    env: { ...process.env, NEXTSPARK_PROJECT_ROOT: root },
    encoding: 'utf8',
  })
  assert.equal(result.status, 0, `${result.stdout}${result.stderr}`)
}

function withoutBuildTimestamps(content) {
  return content.replace(/(Generated at|generatedAt): .*$/gm, '$1: <build-time>')
}

test('complete builds exclude generated template pages and layout copies from route scopes, then prune both in one build', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-build-test-'))
  try {
    await writeFile(join(root, '.env'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
    await writeFile(join(root, 'package.json'), '{}\n')
    await writeAppRoute(root, 'app/shop/layout.tsx', 'export default function ShopLayout({ children }) { return children }\n')
    await writeAppRoute(root, 'contents/themes/acme/config/theme.config.ts', 'export const acmeThemeConfig = {}\n')
    const template = join(root, 'contents/themes/acme/templates/shop/page.tsx')
    await mkdir(dirname(template), { recursive: true })
    await writeFile(template, 'export default function ShopPage() { return null }\n')

    runRegistryBuild(root)
    const firstScopes = await scopedFiles(root)
    assert.equal(existsSync(join(root, 'app/(templates)/shop/page.tsx')), true, 'the generated template page exists')
    const generatedLayout = await readFile(join(root, 'app/(templates)/shop/layout.tsx'), 'utf8')
    assert.match(generatedLayout, /copy of app\/shop\/layout\.tsx/)

    runRegistryBuild(root)
    const secondScopes = await scopedFiles(root)
    assert.deepEqual(
      secondScopes.map(([path]) => path),
      firstScopes.map(([path]) => path),
      'a generated page and copied layout do not become scopes on the next build'
    )
    assert.deepEqual(
      secondScopes.map(([path, content]) => [path, withoutBuildTimestamps(content)]),
      firstScopes.map(([path, content]) => [path, withoutBuildTimestamps(content)])
    )

    await rm(template)
    runRegistryBuild(root)
    const prunedScopes = await scopedFiles(root)
    assert.equal(existsSync(join(root, 'app/(templates)/shop/page.tsx')), false, 'the removed template page is pruned in the same build')
    assert.equal(existsSync(join(root, 'app/(templates)/shop/layout.tsx')), false, 'the generated layout copy is pruned in the same build')
    assert.deepEqual(
      prunedScopes.map(([path]) => path),
      ['client/shop/layout.ts', 'server/shop/layout.ts'],
      'only the real application layout keeps a scope after the template is removed'
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('server route scopes are marked server-only while client scopes remain client-safe', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-template-scopes-test-'))
  try {
    await writeAppRoute(root, 'app/shop/page.tsx')
    const scopedConfig = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }
    const { files } = await generateTemplateScopeRegistries([], scopedConfig)
    const serverScope = files.find(file => file.path.endsWith('/template-scopes/server/shop/page.ts')).content
    const clientScope = files.find(file => file.path.endsWith('/template-scopes/client/shop/page.ts')).content

    assert.match(serverScope, /import 'server-only'/)
    assert.doesNotMatch(clientScope, /server-only/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
