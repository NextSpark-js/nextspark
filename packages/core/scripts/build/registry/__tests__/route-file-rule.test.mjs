/**
 * One rule decides what becomes of a theme template's route file, for every
 * generator core exposes that writes route files or registers template
 * components (`routeFileAction` in page-generator.mjs):
 * - a template the page generator writes a route file for gets one;
 * - a template over a route the app already has gets none, and the generator
 *   goes on without failing;
 * - a page whose route file would import a default export it doesn't have is
 *   rejected, and nothing is written.
 *
 * Each generator runs over the same cases, with an analysis and without one.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/route-file-rule.test.mjs
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
import { analyzeTemplates, generateMissingPages, generateTemplatePage } from '../post-build/page-generator.mjs'

const PAGE = 'export default function Page() { return null }\n'
const METADATA_ONLY = "export const metadata = { title: 'Docs' }\n"
const ROUTE_FILE = 'src/app/(templates)/docs/page.tsx'

/**
 * - `route`: what the page generator does with the template's route file
 * - `component`: how the registries register the template
 */
const CASES = [
  { name: 'a page.tsx with a default export, no app page', file: 'page.tsx', content: PAGE, appPage: false, route: 'write', component: 'deferred' },
  { name: 'a page.tsx with a default export, over an app page', file: 'page.tsx', content: PAGE, appPage: true, route: 'skip', component: 'deferred' },
  { name: 'a page.tsx with no default export, no app page', file: 'page.tsx', content: METADATA_ONLY, appPage: false, route: 'reject' },
  { name: 'a page.tsx with no default export, over an app page', file: 'page.tsx', content: METADATA_ONLY, appPage: true, route: 'skip', component: 'none' },
  { name: 'a page.meta.ts, no app page', file: 'page.meta.ts', content: METADATA_ONLY, appPage: false, route: 'reject' },
  { name: 'a page.meta.ts, over an app page', file: 'page.meta.ts', content: METADATA_ONLY, appPage: true, route: 'skip', component: 'none' },
]

async function writeProjectFile(root, relativePath, content) {
  const absolutePath = join(root, relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
}

/** A project with the case's theme template for app/docs/page.tsx, and that app page when the case has one. */
async function projectFor(testCase) {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-route-file-rule-test-'))
  const relativePath = `docs/${testCase.file}`
  await writeProjectFile(root, join('templates', relativePath), testCase.content)
  if (testCase.appPage) {
    await writeProjectFile(root, 'src/app/docs/page.tsx', PAGE)
  }

  const template = {
    name: 'docs/page',
    themeName: 'testtheme',
    templateType: 'page',
    fileName: testCase.file,
    relativePath,
    appPath: 'app/docs/page.tsx',
    templatePath: `@/templates/${relativePath}`,
    priority: 10
  }
  const config = { outputDir: join(root, '.nextspark/registries'), projectRoot: root }

  return { root, template, config, cleanup: () => rm(root, { recursive: true, force: true }) }
}

/**
 * The analysis a caller hands a generator. For a template analyzeTemplates
 * accepts, that is its analysis. analyzeTemplates rejects the others itself, so
 * for those this is the entry it would record - which leaves the generator's
 * own use of the rule as the thing under test.
 */
async function analysisFor(testCase, template, config) {
  if (testCase.route !== 'reject') {
    return analyzeTemplates([template], config)
  }
  return new Map([
    [template.templatePath, { segmentConfig: {}, moduleExports: ['metadata'], hasDefaultExport: false, generatesRoute: true }]
  ])
}

/** Run `check` for every case, with and without an analysis, in a fresh project each time. */
async function forEachCase(check) {
  for (const testCase of CASES) {
    for (const withAnalysis of [false, true]) {
      const label = `${testCase.name}, ${withAnalysis ? 'with' : 'without'} an analysis`
      const project = await projectFor(testCase)
      try {
        const analysis = withAnalysis ? await analysisFor(testCase, project.template, project.config) : undefined
        await check({ testCase, label, analysis, ...project })
      } finally {
        await project.cleanup()
      }
    }
  }
}

test('generateTemplatePage writes a route file only where one is generated, and rejects one that would break', async () => {
  await forEachCase(async ({ testCase, label, analysis, root, template }) => {
    // generateTemplatePage resolves templates against the last project root generateMissingPages was given
    await generateMissingPages([], { projectRoot: root })
    const outputPath = join(root, ROUTE_FILE)

    if (testCase.route === 'reject') {
      await assert.rejects(() => generateTemplatePage(template, outputPath, analysis), /has no default export/, label)
      assert.equal(existsSync(outputPath), false, label)
      return
    }

    const result = await generateTemplatePage(template, outputPath, analysis)
    assert.equal(result?.written, testCase.route === 'write', label)
    assert.equal(existsSync(outputPath), testCase.route === 'write', label)
    if (testCase.route === 'write') {
      assert.match(await readFile(outputPath, 'utf8'), /import TemplateComponent from/, label)
    }
  })
})

test('generateMissingPages writes a route file only where one is generated, and rejects one that would break before writing anything', async () => {
  await forEachCase(async ({ testCase, label, analysis, root, template, config }) => {
    if (testCase.route === 'reject') {
      await assert.rejects(() => generateMissingPages([template], config, analysis), /has no default export/, label)
      assert.equal(existsSync(join(root, 'src/app/(templates)')), false, label)
      return
    }

    await generateMissingPages([template], config, analysis)
    assert.equal(existsSync(join(root, ROUTE_FILE)), testCase.route === 'write', label)
  })
})

test('generateTemplateRegistry registers a component only for a template that has one, and rejects a route that would break', async () => {
  await forEachCase(async ({ testCase, label, analysis, template, config }) => {
    if (testCase.route === 'reject') {
      await assert.rejects(() => generateTemplateRegistry([template], config, analysis), /has no default export/, label)
      return
    }

    const out = await generateTemplateRegistry([template], config, analysis)
    const component = testCase.component === 'deferred'
      ? /component: lazyTemplate\('app\/docs\/page\.tsx'/
      : /'app\/docs\/page\.tsx': \{\n\s*appPath: 'app\/docs\/page\.tsx',\n\s*component: null,/
    assert.match(out, component, label)
  })
})

test('generateTemplateRegistryClient registers a component only for a template that has one, and rejects a route that would break', async () => {
  await forEachCase(async ({ testCase, label, analysis, template, config }) => {
    if (testCase.route === 'reject') {
      await assert.rejects(() => generateTemplateRegistryClient([template], config, analysis), /has no default export/, label)
      return
    }

    const out = await generateTemplateRegistryClient([template], config, analysis)
    if (testCase.component === 'deferred') {
      assert.match(out, /'app\/docs\/page\.tsx': dynamic\(/, label)
    } else {
      assert.doesNotMatch(out, /'app\/docs\/page\.tsx'/, label)
    }
  })
})
