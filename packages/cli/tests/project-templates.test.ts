/**
 * What every project template (starter, blog, crm, productivity) must carry to build in a new project (#193).
 *
 * - Every bare package its source imports is a dependency the generator writes into the project's package.json
 *   (the scaffold's own list plus the template's package.json, which copyStarterTheme does not copy).
 * - Every sel('blocks.…') path a block calls exists in that template's lib/block-selectors.ts, so sel() never
 *   has to answer for a missing path.
 * - A page/layout/template file exports only what Next accepts there (the CRM layout once exported a hook).
 * - A content feature does not merge its entity over an entity the template already ships.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { builtinModules } from 'node:module'

import { getTemplatesDir } from '../src/wizard/generators/templates-dir.js'
import { copyContentFeatures } from '../src/wizard/generators/content-features-generator.js'
import { readTemplateDependencies } from '../src/wizard/generators/theme-renamer.js'
import { updatePackageJson } from '../src/wizard/generators/index.js'
import type { WizardConfig } from '../src/wizard/types.js'

const TEMPLATES = getTemplatesDir()
const NAMES = ['starter', 'blog', 'crm', 'productivity']
const CODE = /\.(?:[cm]?[jt]sx?)$/
const SPECIFIER = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+|\brequire\s*\(\s*)(['"])([^'"\n]+)\1/g
const BUILTINS = new Set(builtinModules)

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(full)
    else yield full
  }
}

/** The files a project created from `name` ends up with: the template, plus the blocks of both content features. */
function sources(name: string): string[] {
  const roots = [path.join(TEMPLATES, 'projects', name), path.join(TEMPLATES, 'features')]
  return roots.flatMap(root => [...walk(root)].filter(file => CODE.test(file) && !/[\\/]tests[\\/]/.test(file)))
}

function bareImports(source: string): string[] {
  const code = source.split('\n').filter(line => !/^\s*(?:\*|\/\/|\/\*)/.test(line)).join('\n')
  const found = new Set<string>()
  for (const [, , specifier] of code.matchAll(SPECIFIER)) {
    if (/^(?:\.|\/|@\/|node:)/.test(specifier) || BUILTINS.has(specifier.split('/')[0])) continue
    const parts = specifier.split('/')
    const name = specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0]
    if (/^(?:@[a-z0-9~._-]+\/)?[a-z0-9~._-]+$/i.test(name)) found.add(name)
  }
  return [...found]
}

async function generatedDependencies(name: string): Promise<Set<string>> {
  const previous = process.cwd()
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-template-deps-'))
  process.chdir(dir)
  try {
    await updatePackageJson({ projectSlug: 'acme', projectType: 'web' } as WizardConfig, await readTemplateDependencies(TEMPLATES, name))
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'))
    return new Set([...Object.keys(pkg.dependencies), ...Object.keys(pkg.devDependencies)])
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

for (const name of NAMES) {
  test(`${name}: every package its source imports is a dependency of the generated project`, async () => {
    const declared = await generatedDependencies(name)
    const missing = new Map<string, string>()
    for (const file of sources(name)) {
      for (const pkg of bareImports(fs.readFileSync(file, 'utf8'))) {
        if (!declared.has(pkg) && pkg !== '@nextsparkjs/registries') missing.set(pkg, path.relative(TEMPLATES, file))
      }
    }
    assert.deepEqual([...missing], [], 'imported but not written to the project package.json (package -> first file)')
  })

  test(`${name}: every sel('blocks.…') a block calls is defined by lib/block-selectors.ts`, () => {
    const selectors = fs.readFileSync(path.join(TEMPLATES, 'projects', name, 'lib/block-selectors.ts'), 'utf8')
    const literal = selectors.match(/export const BLOCK_SELECTORS = (\{[\s\S]*?\n\}) as const/)
    assert.ok(literal, 'BLOCK_SELECTORS is an object literal')
    const blocks = new Function(`return ${literal[1]}`)() as Record<string, unknown>
    const missing: string[] = []
    for (const file of sources(name)) {
      for (const [, path_] of fs.readFileSync(file, 'utf8').matchAll(/\bsel\(\s*'blocks\.([^']+)'/g)) {
        const value = path_.split('.').reduce<unknown>((node, key) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined), blocks)
        if (typeof value !== 'string') missing.push(`blocks.${path_} (${path.relative(TEMPLATES, file)})`)
      }
    }
    assert.deepEqual(missing, [])
  })

  test(`${name}: page, layout and template files export only what Next accepts`, () => {
    const allowed = /^export (?:default\b|(?:const|let) (?:metadata|viewport|dynamic|dynamicParams|revalidate|fetchCache|runtime|preferredRegion|maxDuration|experimental_ppr|unstable_instant)\b|(?:async )?function (?:generateMetadata|generateViewport|generateStaticParams)\b|(?:const|async function|function) (?:GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b|(?:\{|type |interface ))/
    const offenders: string[] = []
    for (const file of walk(path.join(TEMPLATES, 'projects', name))) {
      if (!/[\\/](?:page|layout|template|default|loading|error|not-found|route)\.[tj]sx?$/.test(file)) continue
      for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
        if (line.startsWith('export ') && !allowed.test(line)) offenders.push(`${path.relative(TEMPLATES, file)}: ${line.trim()}`)
      }
    }
    assert.deepEqual(offenders, [])
  })
}

test('a content feature leaves an entity the project template already ships as it is', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-feature-merge-'))
  const previous = process.cwd()
  try {
    fs.cpSync(path.join(TEMPLATES, 'projects/blog'), dir, { recursive: true })
    const before = fs.readdirSync(path.join(dir, 'entities/posts/migrations')).sort()
    process.chdir(dir)
    await copyContentFeatures({ contentFeatures: { pages: true, blog: true } } as WizardConfig, TEMPLATES)
    assert.deepEqual(fs.readdirSync(path.join(dir, 'entities/posts/migrations')).sort(), before)
    assert.ok(fs.existsSync(path.join(dir, 'blocks/post-content')), 'the blog feature still adds its block')
    assert.ok(fs.existsSync(path.join(dir, 'entities/pages')), 'the pages feature still adds an entity the template lacks')
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

test('the template package.json dependencies reach the generated package.json', async () => {
  const declared = await generatedDependencies('blog')
  for (const pkg of ['dompurify', 'next-themes', '@tailwindcss/container-queries', '@types/dompurify']) assert.ok(declared.has(pkg), pkg)
  assert.ok((await generatedDependencies('productivity')).has('@dnd-kit/core'))
})

test('the feature entity configs do not hard-code message loaders for locales a project may not have', () => {
  for (const file of ['pages/entities/pages/pages.config.ts', 'blog/entities/posts/posts.config.ts']) {
    assert.doesNotMatch(fs.readFileSync(path.join(TEMPLATES, 'features', file), 'utf8'), /messages\/[a-z]{2}\.json/, file)
  }
})

test('block components take `sel` from lib/block-selectors, not from lib/selectors (which carries every core domain)', () => {
  const blocks = [path.join(TEMPLATES, 'features'), ...NAMES.map(name => path.join(TEMPLATES, 'projects', name)), path.resolve(fs.realpathSync(TEMPLATES), '../../../apps/dev')]
    .flatMap(root => (fs.existsSync(root) ? [...walk(root)] : []))
    .filter(file => /[\\/]blocks[\\/][^\\/]+[\\/]component\.tsx$/.test(file) && !/node_modules/.test(file))
  assert.ok(blocks.length > 10)
  const offenders = blocks.filter(file => /from\s+'(?:\.\.\/)+lib\/selectors'/.test(fs.readFileSync(file, 'utf8')))
  assert.deepEqual(offenders.map(file => path.relative(TEMPLATES, file)), [])
})
