/**
 * The template generators @nextsparkjs/core exposes through `./scripts/*`
 * keep the signatures they were published with. A caller that doesn't pass
 * the analysis `analyzeTemplates` produces gets one taken for that call, with
 * the same output the registry build produces, and no generator deletes
 * anything before its input has been checked.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/published-signatures.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import {
  generateTemplateRegistry,
  generateTemplateRegistryClient
} from '../generators/template-registry.mjs'
import { generateMissingPages, generateTemplatePage } from '../post-build/page-generator.mjs'

async function createProject() {
  return mkdtemp(join(tmpdir(), 'nextspark-published-signatures-test-'))
}

async function writeProjectFile(root, relativePath, content) {
  const absolutePath = join(root, relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
}

/** A theme template at `contents/themes/testtheme/templates/<relativePath>`, overriding `app/<relativePath>`. */
async function writeTemplate(root, relativePath, templateType, content) {
  await writeProjectFile(root, join('contents/themes/testtheme/templates', relativePath), content)
  return {
    name: relativePath.replace(/\.(tsx|ts)$/, ''),
    themeName: 'testtheme',
    templateType,
    fileName: relativePath.split('/').pop(),
    relativePath,
    appPath: `app/${relativePath}`,
    templatePath: `@/contents/themes/testtheme/templates/${relativePath}`,
    priority: 10
  }
}

const LAYOUT_WITHOUT_COMPONENT = "export const viewport = { themeColor: 'black' }\n"
const PAGE_WITH_COMPONENT = 'export default function Page() { return null }\n'

test('generateTemplateRegistry(templates, config) decides component vs metadata-only without being handed an analysis', async () => {
  const root = await createProject()
  try {
    const layout = await writeTemplate(root, 'docs/layout.tsx', 'layout', LAYOUT_WITHOUT_COMPONENT)
    const page = await writeTemplate(root, 'pricing/page.tsx', 'page', PAGE_WITH_COMPONENT)

    const out = await generateTemplateRegistry([layout, page], { outputDir: join(root, '.nextspark/registries'), projectRoot: root })

    assert.match(out, /'app\/docs\/layout\.tsx': \{\n\s*appPath: 'app\/docs\/layout\.tsx',\n\s*component: null,/)
    assert.match(out, /component: lazyTemplate\('app\/pricing\/page\.tsx', \(\) => import\('@\/contents\/themes\/testtheme\/templates\/pricing\/page'\)\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateTemplateRegistryClient(templates, config) leaves out a template with no component without being handed an analysis', async () => {
  const root = await createProject()
  try {
    const layout = await writeTemplate(root, 'docs/layout.tsx', 'layout', LAYOUT_WITHOUT_COMPONENT)
    const page = await writeTemplate(root, 'pricing/page.tsx', 'page', PAGE_WITH_COMPONENT)

    const out = await generateTemplateRegistryClient([layout, page], { outputDir: join(root, '.nextspark/registries'), projectRoot: root })

    assert.doesNotMatch(out, /app\/docs\/layout\.tsx/)
    assert.match(out, /'app\/pricing\/page\.tsx': dynamic\(\(\) => import\('@\/contents\/themes\/testtheme\/templates\/pricing\/page'\)\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateMissingPages(templates, config) writes the same routes the registry build does without being handed an analysis', async () => {
  const root = await createProject()
  try {
    const layout = await writeTemplate(root, 'docs/layout.tsx', 'layout', LAYOUT_WITHOUT_COMPONENT)
    const page = await writeTemplate(root, 'pricing/page.tsx', 'page', PAGE_WITH_COMPONENT)

    await generateMissingPages([layout, page], { projectRoot: root })

    const generatedLayout = await readFile(join(root, 'app/(templates)/docs/layout.tsx'), 'utf8')
    assert.match(generatedLayout, /Pass-through component/)
    assert.match(generatedLayout, /export \{ viewport \} from '@\/contents\/themes\/testtheme\/templates\/docs\/layout'/)

    const generatedPage = await readFile(join(root, 'app/(templates)/pricing/page.tsx'), 'utf8')
    assert.match(generatedPage, /import TemplateComponent from '@\/contents\/themes\/testtheme\/templates\/pricing\/page'/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateTemplatePage(template, outputPath) writes a route file without being handed an analysis', async () => {
  const root = await createProject()
  try {
    // generateTemplatePage resolves templates against the project root the last
    // generateMissingPages call was given.
    await generateMissingPages([], { projectRoot: root })
    const page = await writeTemplate(root, 'blog/page.tsx', 'page', `export const revalidate = 3600\n${PAGE_WITH_COMPONENT}`)
    const outputPath = join(root, 'app/(templates)/blog/page.tsx')

    await generateTemplatePage(page, outputPath)

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /import TemplateComponent from '@\/contents\/themes\/testtheme\/templates\/blog\/page'/)
    assert.match(generated, /export const revalidate = 3600/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateTemplatePage(template, outputPath) still rejects segment config Next.js would not read', async () => {
  const root = await createProject()
  try {
    await generateMissingPages([], { projectRoot: root })
    const page = await writeTemplate(root, 'broken/page.tsx', 'page', `export const revalidate = 60 * 60\n${PAGE_WITH_COMPONENT}`)
    const outputPath = join(root, 'app/(templates)/broken/page.tsx')

    await assert.rejects(() => generateTemplatePage(page, outputPath), /segment config export "revalidate" is not a literal/)
    assert.equal(existsSync(outputPath), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateMissingPages(templates, config) rejects a template it cannot generate before deleting anything', async () => {
  const root = await createProject()
  try {
    await writeProjectFile(root, 'app/(templates)/old/page.tsx', PAGE_WITH_COMPONENT)
    const page = await writeTemplate(root, 'docs/page.tsx', 'page', "export const metadata = { title: 'Docs' }\n")

    await assert.rejects(() => generateMissingPages([page], { projectRoot: root }), /has no default export/)

    assert.equal(existsSync(join(root, 'app/(templates)/old/page.tsx')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateMissingPages rejects an analysis that is missing one of its templates before deleting anything', async () => {
  const root = await createProject()
  try {
    await writeProjectFile(root, 'app/(templates)/old/page.tsx', PAGE_WITH_COMPONENT)
    const page = await writeTemplate(root, 'pricing/page.tsx', 'page', PAGE_WITH_COMPONENT)

    await assert.rejects(() => generateMissingPages([page], { projectRoot: root }, new Map()), /was not read by analyzeTemplates/)

    assert.equal(existsSync(join(root, 'app/(templates)/old/page.tsx')), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

/** A standalone `page.meta.ts` - which never has a default export - overriding `app/<route>/page.tsx`. */
async function writeMetaTemplate(root, route) {
  const relativePath = `${route}/page.meta.ts`
  await writeProjectFile(root, join('contents/themes/testtheme/templates', relativePath), "export const metadata = { title: 'Docs' }\n")
  return {
    name: `${route}/page`,
    themeName: 'testtheme',
    templateType: 'page',
    fileName: 'page.meta.ts',
    relativePath,
    appPath: `app/${route}/page.tsx`,
    templatePath: `@/contents/themes/testtheme/templates/${relativePath}`,
    priority: 10
  }
}

test('generateTemplatePage(template, outputPath) rejects a page.meta.ts for a route the app has no page at, without writing it', async () => {
  const root = await createProject()
  try {
    await generateMissingPages([], { projectRoot: root })
    const meta = await writeMetaTemplate(root, 'docs')
    const outputPath = join(root, 'app/(templates)/docs/page.tsx')

    await assert.rejects(
      () => generateTemplatePage(meta, outputPath),
      /page\.meta\.ts has no default export, and the app has no existing route at "app\/docs\/page\.tsx"/
    )
    assert.equal(existsSync(outputPath), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateTemplatePage(template, outputPath) rejects a page.tsx with no default export for a route the app has no page at, without writing it', async () => {
  const root = await createProject()
  try {
    await generateMissingPages([], { projectRoot: root })
    const page = await writeTemplate(root, 'docs/page.tsx', 'page', "export const metadata = { title: 'Docs' }\n")
    const outputPath = join(root, 'app/(templates)/docs/page.tsx')

    await assert.rejects(
      () => generateTemplatePage(page, outputPath),
      /docs\/page\.tsx has no default export, and the app has no existing route at "app\/docs\/page\.tsx"/
    )
    assert.equal(existsSync(outputPath), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generateMissingPages(templates, config) rejects a page.meta.ts for a route the app has no page at, without writing anything', async () => {
  const root = await createProject()
  try {
    const meta = await writeMetaTemplate(root, 'docs')

    await assert.rejects(() => generateMissingPages([meta], { projectRoot: root }), /page\.meta\.ts has no default export/)

    assert.equal(existsSync(join(root, 'app/(templates)')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a page.meta.ts over a page the app already has is accepted, and no route file is written for it', async () => {
  const root = await createProject()
  try {
    await writeProjectFile(root, 'app/docs/page.tsx', PAGE_WITH_COMPONENT)
    const meta = await writeMetaTemplate(root, 'docs')

    await generateMissingPages([meta], { projectRoot: root })
    assert.equal(existsSync(join(root, 'app/(templates)/docs/page.tsx')), false)

    const out = await generateTemplateRegistry([meta], { outputDir: join(root, '.nextspark/registries'), projectRoot: root })
    assert.match(out, /'app\/docs\/page\.tsx': \{\n\s*appPath: 'app\/docs\/page\.tsx',\n\s*component: null,/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
