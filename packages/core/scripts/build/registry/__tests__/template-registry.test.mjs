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
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import {
  generateTemplateRegistry,
  generateTemplateRegistryClient
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
