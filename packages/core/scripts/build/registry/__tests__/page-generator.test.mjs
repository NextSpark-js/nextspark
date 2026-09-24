/**
 * Tests for the page-generator's route-level export handling.
 *
 * Next.js only reads route segment config (`revalidate`, `dynamic`, etc.)
 * when it's a literal `export const` declared directly in the route file -
 * a re-export is silently ignored and the default config is used instead
 * (#191). The generator has to tell the two kinds of route export apart:
 * segment config gets re-declared as a literal, everything else (metadata,
 * generateMetadata, ...) can be forwarded with a plain re-export.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/page-generator.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'

import {
  SEGMENT_CONFIG_EXPORTS,
  MODULE_LEVEL_EXPORTS,
  analyzeTemplates,
  extractRouteExports,
  generateTemplatePage,
  selectTypeScriptModule,
  willGenerateRoute,
} from '../post-build/page-generator.mjs'

const FIXTURE_FILE = '/virtual/theme/templates/(public)/page.tsx'
const FIXTURE_FILE_PATTERN = FIXTURE_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// --- helpers for the content-generation tests ------------------------------

async function createProjectRoot() {
  return mkdtemp(join(tmpdir(), 'nextspark-page-generator-test-'))
}

// The registry build parses templates once, with analyzeTemplates, and the page
// generator renders from that analysis. Generating a single page does the same.
async function generatePage(template, outputPath, root) {
  const analysis = await analyzeTemplates([template], { projectRoot: root })
  await generateTemplatePage(template, outputPath, analysis)
}

async function writeThemeTemplate(root, relativePath, content) {
  const absolutePath = join(root, 'templates', relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
  return `@/templates/${relativePath}`
}

// --- the two exported export-name tables ------------------------------------

test('segment config and module-level export lists do not overlap', () => {
  const overlap = SEGMENT_CONFIG_EXPORTS.filter(name => MODULE_LEVEL_EXPORTS.includes(name))
  assert.deepEqual(overlap, [])
})

test('experimental_ppr is one of the tracked segment config keys', () => {
  assert.ok(SEGMENT_CONFIG_EXPORTS.includes('experimental_ppr'))
})

// --- extractRouteExports: valid segment config literals ---------------------

test('a number literal is captured as segment config', async () => {
  const { segmentConfig } = await extractRouteExports('export const maxDuration = 30\n', FIXTURE_FILE)
  assert.equal(segmentConfig.maxDuration, 30)
})

test('revalidate = false is captured as a literal, not treated as absent', async () => {
  const { segmentConfig } = await extractRouteExports('export const revalidate = false\n', FIXTURE_FILE)
  assert.equal(segmentConfig.revalidate, false)
})

test('a valid enum string is captured', async () => {
  const { segmentConfig } = await extractRouteExports("export const dynamic = 'force-static'\n", FIXTURE_FILE)
  assert.equal(segmentConfig.dynamic, 'force-static')
})

test('an array of strings is captured', async () => {
  const { segmentConfig } = await extractRouteExports("export const preferredRegion = ['iad1', 'sfo1']\n", FIXTURE_FILE)
  assert.deepEqual(segmentConfig.preferredRegion, ['iad1', 'sfo1'])
})

test('a satisfies-wrapped literal is unwrapped and captured', async () => {
  const { segmentConfig } = await extractRouteExports(
    "export const runtime = 'edge' satisfies 'edge' | 'nodejs'\n",
    FIXTURE_FILE
  )
  assert.equal(segmentConfig.runtime, 'edge')
})

test('an as-const-wrapped literal is unwrapped and captured', async () => {
  const { segmentConfig } = await extractRouteExports('export const dynamicParams = false as const\n', FIXTURE_FILE)
  assert.equal(segmentConfig.dynamicParams, false)
})

test('a boolean literal is captured for experimental_ppr', async () => {
  const { segmentConfig } = await extractRouteExports('export const experimental_ppr = true\n', FIXTURE_FILE)
  assert.equal(segmentConfig.experimental_ppr, true)
})

// --- extractRouteExports: module-level exports -------------------------------

test('an exported function declaration is a module-level export', async () => {
  const { moduleExports, segmentConfig } = await extractRouteExports(
    'export async function generateMetadata() { return {} }\n',
    FIXTURE_FILE
  )
  assert.deepEqual(moduleExports, ['generateMetadata'])
  assert.deepEqual(segmentConfig, {})
})

test('a locally re-exported function is a module-level export', async () => {
  const source = `async function generateStaticParams() { return [] }\nexport { generateStaticParams }\n`
  const { moduleExports } = await extractRouteExports(source, FIXTURE_FILE)
  assert.deepEqual(moduleExports, ['generateStaticParams'])
})

test('an exported const object (metadata) is a module-level export, value untouched', async () => {
  const source = `export const metadata = { title: 'Blog' }\n`
  const { moduleExports, segmentConfig } = await extractRouteExports(source, FIXTURE_FILE)
  assert.deepEqual(moduleExports, ['metadata'])
  assert.deepEqual(segmentConfig, {})
})

// --- extractRouteExports: what does NOT count as an export -------------------

test('a commented-out export is not detected', async () => {
  const source = '// export const revalidate = 60\nexport default function Page() { return null }\n'
  const { segmentConfig } = await extractRouteExports(source, FIXTURE_FILE)
  assert.deepEqual(segmentConfig, {})
})

test('export syntax inside a string literal is not detected', async () => {
  const source = 'const code = "export const revalidate = 60"\nexport default function Page() { return null }\n'
  const { segmentConfig } = await extractRouteExports(source, FIXTURE_FILE)
  assert.deepEqual(segmentConfig, {})
})

// --- extractRouteExports: invalid segment config must throw ------------------

test('an expression value fails with an error naming the file and the key', async () => {
  await assert.rejects(
    () => extractRouteExports('export const revalidate = 60 * 60\n', FIXTURE_FILE),
    error => {
      assert.match(error.message, new RegExp(FIXTURE_FILE_PATTERN))
      assert.match(error.message, /"revalidate"/)
      assert.match(error.message, /literal/)
      return true
    }
  )
})

test('an identifier value fails', async () => {
  const source = 'const HOUR = 3600\nexport const revalidate = HOUR\n'
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /"revalidate"/)
})

test('re-exporting a segment config key from another module fails', async () => {
  const source = "export { revalidate } from './shared-config'\n"
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /re-exported from another module/)
})

test('a local export specifier (no inline const) fails for a segment config key', async () => {
  const source = 'const revalidate = 60\nexport { revalidate }\n'
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /"revalidate"/)
})

test('let/var for a segment config key fails', async () => {
  const source = "export let dynamic = 'force-static'\n"
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /"let" or "var"/)
})

test('a value outside the schema fails', async () => {
  const source = "export const dynamic = 'nonsense'\n"
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /outside what Next\.js accepts/)
})

test('a negative maxDuration fails schema validation', async () => {
  const source = 'export const maxDuration = -5\n'
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /"maxDuration"/)
})

test('an array with a non-string element fails schema validation', async () => {
  const source = "export const preferredRegion = ['iad1', 42]\n"
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), /"preferredRegion"/)
})

test('the error names the line the bad export is declared on', async () => {
  const source = "import { x } from 'y'\n\nexport const revalidate = computeRevalidate()\n"
  await assert.rejects(() => extractRouteExports(source, FIXTURE_FILE), new RegExp(`${FIXTURE_FILE_PATTERN}:3`))
})

// --- generated page content ---------------------------------------------------

test('the generated page re-declares segment config as a literal and forwards module exports separately', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(
      root,
      '(public)/blog/[slug]/page.tsx',
      "export async function generateMetadata() { return {} }\nexport const revalidate = 3600\nexport default function Page() { return null }\n"
    )

    const outputPath = join(root, 'src/app/(templates)/(public)/blog/[slug]/page.tsx')
    await generatePage(
      { appPath: 'app/(public)/blog/[slug]/page.tsx', templateType: 'page', name: '(public)/blog/[slug]/page', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /export const revalidate = 3600/)
    assert.match(generated, /export \{ generateMetadata \} from '@\/templates\/\(public\)\/blog\/\[slug\]\/page'/)

    const exportBlockLine = generated.split('\n').find(line => line.startsWith('export {'))
    assert.ok(exportBlockLine, 'expected an export {} re-export line')
    for (const key of SEGMENT_CONFIG_EXPORTS) {
      assert.ok(!exportBlockLine.includes(key), `segment config key "${key}" must not appear in export {}`)
    }
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a page with no route-level exports is generated unchanged (no forwarded-exports section)', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(root, 'plain/page.tsx', 'export default function Page() { return null }\n')

    const outputPath = join(root, 'src/app/(templates)/plain/page.tsx')
    await generatePage(
      { appPath: 'app/plain/page.tsx', templateType: 'page', name: 'plain/page', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.doesNotMatch(generated, /export const/)
    assert.doesNotMatch(generated, /export \{/)
    assert.match(generated, /export default TemplateComponent\n$/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('an invalid segment config value fails page generation instead of being silently dropped', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'broken/page.tsx',
      'export const revalidate = process.env.REVALIDATE\nexport default function Page() { return null }\n'
    )

    const outputPath = join(root, 'src/app/(templates)/broken/page.tsx')
    await assert.rejects(
      () =>
        generatePage(
          { appPath: 'app/broken/page.tsx', templateType: 'page', name: 'broken/page', templatePath },
          outputPath,
          root
        ),
      /"revalidate"/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a layout with a default export and metadata forwards both, unlike the previous component-only behavior', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'dashboard/layout.tsx',
      "export const metadata = { title: 'Dashboard' }\nexport default function Layout({ children }) { return children }\n"
    )

    const outputPath = join(root, 'src/app/(templates)/dashboard/layout.tsx')
    await generatePage(
      { appPath: 'app/dashboard/layout.tsx', templateType: 'layout', name: 'dashboard/layout', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /import TemplateComponent from/)
    assert.match(generated, /export \{ metadata \} from/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a layout template with no exports at all still gets the plain pass-through wrapper', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(root, 'empty/layout.tsx', '')

    const outputPath = join(root, 'src/app/(templates)/empty/layout.tsx')
    await generatePage(
      { appPath: 'app/empty/layout.tsx', templateType: 'layout', name: 'empty/layout', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /Layout template - empty template file/)
    assert.doesNotMatch(generated, /export \{/)
    assert.doesNotMatch(generated, /export const/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- default export detection (decides component import vs pass-through) ----

for (const [label, source, expected] of [
  ['export default function', 'export default function Layout({ children }) { return children }\n', true],
  ['export default of a declared identifier', 'const Layout = ({ children }) => children\nexport default Layout\n', true],
  ['a local export clause naming default', 'function Layout({ children }) { return children }\nexport { Layout as default }\n', true],
  ['a default re-exported from another module', "export { default } from './shell'\n", true],
  ['a comment that mentions export default', "// Intentionally no export default: metadata-only layout.\nexport const metadata = { title: 'Docs' }\n", false],
  ['a string that contains export default', "export const metadata = { title: 'export default' }\n", false],
  ['a type-only default', 'type Props = { title: string }\nexport type { Props as default }\n', false],
]) {
  test(`hasDefaultExport is ${expected} for ${label}`, async () => {
    const { hasDefaultExport } = await extractRouteExports(source, FIXTURE_FILE)
    assert.equal(hasDefaultExport, expected)
  })
}

test('a metadata-only layout whose comment mentions export default gets the pass-through, not an import of a missing default', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'docs/layout.tsx',
      "// Intentionally no export default: metadata-only layout.\nexport const metadata = { title: 'Docs' }\n"
    )

    const outputPath = join(root, 'src/app/(templates)/docs/layout.tsx')
    await generatePage(
      { appPath: 'app/docs/layout.tsx', templateType: 'layout', name: 'docs/layout', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /Pass-through component/)
    assert.doesNotMatch(generated, /import TemplateComponent from/)
    assert.match(generated, /export \{ metadata \} from/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a pass-through layout on an unprotected path does not claim to be PROTECTED_RENDER', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(root, '(public)/docs/layout.tsx', "export const viewport = { themeColor: 'black' }\n")

    const outputPath = join(root, 'src/app/(templates)/(public)/docs/layout.tsx')
    await generatePage(
      { appPath: 'app/(public)/docs/layout.tsx', templateType: 'layout', name: '(public)/docs/layout', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /Pass-through component \(the theme template exports no component/)
    assert.doesNotMatch(generated, /PROTECTED_RENDER/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a pass-through layout on a PROTECTED_RENDER path is labeled as one', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(root, 'layout.tsx', "export const metadata = { title: 'App' }\n")

    const outputPath = join(root, 'src/app/(templates)/layout.tsx')
    await generatePage({ appPath: 'app/layout.tsx', templateType: 'layout', name: 'layout', templatePath }, outputPath, root)

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /Layout template - metadata-only \(PROTECTED_RENDER\)/)
    assert.match(generated, /Pass-through component \(actual rendering blocked by PROTECTED_RENDER\)/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a layout exported through `export { X as default }` imports the theme component instead of a pass-through', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'dashboard/layout.tsx',
      'function DashboardLayout({ children }) { return children }\nexport { DashboardLayout as default }\n'
    )

    const outputPath = join(root, 'src/app/(templates)/dashboard/layout.tsx')
    await generatePage(
      { appPath: 'app/dashboard/layout.tsx', templateType: 'layout', name: 'dashboard/layout', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /import TemplateComponent from/)
    assert.doesNotMatch(generated, /Pass-through component|empty template file/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- parsing as the template's own kind of file ------------------------------

test('a .ts template is parsed as TypeScript, so syntax a TSX parse reads as JSX keeps its default export', async () => {
  const source = 'type Props = { children: string }\nconst Layout = <T>({ children }: T & Props): string => children\nexport default Layout\n'
  const { hasDefaultExport } = await extractRouteExports(source, '/virtual/theme/templates/(public)/layout.ts')
  assert.equal(hasDefaultExport, true)
})

test('a .ts layout with TypeScript-only syntax imports the theme component instead of a pass-through', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(
      root,
      'reports/layout.ts',
      "import type { ReactNode } from 'react'\nconst ReportsLayout = <T>({ children }: T & { children: ReactNode }) => children\nexport default ReportsLayout\n"
    )

    const outputPath = join(root, 'src/app/(templates)/reports/layout.ts')
    await generatePage(
      { appPath: 'app/reports/layout.ts', templateType: 'layout', name: 'reports/layout', templatePath },
      outputPath,
      root
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /import TemplateComponent from/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a template that does not parse fails with its file and line instead of being read in part', async () => {
  const source = 'export const revalidate = 60\nexport default function Page( {\n'
  await assert.rejects(
    () => extractRouteExports(source, FIXTURE_FILE),
    new RegExp(`${FIXTURE_FILE_PATTERN}:\\d+: the template does not parse`)
  )
})

test('a template using syntax TypeScript rejects but Next.js accepts retains its route exports', async () => {
  const source = "import source wasm from './module.wasm'\nexport const runtime = 'edge'\nexport default wasm\n"
  for (const file of ['/virtual/theme/templates/(public)/page.ts', FIXTURE_FILE]) {
    const routeExports = await extractRouteExports(source, file)
    assert.deepEqual(routeExports.segmentConfig, { runtime: 'edge' })
    assert.equal(routeExports.hasDefaultExport, true)
  }
})

test('a syntax error rejected by both TypeScript and Next.js is rejected even when TypeScript recovers later route exports', async () => {
  const source = "import = './module.wasm'\nexport const runtime = 'edge'\nexport default wasm\n"
  for (const file of ['/virtual/theme/templates/(public)/page.ts', FIXTURE_FILE]) {
    await assert.rejects(() => extractRouteExports(source, file), /the template does not parse/)
  }
})

// --- selectTypeScriptModule: picking a candidate with the TS 5/6 compiler API (#195) --

// A stand-in for TypeScript 7's native port: it has a version but none of the
// compiler API (`createSourceFile`, `getScriptKindFromFileName`, `ScriptKind`)
// this generator parses templates with.
const fakeTypeScript7 = { version: '7.0.2' }

const fakeTypeScript5 = {
  version: '5.9.3',
  createSourceFile: () => ({}),
  getScriptKindFromFileName: () => 1,
  ScriptKind: { TSX: 4 },
}

test('a candidate with the compiler API is used', async () => {
  const ts = await selectTypeScriptModule([{ label: 'only candidate', load: async () => fakeTypeScript5 }])
  assert.equal(ts, fakeTypeScript5)
})

test('a candidate module shaped like an ESM default export is unwrapped', async () => {
  const ts = await selectTypeScriptModule([{ label: 'only candidate', load: async () => ({ default: fakeTypeScript5 }) }])
  assert.equal(ts, fakeTypeScript5)
})

test('a TypeScript 7 candidate without the compiler API is skipped in favor of the next candidate that has it', async () => {
  const ts = await selectTypeScriptModule([
    { label: '@nextsparkjs/core', load: async () => fakeTypeScript7 },
    { label: 'the project', load: async () => fakeTypeScript5 },
  ])
  assert.equal(ts, fakeTypeScript5)
})

test('a candidate whose load() rejects is skipped in favor of the next candidate', async () => {
  const ts = await selectTypeScriptModule([
    { label: '@nextsparkjs/core', load: async () => { throw new Error('Cannot find module \'typescript\'') } },
    { label: 'the project', load: async () => fakeTypeScript5 },
  ])
  assert.equal(ts, fakeTypeScript5)
})

test('no candidate providing the compiler API fails with a message naming each candidate and what was found', async () => {
  await assert.rejects(
    () =>
      selectTypeScriptModule([
        { label: '@nextsparkjs/core', load: async () => fakeTypeScript7 },
        { label: 'the project at /virtual/project', load: async () => { throw new Error('Cannot find module \'typescript\'') } },
      ]),
    error => {
      assert.match(error.message, /TypeScript 5 or 6 compiler API/)
      assert.match(error.message, /@nextsparkjs\/core.*TypeScript 7\.0\.2/)
      assert.match(error.message, /the project at \/virtual\/project.*could not be loaded/)
      assert.doesNotMatch(error.message, /createSourceFile is not a function/)
      return true
    }
  )
})

// --- willGenerateRoute: whether the page generator writes a route file importing the template (#197) --

test('willGenerateRoute is always true for a layout, whether or not the app already has one', async () => {
  const root = await createProjectRoot()
  try {
    assert.equal(willGenerateRoute('app/dashboard/layout.tsx', 'layout', root), true)

    await mkdir(join(root, 'src/app/dashboard'), { recursive: true })
    await writeFile(join(root, 'src/app/dashboard/layout.tsx'), 'export default function Layout({ children }) { return children }\n', 'utf8')
    assert.equal(willGenerateRoute('app/dashboard/layout.tsx', 'layout', root), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

// --- analyzeTemplates: what the build reads from each template, and generates from (#197) --

test('analyzeTemplates records, per template path, its route-level exports, whether it has a default export and whether a route file is generated', async () => {
  const root = await createProjectRoot()
  try {
    const layoutPath = await writeThemeTemplate(root, 'docs/layout.tsx', "export const revalidate = 60\nexport const viewport = { themeColor: 'black' }\n")
    const pagePath = await writeThemeTemplate(root, 'pricing/page.tsx', 'export default function Page() { return null }\n')
    await mkdir(join(root, 'src/app/pricing'), { recursive: true })
    await writeFile(join(root, 'src/app/pricing/page.tsx'), 'export default function Page() { return null }\n', 'utf8')
    const layout = { appPath: 'app/docs/layout.tsx', templateType: 'layout', name: 'docs/layout', templatePath: layoutPath }
    const page = { appPath: 'app/pricing/page.tsx', templateType: 'page', name: 'pricing/page', templatePath: pagePath }

    const analysis = await analyzeTemplates([layout, page, { ...page }], { projectRoot: root })

    assert.deepEqual([...analysis.keys()], [layoutPath, pagePath])
    assert.deepEqual(analysis.get(layoutPath), {
      segmentConfig: { revalidate: 60 },
      moduleExports: ['viewport'],
      hasDefaultExport: false,
      generatesRoute: true,
    })
    assert.deepEqual(analysis.get(pagePath), { segmentConfig: {}, moduleExports: [], hasDefaultExport: true, generatesRoute: false })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('generating a page from an analysis that never read its template fails instead of reading the template', async () => {
  const root = await createProjectRoot()
  try {
    const templatePath = await writeThemeTemplate(root, 'plain/page.tsx', 'export default function Page() { return null }\n')

    await assert.rejects(
      () =>
        generateTemplatePage(
          { appPath: 'app/plain/page.tsx', templateType: 'page', name: 'plain/page', templatePath },
          join(root, 'src/app/(templates)/plain/page.tsx'),
          new Map()
        ),
      /was not read by analyzeTemplates/
    )
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('willGenerateRoute is true for a page only when the app has no file there yet', async () => {
  const root = await createProjectRoot()
  try {
    assert.equal(willGenerateRoute('app/docs/page.tsx', 'page', root), true)

    await mkdir(join(root, 'src/app/docs'), { recursive: true })
    await writeFile(join(root, 'src/app/docs/page.tsx'), 'export default function Page() { return null }\n', 'utf8')
    assert.equal(willGenerateRoute('app/docs/page.tsx', 'page', root), false)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
