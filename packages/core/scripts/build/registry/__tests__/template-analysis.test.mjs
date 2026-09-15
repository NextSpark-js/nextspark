/**
 * Tests that both template registries and the page generator take what they
 * know about a theme template from the analysis the registry build parses it
 * into once (`analyzeTemplates`), instead of parsing the template again.
 *
 * Each test hands a consumer an analysis that no longer matches the template
 * on disk: the state a watch-mode rebuild reaches when a template is saved
 * between two phases of the same build. A consumer that parses the file itself
 * sees a different template than the others, and its output gives it away.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/template-analysis.test.mjs
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
import { generateMissingPages } from '../post-build/page-generator.mjs'

async function createProject() {
  return mkdtemp(join(tmpdir(), 'nextspark-template-analysis-test-'))
}

async function writeThemeTemplate(root, relativePath, content) {
  const absolutePath = join(root, 'contents/themes/testtheme/templates', relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
  return `@/contents/themes/testtheme/templates/${relativePath}`
}

/**
 * A layout that had a default export when the build read it and has lost it
 * on disk since.
 */
async function layoutThatLostItsDefaultExport(root) {
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
  const analysis = new Map([
    [templatePath, { hasDefaultExport: true, generatesRoute: true, segmentConfig: {}, moduleExports: ['viewport'] }]
  ])
  return { template, analysis, config: { outputDir: join(root, '.nextspark/registries'), projectRoot: root } }
}

test('the server registry takes the default export from the analysis, not from the template file', async () => {
  const root = await createProject()
  try {
    const { template, analysis, config } = await layoutThatLostItsDefaultExport(root)

    const out = await generateTemplateRegistry([template], config, analysis)

    assert.match(
      out,
      /component: lazyTemplate\('app\/docs\/layout\.tsx', \(\) => import\('@\/contents\/themes\/testtheme\/templates\/docs\/layout'\)\)/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the client registry takes the default export from the analysis, not from the template file', async () => {
  const root = await createProject()
  try {
    const { template, analysis, config } = await layoutThatLostItsDefaultExport(root)

    const out = await generateTemplateRegistryClient([template], config, analysis)

    assert.match(out, /'app\/docs\/layout\.tsx': dynamic\(\(\) => import\('@\/contents\/themes\/testtheme\/templates\/docs\/layout'\)\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the page generator takes the default export and route-level exports from the analysis, not from the template file', async () => {
  const root = await createProject()
  try {
    const { template, analysis, config } = await layoutThatLostItsDefaultExport(root)

    await generateMissingPages([template], config, analysis)

    const generated = await readFile(join(root, 'app/(templates)/docs/layout.tsx'), 'utf8')
    assert.match(generated, /import TemplateComponent from '@\/contents\/themes\/testtheme\/templates\/docs\/layout'/)
    assert.match(generated, /export \{ viewport \} from/)
    assert.doesNotMatch(generated, /Pass-through component/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('the page generator takes whether to write a route file from the analysis, not from the app on disk', async () => {
  const root = await createProject()
  try {
    // The analysis was taken while app/pricing/page.tsx existed; it is gone now.
    const templatePath = await writeThemeTemplate(root, 'pricing/page.tsx', 'export default function Page() { return null }\n')
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
    const analysis = new Map([
      [templatePath, { hasDefaultExport: true, generatesRoute: false, segmentConfig: {}, moduleExports: [] }]
    ])

    await generateMissingPages([template], { projectRoot: root }, analysis)

    assert.equal(existsSync(join(root, 'app/(templates)/pricing/page.tsx')), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a registry given no analysis for a template fails instead of reading the template itself', async () => {
  const root = await createProject()
  try {
    const { template, config } = await layoutThatLostItsDefaultExport(root)

    await assert.rejects(() => generateTemplateRegistry([template], config, new Map()), /was not read by analyzeTemplates/)
    await assert.rejects(() => generateTemplateRegistryClient([template], config, new Map()), /was not read by analyzeTemplates/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
