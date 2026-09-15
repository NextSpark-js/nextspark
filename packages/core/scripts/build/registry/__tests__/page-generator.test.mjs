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
  extractRouteExports,
  generateTemplatePage,
  generateMissingPages,
} from '../post-build/page-generator.mjs'

const FIXTURE_FILE = '/virtual/theme/templates/(public)/page.tsx'
const FIXTURE_FILE_PATTERN = FIXTURE_FILE.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

// --- helpers for the content-generation tests ------------------------------

async function createProjectRoot() {
  return mkdtemp(join(tmpdir(), 'nextspark-page-generator-test-'))
}

// generateTemplatePage resolves '@/...' template paths against the
// generator's module-level rootDir, which is only ever set as a side effect
// of generateMissingPages. Templates being empty makes it a no-op beyond
// that assignment (cleanupOrphanedTemplates returns early when app/(templates)
// doesn't exist yet under the given root).
async function useProjectRoot(root) {
  await generateMissingPages([], { projectRoot: root })
}

async function writeThemeTemplate(root, relativePath, content) {
  const absolutePath = join(root, 'contents/themes/testtheme/templates', relativePath)
  await mkdir(dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, content, 'utf8')
  return `@/contents/themes/testtheme/templates/${relativePath}`
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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(
      root,
      '(public)/blog/[slug]/page.tsx',
      "export async function generateMetadata() { return {} }\nexport const revalidate = 3600\nexport default function Page() { return null }\n"
    )

    const outputPath = join(root, 'app/(templates)/(public)/blog/[slug]/page.tsx')
    await generateTemplatePage(
      { appPath: 'app/(public)/blog/[slug]/page.tsx', templateType: 'page', name: '(public)/blog/[slug]/page', templatePath },
      outputPath
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /export const revalidate = 3600/)
    assert.match(generated, /export \{ generateMetadata \} from '@\/contents\/themes\/testtheme\/templates\/\(public\)\/blog\/\[slug\]\/page'/)

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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(root, 'plain/page.tsx', 'export default function Page() { return null }\n')

    const outputPath = join(root, 'app/(templates)/plain/page.tsx')
    await generateTemplatePage(
      { appPath: 'app/plain/page.tsx', templateType: 'page', name: 'plain/page', templatePath },
      outputPath
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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(
      root,
      'broken/page.tsx',
      'export const revalidate = process.env.REVALIDATE\nexport default function Page() { return null }\n'
    )

    const outputPath = join(root, 'app/(templates)/broken/page.tsx')
    await assert.rejects(
      () =>
        generateTemplatePage(
          { appPath: 'app/broken/page.tsx', templateType: 'page', name: 'broken/page', templatePath },
          outputPath
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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(
      root,
      'dashboard/layout.tsx',
      "export const metadata = { title: 'Dashboard' }\nexport default function Layout({ children }) { return children }\n"
    )

    const outputPath = join(root, 'app/(templates)/dashboard/layout.tsx')
    await generateTemplatePage(
      { appPath: 'app/dashboard/layout.tsx', templateType: 'layout', name: 'dashboard/layout', templatePath },
      outputPath
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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(root, 'empty/layout.tsx', '')

    const outputPath = join(root, 'app/(templates)/empty/layout.tsx')
    await generateTemplatePage(
      { appPath: 'app/empty/layout.tsx', templateType: 'layout', name: 'empty/layout', templatePath },
      outputPath
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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(
      root,
      'docs/layout.tsx',
      "// Intentionally no export default: metadata-only layout.\nexport const metadata = { title: 'Docs' }\n"
    )

    const outputPath = join(root, 'app/(templates)/docs/layout.tsx')
    await generateTemplatePage(
      { appPath: 'app/docs/layout.tsx', templateType: 'layout', name: 'docs/layout', templatePath },
      outputPath
    )

    const generated = await readFile(outputPath, 'utf8')
    assert.match(generated, /Layout template - metadata-only/)
    assert.doesNotMatch(generated, /import TemplateComponent from/)
    assert.match(generated, /export \{ metadata \} from/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('a layout exported through `export { X as default }` imports the theme component instead of a pass-through', async () => {
  const root = await createProjectRoot()
  try {
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(
      root,
      'dashboard/layout.tsx',
      'function DashboardLayout({ children }) { return children }\nexport { DashboardLayout as default }\n'
    )

    const outputPath = join(root, 'app/(templates)/dashboard/layout.tsx')
    await generateTemplatePage(
      { appPath: 'app/dashboard/layout.tsx', templateType: 'layout', name: 'dashboard/layout', templatePath },
      outputPath
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
    await useProjectRoot(root)
    const templatePath = await writeThemeTemplate(
      root,
      'reports/layout.ts',
      "import type { ReactNode } from 'react'\nconst ReportsLayout = <T>({ children }: T & { children: ReactNode }) => children\nexport default ReportsLayout\n"
    )

    const outputPath = join(root, 'app/(templates)/reports/layout.ts')
    await generateTemplatePage(
      { appPath: 'app/reports/layout.ts', templateType: 'layout', name: 'reports/layout', templatePath },
      outputPath
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

test('syntax Next.js parses but the installed TypeScript does not (a source phase import) is read instead of rejected', async () => {
  const source = "import source wasm from './module.wasm'\nexport const runtime = 'edge'\nexport default wasm\n"
  for (const file of ['/virtual/theme/templates/(public)/page.ts', FIXTURE_FILE]) {
    const { segmentConfig, hasDefaultExport } = await extractRouteExports(source, file)
    assert.deepEqual(segmentConfig, { runtime: 'edge' }, file)
    assert.equal(hasDefaultExport, true, file)
  }
})
