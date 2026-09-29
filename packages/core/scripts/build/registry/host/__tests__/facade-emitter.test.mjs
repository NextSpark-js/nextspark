/**
 * Tests for the generated host's route facade emitter (#203).
 *
 * Covers every row of next-route-exports.json (kind x export -> emitted form),
 * every diagnostic, and pins the table to the installed Next.js: its version,
 * segment config keys, HTTP methods and literal reader. The literal and
 * static-info checks use Next.js's own parser as the oracle, so the facade is
 * proven to be read by Next.js the way the hand-written route file would be.
 *
 * Run: node --test packages/core/scripts/build/registry/host/__tests__/facade-emitter.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdir, mkdtemp, readFile, realpath, rm, writeFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  DIAGNOSTICS,
  FacadeEmitError,
  ROUTE_EXPORT_TABLE,
  ROUTE_KINDS,
  analyzeRouteSource,
  emitFacade,
  evaluateNextLiteral,
  isSupportedNextVersion,
  kindForFileStem,
  loadNextSegmentConfig,
  planFacade,
  renderExportTableMarkdown,
  renderFacade,
} from '../facade-emitter.mjs'
import { loadTypeScriptFor } from '../../shared/typescript-compiler.mjs'
import { checkGeneratedModule } from '../static-imports.mjs'

const HOST_DIR = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE_ROOT = join(HOST_DIR, '../../../..')
const requireFromCore = createRequire(join(CORE_ROOT, 'package.json'))
const FILE = '/virtual/project/templates/example/source.tsx'
const SPECIFIER = '@/templates/example/source'

// A valid literal for every statically-read key.
const LITERALS = {
  revalidate: '60',
  dynamicParams: 'false',
  dynamic: "'force-static'",
  fetchCache: "'default-cache'",
  instant: "{ level: 'warning' }",
  prefetch: "'auto'",
  unstable_dynamicStaleTime: '30',
  preferredRegion: "['iad1', 'sfo1']",
  runtime: "'nodejs'",
  maxDuration: '10',
  config: '{ regions: [] }',
}

const HTTP_METHOD = /^[A-Z]+$/

function targetFor(kind, extension = kind === 'route' || ROUTE_EXPORT_TABLE.kinds[kind].serverOnly ? 'ts' : 'tsx') {
  return `example/${ROUTE_EXPORT_TABLE.kinds[kind].file}.${extension}`
}

/** A minimal valid source for `kind`, plus `extra` source lines. */
function sourceFor(kind, extra = '') {
  const spec = ROUTE_EXPORT_TABLE.kinds[kind]
  const lines = []
  if (spec.sourceMustBeClient) lines.push("'use client'")
  if (spec.exports.default) lines.push('export default function Component() { return null }')
  if (kind === 'route' && !/export (async )?function [A-Z]+\b/.test(extra)) lines.push('export async function GET() { return new Response() }')
  lines.push(extra)
  return lines.join('\n')
}

function exportLineFor(name) {
  if (LITERALS[name]) return `export const ${name} = ${LITERALS[name]}`
  if (['metadata', 'viewport', 'size'].includes(name)) return `export const ${name} = { width: 1 }`
  if (['alt', 'contentType'].includes(name)) return `export const ${name} = 'x'`
  return `export async function ${name}() { return [] }`
}

async function plan(kind, source, options = {}) {
  const analysis = await analyzeRouteSource({ source, file: FILE, projectRoot: CORE_ROOT })
  return planFacade({
    kind,
    target: options.target ?? targetFor(kind),
    specifier: options.specifier ?? SPECIFIER,
    file: FILE,
    analysis,
    cacheComponents: options.cacheComponents,
    nextSegmentConfig: loadNextSegmentConfig(CORE_ROOT),
  })
}

function codes(result) {
  return result.diagnostics.map(diagnostic => diagnostic.code)
}

// --- the table is pinned to the installed Next.js ---------------------------

test('the installed Next.js is one the table applies to (~baseline)', () => {
  const installed = requireFromCore('next/package.json').version
  assert.ok(isSupportedNextVersion(installed), `next@${installed} is outside ~${ROUTE_EXPORT_TABLE.next}: re-verify next-route-exports.json`)
})

test("segment config keys are Next.js's AppSegmentConfigSchemaKeys", () => {
  const { AppSegmentConfigSchemaKeys } = requireFromCore('next/dist/build/segment-config/app/app-segment-config')
  assert.deepEqual([...ROUTE_EXPORT_TABLE.segmentConfig.keys].sort(), [...AppSegmentConfigSchemaKeys].sort())
})

test("route handler methods are Next.js's HTTP_METHODS", () => {
  const { HTTP_METHODS } = requireFromCore('next/dist/server/web/http')
  const methods = Object.keys(ROUTE_EXPORT_TABLE.kinds.route.exports).filter(name => HTTP_METHOD.test(name))
  assert.deepEqual(methods.sort(), [...HTTP_METHODS].sort())
})

test("page and layout exports include Next.js's TS-plugin ALLOWED_EXPORTS (except legacy config on layouts)", () => {
  const { ALLOWED_EXPORTS } = requireFromCore('next/dist/server/typescript/constant')
  for (const name of ALLOWED_EXPORTS) {
    assert.ok(ROUTE_EXPORT_TABLE.kinds.page.exports[name], `page: ${name}`)
    if (name !== 'config') assert.ok(ROUTE_EXPORT_TABLE.kinds.layout.exports[name], `layout: ${name}`)
  }
})

test('metadata route loader still filters dynamicParams/generateSitemaps out of its re-exports', async () => {
  // The table forbids dynamicParams and generateStaticParams on metadata routes because the
  // loader either drops them or declares its own; detect a Next.js change to that code.
  const loader = await readFile(requireFromCore.resolve('next/dist/build/webpack/loaders/next-metadata-route-loader'), 'utf8')
  assert.match(loader, /name !== 'default' && name !== 'generateSitemaps' && name !== 'dynamicParams'/)
  assert.match(loader, /export async function generateStaticParams/)
})

test('README.md embeds the rendered table', async () => {
  const readme = await readFile(join(HOST_DIR, 'README.md'), 'utf8')
  assert.ok(readme.includes(renderExportTableMarkdown()), 'README.md is stale: paste renderExportTableMarkdown() output into it')
})

// --- literal reading matches Next.js's extract-const-value ------------------

const LITERAL_CASES = [
  '60', '1_000', '0x10', "'force-static'", '"x"', '`plain`', 'true', 'false', 'null', 'undefined',
  "['a', 'b']", '[1, , 2]', "{ a: 1, 'b-c': [true] }", '/ab+c/gi', "'x' as const", "{ a: 1 } satisfies object",
  '<number>5', '-1', '(60)', '`a${1}`', 'someIdentifier', 'Infinity', 'call()', '[...xs]', '{ ...o }', '{ a }',
  '{ [k]: 1 }', '{ 1: 2 }', '{ m() {} }', '1n', '!0', 'x!',
]

test("evaluateNextLiteral agrees with Next.js's extractExportedConstValue", async () => {
  const { loadBindings } = requireFromCore('next/dist/build/swc')
  const { parseModule } = requireFromCore('next/dist/build/analysis/parse-module')
  const { extractExportedConstValue } = requireFromCore('next/dist/build/analysis/extract-const-value')
  await loadBindings()
  const ts = await loadTypeScriptFor(CORE_ROOT)

  for (const literal of LITERAL_CASES) {
    const source = `export const value = ${literal}\n`
    // .ts: `<number>5` is a type assertion there and JSX in a .tsx file, for both parsers.
    const nextResult = extractExportedConstValue(await parseModule('/virtual/case.ts', source), 'value')
    assert.ok(nextResult, `Next.js could not parse ${literal}`)
    const sourceFile = ts.createSourceFile('/virtual/case.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
    const ours = evaluateNextLiteral(sourceFile.statements[0].declarationList.declarations[0].initializer, ts)
    assert.equal('unsupported' in ours, 'unsupported' in nextResult, `${literal}: ours=${JSON.stringify(ours)} next=${JSON.stringify(nextResult)}`)
    if ('value' in nextResult) {
      assert.deepEqual(ours.value, nextResult.value, literal)
    }
  }
})

// --- every table row --------------------------------------------------------

for (const kind of ROUTE_KINDS) {
  const spec = ROUTE_EXPORT_TABLE.kinds[kind]
  for (const [name, form] of Object.entries(spec.exports)) {
    test(`row ${kind} x ${name} -> ${form}`, async () => {
      const extra = name === 'default' ? '' : exportLineFor(name)
      const result = await plan(kind, sourceFor(kind, extra))
      assert.deepEqual(result.diagnostics, [])
      const content = renderFacade({ specifier: SPECIFIER, facade: result.facade })
      const from = JSON.stringify(SPECIFIER)
      if (form === 'default') assert.ok(content.includes(`export { default } from ${from}`), content)
      if (form === 'reexport') assert.match(content, new RegExp(`export \\{ [^}]*\\b${name}\\b[^}]* \\} from `))
      if (form === 'literal') {
        assert.match(content, new RegExp(`^export const ${name} = `, 'm'))
        assert.doesNotMatch(content, new RegExp(`export \\{[^}]*\\b${name}\\b`))
      }
      if (spec.facadeDirective) assert.ok(content.split('\n').includes(`'${spec.facadeDirective}'`), content)
      else assert.doesNotMatch(content, /^'use /m)
      assert.deepEqual(await checkGeneratedModule({ source: content, file: targetFor(kind), grammar: 'facade', projectRoot: CORE_ROOT }), [])
    })
  }
}

test('a full page facade: default, re-exports in table order, literals with their values', async () => {
  const source = [
    "import { cache } from 'react'",
    'export const metadata = { title: "x" }',
    'export async function generateStaticParams() { return [] }',
    "export const preferredRegion = ['iad1'] as const",
    'export const revalidate = 60',
    'export type Props = { a: string }',
    'export interface Other { b: number }',
    'export default async function Page() { return null }',
  ].join('\n')
  const { content, facade } = await emitFacade({ kind: 'page', target: 'blog/[slug]/page.tsx', specifier: '@/templates/blog/[slug]/page', file: FILE, source, projectRoot: CORE_ROOT })
  assert.equal(content, [
    '// Generated by NextSpark from @/templates/blog/[slug]/page. Do not edit: regenerated on every build.',
    'export { default } from "@/templates/blog/[slug]/page"',
    'export { metadata, generateStaticParams } from "@/templates/blog/[slug]/page"',
    'export const revalidate = 60',
    'export const preferredRegion = ["iad1"]',
    '',
  ].join('\n'))
  assert.deepEqual(facade.typeOnly, ['Props', 'Other'])
})

test('a client page is forwarded without a directive; the client boundary stays in the source', async () => {
  const { content } = await emitFacade({ kind: 'page', target: 'counter/page.tsx', specifier: '@/templates/counter/page', file: FILE, source: "'use client'\nexport default function Counter() { return null }\n", projectRoot: CORE_ROOT })
  assert.doesNotMatch(content, /use client/)
})

test('an error facade carries the client directive before its exports', async () => {
  const { content } = await emitFacade({ kind: 'error', target: 'error.tsx', specifier: '@fixture-core/app/error', file: FILE, source: "'use client'\nexport default function E() { return null }\n", projectRoot: CORE_ROOT })
  const lines = content.split('\n').filter(line => line && !line.startsWith('//'))
  assert.equal(lines[0], "'use client'")
})

test('every default form is recognised: function, expression, export clause, re-export', async () => {
  for (const source of [
    'export default function A() { return null }',
    'export default class A {}',
    'const A = () => null\nexport default A',
    'const A = () => null\nexport { A as default }',
    "export { default } from './shell'",
    "export { Shell as default } from './shell'",
  ]) {
    const result = await plan('page', source)
    assert.deepEqual(codes(result), [], source)
    assert.equal(result.facade.defaultExport, true, source)
  }
})

test('runtime exports in any declaration form are re-exported by name', async () => {
  const source = [
    "export { GET } from './handlers'",
    'const handler = async () => new Response()',
    'export { handler as POST }',
    'export let PUT = handler',
    'export class PATCH {}',
  ].join('\n')
  const result = await plan('route', source)
  assert.deepEqual(codes(result), [])
  assert.deepEqual(result.facade.reexports, ['GET', 'POST', 'PUT', 'PATCH'])
})

test('emitted facades are read by Next.js exactly like a hand-written route file', async () => {
  const { loadBindings } = requireFromCore('next/dist/build/swc')
  const { getPageStaticInfo } = requireFromCore('next/dist/build/analysis/get-page-static-info')
  await loadBindings()
  const dir = await mkdtemp(join(tmpdir(), 'nextspark-facade-'))
  try {
    const source = [
      'export const revalidate = 120',
      "export const dynamic = 'force-static'",
      'export const maxDuration = 30',
      "export async function generateStaticParams() { return [{ slug: 'a' }] }",
      'export default function Page() { return null }',
    ].join('\n')
    const staticInfo = async (name, content) => {
      const pageFilePath = join(dir, name)
      await writeFile(pageFilePath, content)
      return getPageStaticInfo({ pageFilePath, nextConfig: {}, isDev: false, page: '/blog/[slug]/page', pageType: 'app' })
    }
    const handWritten = await staticInfo('hand-written.tsx', source)
    const { content } = await emitFacade({ kind: 'page', target: 'blog/[slug]/page.tsx', specifier: '@/templates/blog/page', file: FILE, source, projectRoot: CORE_ROOT })
    const facade = await staticInfo('facade.tsx', content)
    assert.deepEqual(facade.config, handWritten.config)
    assert.equal(facade.generateStaticParams, true)
    assert.equal(facade.maxDuration, 30)
    // The failure mode the literals exist for: a plain re-export loses the config.
    const naive = await staticInfo('naive.tsx', "export { default, revalidate, dynamic, maxDuration, generateStaticParams } from '@/templates/blog/page'\n")
    assert.deepEqual(naive.config, {})
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// --- every diagnostic --------------------------------------------------------

test(`${DIAGNOSTICS.PARSE_ERROR}: a module that does not parse`, async () => {
  const result = await plan('page', 'export const = ;')
  assert.deepEqual(codes(result), [DIAGNOSTICS.PARSE_ERROR])
  assert.equal(result.diagnostics[0].file, FILE)
})

test(`${DIAGNOSTICS.UNKNOWN_KIND}: a kind Next.js has no file for`, async () => {
  assert.deepEqual(codes(await plan('middleware', sourceFor('page'), { target: 'middleware.ts' })), [DIAGNOSTICS.UNKNOWN_KIND])
})

test(`${DIAGNOSTICS.TARGET_MISMATCH}: target name, escape or extension that does not fit the kind`, async () => {
  for (const target of ['example/layout.tsx', '../outside/page.tsx', '/abs/page.tsx', 'example/page.mdx', 'example/pages.tsx']) {
    assert.deepEqual(codes(await plan('page', sourceFor('page'), { target })), [DIAGNOSTICS.TARGET_MISMATCH], target)
  }
  const custom = await analyzeRouteSource({ source: sourceFor('page'), file: FILE, projectRoot: CORE_ROOT })
  assert.deepEqual(planFacade({ kind: 'page', target: 'x/page.isr.tsx', specifier: SPECIFIER, file: FILE, analysis: custom, pageExtensions: ['isr.tsx', 'tsx'] }).diagnostics, [])
})

test(`${DIAGNOSTICS.INVALID_SPECIFIER}: relative or quoted specifiers`, async () => {
  for (const specifier of ['./page', '../x', "@/a'b", '', '@/a b']) {
    assert.deepEqual(codes(await plan('page', sourceFor('page'), { specifier })), [DIAGNOSTICS.INVALID_SPECIFIER], specifier)
  }
})

test(`${DIAGNOSTICS.NON_LITERAL_SEGMENT_CONFIG}: every way a segment config export is not a literal`, async () => {
  const cases = {
    identifier: 'const sixty = 60\nexport const revalidate = sixty',
    negative: 'export const revalidate = -1',
    parenthesized: 'export const revalidate = (60)',
    call: 'export const revalidate = Number(60)',
    template: 'export const dynamic = `force-${"static"}`',
    let: 'export let revalidate = 60',
    function: 'export function revalidate() { return 60 }',
    clause: 'const revalidate = 60\nexport { revalidate }',
    reexport: "export { revalidate } from './config'",
    namespace: "export * as config from './config'",
  }
  for (const [label, extra] of Object.entries(cases)) {
    const result = await plan('page', sourceFor('page', extra))
    assert.deepEqual(codes(result), [DIAGNOSTICS.NON_LITERAL_SEGMENT_CONFIG], label)
    assert.ok(result.diagnostics[0].exportName, label)
  }
})

test(`${DIAGNOSTICS.INVALID_SEGMENT_CONFIG_VALUE}: literals Next.js's schema rejects`, async () => {
  for (const extra of ["export const dynamic = 'sometimes'", 'export const revalidate = 1.5', "export const runtime = 'bun'", 'export const maxDuration = true']) {
    assert.deepEqual(codes(await plan('page', sourceFor('page', extra))), [DIAGNOSTICS.INVALID_SEGMENT_CONFIG_VALUE], extra)
  }
})

test(`${DIAGNOSTICS.CACHE_COMPONENTS_CONFLICT}: keys cacheComponents forbids, and keys that need it`, async () => {
  for (const name of ROUTE_EXPORT_TABLE.segmentConfig.invalidWithCacheComponents) {
    const result = await plan('page', sourceFor('page', exportLineFor(name)), { cacheComponents: true })
    assert.deepEqual(codes(result), [DIAGNOSTICS.CACHE_COMPONENTS_CONFLICT], name)
    assert.equal(result.diagnostics[0].exportName, name)
  }
  for (const name of ROUTE_EXPORT_TABLE.segmentConfig.requireCacheComponents) {
    assert.deepEqual(codes(await plan('page', sourceFor('page', exportLineFor(name)), { cacheComponents: false })), [DIAGNOSTICS.CACHE_COMPONENTS_CONFLICT], name)
    assert.deepEqual(codes(await plan('page', sourceFor('page', exportLineFor(name)), { cacheComponents: true })), [], name)
  }
})

test(`${DIAGNOSTICS.CLIENT_SERVER_ONLY_EXPORT}: metadata, generateStaticParams or segment config from 'use client'`, async () => {
  for (const name of ['metadata', 'generateMetadata', 'viewport', 'generateViewport', 'generateStaticParams', 'revalidate']) {
    const result = await plan('page', `'use client'\nexport default function P() { return null }\n${exportLineFor(name)}`)
    assert.deepEqual(codes(result), [DIAGNOSTICS.CLIENT_SERVER_ONLY_EXPORT], name)
    assert.equal(result.diagnostics[0].exportName, name)
  }
  for (const kind of ['route', 'sitemap', 'opengraph-image']) {
    assert.ok(codes(await plan(kind, `'use client'\n${sourceFor(kind)}`)).includes(DIAGNOSTICS.CLIENT_SERVER_ONLY_EXPORT), kind)
  }
})

test(`${DIAGNOSTICS.CLIENT_REQUIRED}: error boundaries from a server module`, async () => {
  for (const kind of ['error', 'global-error']) {
    assert.deepEqual(codes(await plan(kind, 'export default function E() { return null }')), [DIAGNOSTICS.CLIENT_REQUIRED], kind)
  }
})

test(`${DIAGNOSTICS.SERVER_ACTIONS_MODULE}: a 'use server' module as a route file`, async () => {
  assert.deepEqual(codes(await plan('page', "'use server'\nexport async function act() {}")), [DIAGNOSTICS.SERVER_ACTIONS_MODULE])
})

test(`${DIAGNOSTICS.ROUTE_DEFAULT_EXPORT}: a Route Handler with a default export`, async () => {
  const result = await plan('route', 'export async function GET() { return new Response() }\nexport default function handler() {}')
  assert.deepEqual(codes(result), [DIAGNOSTICS.ROUTE_DEFAULT_EXPORT])
  assert.equal(result.diagnostics[0].exportName, 'default')
})

test(`${DIAGNOSTICS.ROUTE_NO_METHODS}: a Route Handler without any HTTP method`, async () => {
  assert.deepEqual(codes(await plan('route', 'export const revalidate = 60')), [DIAGNOSTICS.ROUTE_NO_METHODS])
})

test(`${DIAGNOSTICS.MISSING_DEFAULT}: component and metadata files without a default`, async () => {
  for (const kind of ROUTE_KINDS.filter(kind => ROUTE_EXPORT_TABLE.kinds[kind].requiresDefault)) {
    const prefix = ROUTE_EXPORT_TABLE.kinds[kind].sourceMustBeClient ? "'use client'\n" : ''
    assert.deepEqual(codes(await plan(kind, `${prefix}export type Nothing = never`)), [DIAGNOSTICS.MISSING_DEFAULT], kind)
  }
})

test(`${DIAGNOSTICS.UNSUPPORTED_EXPORT}: exports Next.js does not support for the kind`, async () => {
  const cases = [
    ['page', 'export function helper() {}'],
    ['page', 'export const GET = () => null'],
    ['layout', 'export const unstable_dynamicStaleTime = 30'],
    ['layout', 'export const config = {}'],
    ['not-found', "export const metadata = { title: 'x' }"],
    ['loading', 'export const revalidate = 60'],
    ['template', 'export async function generateStaticParams() { return [] }'],
    ['route', 'export const metadata = {}'],
    ['route', "export const instant = false"],
    ['sitemap', 'export const dynamicParams = false'],
    ['sitemap', 'export async function generateStaticParams() { return [] }'],
    ['icon', "export const alt = 'x'"],
    ['robots', 'export async function generateSitemaps() { return [] }'],
    ['global-not-found', 'export const viewport = {}'],
  ]
  for (const [kind, extra] of cases) {
    const result = await plan(kind, sourceFor(kind, extra))
    assert.deepEqual(codes(result), [DIAGNOSTICS.UNSUPPORTED_EXPORT], `${kind}: ${extra}`)
    assert.ok(result.diagnostics[0].exportName && result.diagnostics[0].file === FILE)
  }
})

test(`${DIAGNOSTICS.UNCLASSIFIABLE_EXPORT}: exports whose names or values cannot be read statically`, async () => {
  for (const extra of ["export * from './everything'", 'const o = { a: 1 }\nexport const { a } = o', 'export enum Mode { A }', 'export namespace N { export const a = 1 }']) {
    assert.deepEqual(codes(await plan('page', sourceFor('page', extra))), [DIAGNOSTICS.UNCLASSIFIABLE_EXPORT], extra)
  }
  const exportEquals = await plan('page', 'export = {}')
  assert.ok(codes(exportEquals).includes(DIAGNOSTICS.UNCLASSIFIABLE_EXPORT))
})

test('type-only exports are skipped, not reported', async () => {
  const result = await plan('page', sourceFor('page', "export type A = string\nexport interface B {}\nexport type { C } from './c'\nexport { type D } from './d'\nexport declare const E: number"))
  assert.deepEqual(codes(result), [])
  assert.deepEqual(result.facade.typeOnly, ['A', 'B', 'C', 'D', 'E'])
})

test('emitFacade throws every diagnostic at once, with file and export', async () => {
  await assert.rejects(
    emitFacade({ kind: 'page', target: 'x/page.tsx', specifier: '@/x', file: FILE, projectRoot: CORE_ROOT, source: "export const revalidate = -1\nexport function helper() {}\nexport * from './y'" }),
    error => {
      assert.ok(error instanceof FacadeEmitError)
      assert.deepEqual(error.diagnostics.map(d => d.code).sort(), [
        DIAGNOSTICS.MISSING_DEFAULT,
        DIAGNOSTICS.NON_LITERAL_SEGMENT_CONFIG,
        DIAGNOSTICS.UNCLASSIFIABLE_EXPORT,
        DIAGNOSTICS.UNSUPPORTED_EXPORT,
      ].sort())
      assert.match(error.message, /source\.tsx:1 \(export "revalidate"\)/)
      assert.match(error.message, /\(export "helper"\)/)
      return true
    }
  )
})

// --- fix round 1: numbered metadata variants ---------------------------------

const NUMBERED = ROUTE_KINDS.filter(kind => ROUTE_EXPORT_TABLE.kinds[kind].numberedVariants)

test('numbered variants are exactly the four metadata image kinds Next accepts with \\d?', async () => {
  assert.deepEqual(NUMBERED.sort(), ['apple-icon', 'icon', 'opengraph-image', 'twitter-image'])
  const { isMetadataRouteFile } = requireFromCore('next/dist/lib/metadata/is-metadata-route')
  for (const kind of ROUTE_KINDS) {
    const { file, numberedVariants } = ROUTE_EXPORT_TABLE.kinds[kind]
    if (!['icon', 'apple-icon', 'opengraph-image', 'twitter-image', 'sitemap', 'robots', 'manifest'].includes(kind)) continue
    assert.equal(isMetadataRouteFile(`/${file}1.tsx`, ['tsx'], true), Boolean(numberedVariants), `${file}1.tsx`)
  }
})

for (const kind of NUMBERED) {
  test(`numbered ${kind}: ${ROUTE_EXPORT_TABLE.kinds[kind].file}0-9 map to the base kind`, async () => {
    const { file } = ROUTE_EXPORT_TABLE.kinds[kind]
    for (const suffix of ['0', '1', '9']) {
      assert.equal(kindForFileStem(`${file}${suffix}`), kind)
      const result = await plan(kind, sourceFor(kind, exportLineFor('size')), { target: `example/${file}${suffix}.tsx` })
      assert.deepEqual(result.diagnostics, [], `${file}${suffix}`)
    }
    for (const bad of [`${file}12`, `${file}a`, `${file}-1`]) {
      assert.equal(kindForFileStem(bad), null, bad)
      assert.deepEqual(codes(await plan(kind, sourceFor(kind), { target: `example/${bad}.tsx` })), [DIAGNOSTICS.TARGET_MISMATCH], bad)
    }
  })
}

test('kinds without numbered variants reject a digit suffix', async () => {
  for (const kind of ['page', 'layout', 'sitemap', 'robots', 'route']) {
    const { file } = ROUTE_EXPORT_TABLE.kinds[kind]
    assert.equal(kindForFileStem(`${file}1`), null, kind)
    assert.deepEqual(codes(await plan(kind, sourceFor(kind), { target: `example/${file}1.ts` })), [DIAGNOSTICS.TARGET_MISMATCH], kind)
  }
})

// --- fix round 1: the table's Next.js version is enforced ------------------

async function fakeNextProject(version, internal) {
  const dir = await mkdtemp(join(tmpdir(), 'nextspark-fake-next-'))
  await writeFile(join(dir, 'package.json'), JSON.stringify({ name: 'fake-project', dependencies: { next: version } }))
  await mkdir(join(dir, 'node_modules/next'), { recursive: true })
  await writeFile(join(dir, 'node_modules/next/package.json'), JSON.stringify({ name: 'next', version }))
  if (internal) {
    const path = join(dir, 'node_modules/next/dist/build/segment-config/app')
    await mkdir(path, { recursive: true })
    await writeFile(join(path, 'app-segment-config.js'), internal)
  }
  return dir
}

const PAGE_WITH_CONFIG = 'export const revalidate = 60\nexport default function P() { return null }\n'

test(`${DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION}: a project resolving another Next.js version is refused`, async () => {
  const dir = await fakeNextProject('99.0.0')
  try {
    const loaded = loadNextSegmentConfig(dir)
    assert.equal(loaded.version, '99.0.0')
    assert.equal(loaded.parseAppSegmentConfig, undefined, 'nothing is loaded from a mismatched Next.js')
    await assert.rejects(
      emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: PAGE_WITH_CONFIG, projectRoot: dir }),
      error => {
        assert.deepEqual(error.diagnostics.map(d => d.code), [DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION])
        assert.match(error.message, /next@99\.0\.0/)
        assert.match(error.message, new RegExp(`next@~${ROUTE_EXPORT_TABLE.next.replace(/\./g, '\\.')}`))
        return true
      }
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('the segment config schema is loaded from the same Next.js package root as the version', async () => {
  const marker = "exports.AppSegmentConfigSchemaKeys = []\nexports.parseAppSegmentConfig = () => { throw new Error('schema from the fake next root') }\n"
  const dir = await fakeNextProject(ROUTE_EXPORT_TABLE.next, marker)
  try {
    const loaded = loadNextSegmentConfig(dir)
    assert.equal(loaded.root, await realpath(join(dir, 'node_modules/next')))
    await assert.rejects(
      emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: PAGE_WITH_CONFIG, projectRoot: dir }),
      error => error.diagnostics[0].code === DIAGNOSTICS.INVALID_SEGMENT_CONFIG_VALUE && /schema from the fake next root/.test(error.message)
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test(`${DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION}: the right version without its schema internal is refused, not substituted`, async () => {
  const dir = await fakeNextProject(ROUTE_EXPORT_TABLE.next)
  try {
    await assert.rejects(
      emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: PAGE_WITH_CONFIG, projectRoot: dir }),
      error => error.diagnostics[0].code === DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION && /has no segment config schema/.test(error.message)
    )
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

// --- fix round 1: aliased magic exports keep Next's static reading ----------

test('generateStaticParams/generateSitemaps/generateImageMetadata are detected in the facade exactly as in the source', async () => {
  const { loadBindings } = requireFromCore('next/dist/build/swc')
  const { getPageStaticInfo } = requireFromCore('next/dist/build/analysis/get-page-static-info')
  await loadBindings()
  const dir = await mkdtemp(join(tmpdir(), 'nextspark-alias-'))
  let counter = 0
  const staticInfo = async content => {
    const pageFilePath = join(dir, `module-${counter++}.tsx`)
    await writeFile(pageFilePath, content)
    const info = await getPageStaticInfo({ pageFilePath, nextConfig: {}, isDev: false, page: '/x/[slug]/page', pageType: 'app' })
    return { generateStaticParams: info.generateStaticParams, generateSitemaps: info.generateSitemaps, generateImageMetadata: info.generateImageMetadata }
  }
  const cases = [
    ['page', 'async function makeParams() { return [] }\nexport { makeParams as generateStaticParams }'],
    ['page', "export { makeParams as generateStaticParams } from './params'"],
    ['page', "export { default as generateStaticParams } from './params'"],
    ['page', 'export async function generateStaticParams() { return [] }'],
    ['page', "export { generateStaticParams } from './params'"],
    ['route', 'export async function GET() { return new Response() }\nasync function p() { return [] }\nexport { p as generateStaticParams }'],
    ['sitemap', 'async function ids() { return [] }\nexport { ids as generateSitemaps }'],
    ['sitemap', 'export async function generateSitemaps() { return [] }'],
    ['opengraph-image', 'async function images() { return [] }\nexport { images as generateImageMetadata }'],
    ['opengraph-image', 'export async function generateImageMetadata() { return [] }'],
  ]
  try {
    for (const [kind, extra] of cases) {
      const source = sourceFor(kind, extra)
      const { content } = await emitFacade({ kind, target: targetFor(kind), specifier: SPECIFIER, file: FILE, source, projectRoot: CORE_ROOT })
      assert.deepEqual(await staticInfo(content), await staticInfo(source), `${kind}: ${extra}\n--- facade:\n${content}`)
    }
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('an aliased magic export is forwarded under its source local name', async () => {
  const { content, facade } = await emitFacade({
    kind: 'page',
    target: 'x/[slug]/page.tsx',
    specifier: '@/x',
    file: FILE,
    source: 'async function listSlugs() { return [] }\nexport { listSlugs as generateStaticParams }\nexport default function P() { return null }',
    projectRoot: CORE_ROOT,
  })
  assert.deepEqual(facade.aliases, { generateStaticParams: 'listSlugs' })
  assert.match(content, /^import \{ generateStaticParams as listSlugs \} from "@\/x"$/m)
  assert.match(content, /^export \{ listSlugs as generateStaticParams \}$/m)
})

// --- fix round 3: ~16.3.5 version range --------------------------------------

test('isSupportedNextVersion accepts ~baseline: same minor, stable patch >= baseline', () => {
  assert.equal(ROUTE_EXPORT_TABLE.next, '16.3.5')
  for (const version of ['16.3.5', '16.3.6', '16.3.9', '16.3.10', '16.3.123', '16.3.5+build.1', '16.3.7+sha.abc-1']) assert.equal(isSupportedNextVersion(version), true, version)
  for (const version of [
    '16.3.4', '16.3.0', '16.4.0', '16.2.9', '17.0.0', '15.3.5', '16.3.6-canary.0', '16.3.5-rc.1', '16.3.6-canary.0+build.1',
    '16.3.4+build.1', '16.3.5+', '16.3.5+bad..meta', '16.3', 'latest', '', undefined,
  ]) {
    assert.equal(isSupportedNextVersion(version), false, String(version))
  }
})

test('a later 16.3 patch is accepted and its own schema internal is used', async () => {
  const marker = "exports.AppSegmentConfigSchemaKeys = []\nexports.parseAppSegmentConfig = () => { throw new Error('schema from next 16.3.9') }\n"
  const dir = await fakeNextProject('16.3.9', marker)
  try {
    assert.equal(loadNextSegmentConfig(dir).version, '16.3.9')
    assert.equal(loadNextSegmentConfig(dir).error, undefined)
    await assert.rejects(
      emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: PAGE_WITH_CONFIG, projectRoot: dir }),
      error => error.diagnostics[0].code === DIAGNOSTICS.INVALID_SEGMENT_CONFIG_VALUE && /schema from next 16\.3\.9/.test(error.message)
    )
    const { content } = await emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: 'export default function P() { return null }', projectRoot: dir })
    assert.match(content, /export \{ default \} from "@\/a"/)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

for (const version of ['16.3.4', '16.4.0', '17.0.0', '16.3.6-canary.0']) {
  test(`${DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION}: next@${version} is refused`, async () => {
    const dir = await fakeNextProject(version, "exports.AppSegmentConfigSchemaKeys = []\nexports.parseAppSegmentConfig = () => ({})\n")
    try {
      await assert.rejects(
        emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: PAGE_WITH_CONFIG, projectRoot: dir }),
        error => {
          assert.deepEqual(error.diagnostics.map(d => d.code), [DIAGNOSTICS.UNSUPPORTED_NEXT_VERSION])
          assert.match(error.message, new RegExp(`next@${version.replace(/\./g, '\\.')}`))
          assert.match(error.message, /next@~16\.3\.5/)
          return true
        }
      )
    } finally {
      await rm(dir, { recursive: true, force: true })
    }
  })
}

// --- fix round 4: build metadata ----------------------------------------------

test('a Next.js version with build metadata (16.3.5+build.1) is accepted end to end', async () => {
  const marker = "exports.AppSegmentConfigSchemaKeys = []\nexports.parseAppSegmentConfig = () => ({})\n"
  const dir = await fakeNextProject('16.3.5+build.1', marker)
  try {
    assert.equal(loadNextSegmentConfig(dir).error, undefined)
    const { content } = await emitFacade({ kind: 'page', target: 'a/page.tsx', specifier: '@/a', file: FILE, source: PAGE_WITH_CONFIG, projectRoot: dir })
    assert.match(content, /^export const revalidate = 60$/m)
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
