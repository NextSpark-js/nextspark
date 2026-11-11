/**
 * #425: a `features` flag set to false leaves core routes out of the host (scripts/build/registry/host/features.mjs).
 * The UI must then link to none of the pages it left out. Checked against the route manifest:
 *
 * - the page URLs of src/lib/config/feature-pages.ts are exactly those of the omitted page routes;
 * - every link core's source (and the code of its project templates) writes (a JSX `href`, a `push`/`replace` call, an `href`/`url` property) to an omitted page
 *   sits in a file that checks the flag (`FEATURES.<flag>` or `isServedPath`), or in a file only the omitted routes
 *   reach (followed through the imports; an index file that only re-exports does not count as a user, but a file that
 *   only such an index reaches does not count as unreachable either), or in a default config whose links config-client
 *   and config-sync filter
 *   (servedAppConfig, servedDashboardConfig: tests/jest/lib/config/build-features.test.ts checks them).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'
import { FEATURE_PAGES, isServedPathWith, type FeatureFlags } from '../../src/lib/config/feature-pages'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const SRC = path.join(CORE, 'src')
const { omittingFeature } = await import(path.join(CORE, 'scripts/build/registry/host/features.mjs'))
const manifest: { kind: string; target: string; specifier: string }[] = JSON.parse(fs.readFileSync(path.join(SRC, 'routes/manifest.json'), 'utf8'))
const variants: Record<string, { kind: string; target: string; specifier: string }[]> = JSON.parse(fs.readFileSync(path.join(SRC, 'routes/variants.json'), 'utf8'))
const FLAGS = Object.keys(FEATURE_PAGES) as (keyof FeatureFlags)[]
const off = (flag: keyof FeatureFlags) => ({ ...Object.fromEntries(FLAGS.map(other => [other, true])), [flag]: false }) as FeatureFlags

/** The URL of a page route target: route groups and parallel slots are not part of it. */
const pageUrl = (target: string) => `/${path.posix.dirname(target).split('/').filter(part => part !== '.' && !/^\(.*\)$/.test(part) && !part.startsWith('@')).join('/')}`

/** The default configs whose links servedAppConfig / servedDashboardConfig drop (a jest test renders them with a flag off). */
const FILTERED_CONFIGS = new Set(['lib/config/app.config.ts', 'lib/config/dashboard.config.ts'])

function walk(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) return walk(file)
    return /\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [file] : []
  })
}

function resolveModule(from: string, specifier: string): string | null {
  const base = specifier.startsWith('@nextsparkjs/core/') ? path.join(SRC, specifier.slice('@nextsparkjs/core/'.length))
    : specifier.startsWith('.') ? path.resolve(path.dirname(from), specifier)
    : null
  if (!base) return null
  for (const candidate of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts'), path.join(base, 'index.tsx')]) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) return candidate
  }
  return null
}

/**
 * The project templates' own code is project code: a link it writes to an omitted page needs the check too. Their
 * tests are left out, and so are their config files, whose menus servedAppConfig / servedDashboardConfig filter.
 */
const TEMPLATES = path.join(CORE, 'templates/projects')
const templateFiles = walk(TEMPLATES).filter(file => !/[/\\](tests|config|node_modules)[/\\]/.test(path.relative(TEMPLATES, file)))
const files = [...walk(SRC), ...templateFiles]
const sources = new Map(files.map(file => [file, ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)]))

/** An index file that only re-exports: it renders nothing, so it is not a user of what it re-exports. */
const barrels = new Set([...sources].filter(([, source]) => source.statements.every(statement => ts.isExportDeclaration(statement) && statement.moduleSpecifier)).map(([file]) => file))

/** Who imports each file (static imports and re-exports), index files that only re-export left out. */
const importers = new Map<string, Set<string>>()
for (const [file, source] of sources) {
  if (barrels.has(file)) continue
  for (const statement of source.statements) {
    const specifier = (ts.isImportDeclaration(statement) || ts.isExportDeclaration(statement)) && statement.moduleSpecifier && ts.isStringLiteral(statement.moduleSpecifier)
      ? statement.moduleSpecifier.text : null
    const target = specifier && resolveModule(file, specifier)
    if (!target) continue
    if (!importers.has(target)) importers.set(target, new Set())
    importers.get(target)!.add(file)
  }
}

/** The links a file writes: `[text, line]`, the text up to the first interpolation of a template. */
function linksOf(source: ts.SourceFile): [string, number][] {
  const links: [string, number][] = []
  const text = (node: ts.Node | undefined) =>
    !node ? null : ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node) ? node.text : ts.isTemplateExpression(node) ? node.head.text : null
  const add = (node: ts.Node | undefined) => {
    const value = text(node)
    if (value?.startsWith('/')) links.push([value, source.getLineAndCharacterOfPosition(node!.getStart(source)).line + 1])
  }
  const visit = (node: ts.Node): void => {
    if (ts.isJsxAttribute(node) && node.name.getText(source) === 'href' && node.initializer) {
      add(ts.isJsxExpression(node.initializer) ? node.initializer.expression : node.initializer)
    } else if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression) && ['push', 'replace'].includes(node.expression.name.text)) {
      add(node.arguments[0])
    } else if (ts.isPropertyAssignment(node) && ['href', 'url'].includes(node.name.getText(source))) {
      add(node.initializer)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return links
}

for (const flag of FLAGS) {
  const omittedRoutes = [...manifest, ...Object.values(variants).flat()].filter(route => omittingFeature(route.target, { [flag]: false }) === flag)

  test(`the page URLs of features.${flag} are those of the page routes it leaves out (#425)`, () => {
    const omittedPages = new Set(omittedRoutes.filter(route => route.kind === 'page').map(route => pageUrl(route.target)))
    assert.ok(omittedPages.size > 0)
    for (const url of omittedPages) assert.equal(isServedPathWith(off(flag), url.replace(/\[[^\]]+\]/g, 'x')), false, `${url} is left out`)
    for (const route of manifest.filter(route => route.kind === 'page' && !omittedRoutes.includes(route))) {
      assert.equal(isServedPathWith(off(flag), pageUrl(route.target).replace(/\[[^\]]+\]/g, 'x')), true, `${route.target} is still served`)
    }
  })

  test(`no link of core's UI leads to a page features.${flag}: false leaves out without checking the flag (#425)`, () => {
    // The omitted route modules, and every file only they reach
    const unreachable = new Set(omittedRoutes.map(route => resolveModule(SRC, route.specifier)).filter((file): file is string => file !== null))
    for (let grew = true; grew;) {
      grew = false
      for (const file of files) {
        const by = importers.get(file)
        if (unreachable.has(file) || !by?.size || ![...by].every(importer => unreachable.has(importer))) continue
        unreachable.add(file)
        grew = true
      }
    }
    const unguarded: string[] = []
    let checked = 0
    for (const [file, source] of sources) {
      const relative = path.relative(SRC, file).split(path.sep).join('/')
      if (unreachable.has(file) || FILTERED_CONFIGS.has(relative)) continue
      const guarded = source.text.includes(`FEATURES.${flag}`) || source.text.includes('isServedPath(')
      for (const [link, line] of linksOf(source)) {
        if (isServedPathWith(off(flag), link)) continue
        checked++
        if (!guarded) unguarded.push(`${relative}:${line} ${link}`)
      }
    }
    assert.ok(checked > 0, 'the scan finds the guarded links')
    assert.deepEqual(unguarded, [])
  })
}
