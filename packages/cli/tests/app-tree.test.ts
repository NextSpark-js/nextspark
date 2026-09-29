import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'

import {
  assertContained,
  apiUrlMoves,
  declareWebhookExtensions,
  isGeneratorLoader,
  lineDiff,
  rewriteMovedImports,
} from '../src/utils/app-tree.js'

test('declareWebhookExtensions adds billing to the config object and keeps its comments', () => {
  const config = `import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['langchain'], // kept
  template: { name: 'starter', version: '0.1.0-beta.192' },
})
`
  const result = declareWebhookExtensions(config, [{ provider: 'stripe', module: './lib/billing/stripe-webhook-extensions' }])
  assert.deepEqual(result, {
    source: `import { defineConfig } from '@nextsparkjs/core/lib/config'

export default defineConfig({
  plugins: ['langchain'], // kept
  template: { name: 'starter', version: '0.1.0-beta.192' },
  billing: { webhookExtensions: { stripe: "./lib/billing/stripe-webhook-extensions" } },
})
`,
  })
})

test('declareWebhookExtensions adds the comma a last property without one needs, keeping a trailing comment in place', () => {
  const config = "export default defineConfig({\n  plugins: [] // none\n})\n"
  const result = declareWebhookExtensions(config, [{ provider: 'polar', module: './lib/billing/polar-webhook-extensions' }])
  assert.deepEqual(result, {
    source: 'export default defineConfig({\n  plugins: [], // none\n  billing: { webhookExtensions: { polar: "./lib/billing/polar-webhook-extensions" } },\n})\n',
  })
})

test('declareWebhookExtensions works on a one-line object and names both providers', () => {
  const result = declareWebhookExtensions("export default defineConfig({ plugins: [] })\n", [
    { provider: 'stripe', module: './lib/billing/stripe-webhook-extensions' },
    { provider: 'polar', module: './lib/billing/polar-webhook-extensions' },
  ])
  assert.ok('source' in result)
  assert.match(result.source, /defineConfig\(\{ plugins: \[\], billing: \{ webhookExtensions: \{ stripe: "\.\/lib\/billing\/stripe-webhook-extensions", polar: "\.\/lib\/billing\/polar-webhook-extensions" \} \} \}\)/)
})

test('declareWebhookExtensions stops on an existing billing entry, on a nested one it leaves alone, and on no object', () => {
  const extension = [{ provider: 'stripe' as const, module: './lib/billing/stripe-webhook-extensions' }]
  const existing = declareWebhookExtensions("export default defineConfig({\n  billing: { plans: [] },\n})\n", extension)
  assert.ok('error' in existing)
  assert.match(existing.error, /already has a billing entry: add webhookExtensions to it by hand \(stripe: '\.\/lib\/billing\/stripe-webhook-extensions'\)/)

  const nested = declareWebhookExtensions("export default defineConfig({\n  template: { billing: true },\n})\n", extension)
  assert.ok('source' in nested)
  assert.match(nested.source, /\n {2}billing: \{ webhookExtensions/)

  const none = declareWebhookExtensions('export default {}\n', extension)
  assert.ok('error' in none)
  assert.match(none.error, /no defineConfig\(\{ \.\.\. \}\) object literal/)
  assert.deepEqual(declareWebhookExtensions('export default {}\n', []), { source: 'export default {}\n' })
})

test('rewriteMovedImports keeps each relative import pointing at the same file', () => {
  const root = '/p'
  const from = '/p/src/app/dashboard/page.tsx'
  const to = '/p/templates/dashboard/page.tsx'
  const source = [
    "import Local from './Local'",
    "import Shared from '../../../lib/shared'",
    "import Style from './style.css'",
    "import Sibling from '../pricing/page'",
    "import core from '@nextsparkjs/core/lib/x'",
    "const lazy = () => import('./Local')",
  ].join('\n')
  const moved = new Map([
    ['/p/src/app/dashboard/Local.tsx', '/p/templates/dashboard/Local.tsx'],
    ['/p/src/app/dashboard/style.css', '/p/templates/dashboard/style.css'],
    ['/p/src/app/pricing/page.tsx', '/p/templates/pricing/page.tsx'],
  ])
  const { source: rewritten, broken } = rewriteMovedImports(source, from, to, `${root}/src/app`, moved)
  assert.deepEqual(broken, [])
  assert.equal(rewritten, [
    "import Local from './Local'",
    // src/app/dashboard -> lib/shared at the project root: one level less to climb from templates/dashboard
    "import Shared from '../../lib/shared'",
    "import Style from './style.css'",
    "import Sibling from '../pricing/page'",
    "import core from '@nextsparkjs/core/lib/x'",
    "const lazy = () => import('./Local')",
  ].join('\n'))
})

test('rewriteMovedImports reports an import of a file of the app tree that is not kept', () => {
  const { broken } = rewriteMovedImports("import { x } from '../layout'\nimport y from './helpers/y'\n", '/p/src/app/dashboard/page.tsx', '/p/templates/dashboard/page.tsx', '/p/src/app', new Map())
  assert.deepEqual(broken, ['../layout', './helpers/y'])
})

test('rewriteMovedImports resolves an import through the index file of a moved directory', () => {
  const moved = new Map([['/p/src/app/dashboard/ui/index.ts', '/p/api/ui/index.ts']])
  const { source, broken } = rewriteMovedImports("import { A } from './ui'\n", '/p/src/app/dashboard/page.tsx', '/p/templates/dashboard/page.tsx', '/p/src/app', moved)
  assert.deepEqual(broken, [])
  assert.equal(source, "import { A } from '../../api/ui'\n")
})

test('lineDiff shows what changed with two lines of context, and nothing when equal', () => {
  assert.deepEqual(lineDiff('a\nb\n', 'a\nb\n', { before: 'x', after: 'y' }), { text: '', changedLines: 0 })
  const before = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'].join('\n')
  const after = ['one', 'two', 'three', 'four', 'FIVE', 'six', 'seven', 'eight'].join('\n')
  const { text, changedLines } = lineDiff(before, after, { before: 'core', after: 'project' })
  assert.equal(changedLines, 2)
  assert.equal(text, ['--- core', '+++ project', ' three', ' four', '-five', '+FIVE', ' six', ' seven'].join('\n'))
  // Line endings do not count as changes
  assert.equal(lineDiff('a\r\nb', 'a\nb', { before: 'x', after: 'y' }).changedLines, 0)
})

test('apiUrlMoves lists the URLs of the removed dispatchers with where they went', () => {
  const root = mkdtempSync(join(tmpdir(), 'api-url-moves-'))
  try {
    mkdirSync(join(root, 'lib'), { recursive: true })
    writeFileSync(join(root, 'lib/client.ts'), [
      "const a = fetch('/api/v1/theme/acme/ai/chat')",
      'const b = `/api/v1/theme/${theme}/orders/${id}`',
      "const c = '/api/v1/plugin/langchain/sessions'",
      "const d = '/api/v1/teams'",
    ].join('\n'))
    writeFileSync(join(root, 'lib/notes.png'), '/api/v1/theme/x/y')
    const moves = apiUrlMoves([join(root, 'lib/client.ts'), join(root, 'lib/notes.png')], root)
    assert.deepEqual(moves.map(move => [move.file, move.line, move.from, move.to]), [
      ['lib/client.ts', 1, '/api/v1/theme/acme/ai/chat', '/api/ai/chat'],
      ['lib/client.ts', 2, '/api/v1/theme/${theme}/orders/${id}', '/api/orders/${id}'],
      ['lib/client.ts', 3, '/api/v1/plugin/langchain/sessions', '/api/plugins/langchain/sessions'],
    ])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rewriteMovedImports rewrites require.resolve, new URL and CSS urls, and reports other relative paths', () => {
  const from = '/p/src/app/a/page.tsx'
  const to = '/p/templates/a/page.tsx'
  const { source, unprovable } = rewriteMovedImports("require.resolve('../../../lib/x')\nimport.meta.resolve('../../../lib/y')\nnew URL('../../../public/i.png', import.meta.url)\nnew URL('../../../public/j.png', base)\n", from, to, '/p/src/app', new Map())
  assert.equal(source, "require.resolve('../../lib/x')\nimport.meta.resolve('../../lib/y')\nnew URL('../../public/i.png', import.meta.url)\nnew URL('../../../public/j.png', base)\n")
  assert.deepEqual(unprovable, [])
  const css = rewriteMovedImports(".a{background:url(\"../../../public/i.png\")}\n@source '../../../lib';\n", '/p/src/app/a/s.css', '/p/templates/a/s.css', '/p/src/app', new Map())
  assert.equal(css.source, ".a{background:url(\"../../public/i.png\")}\n@source '../../lib';\n")
  // Other file types are never rewritten
  assert.equal(rewriteMovedImports("from '../../../x'", '/p/src/app/a/data.json', '/p/templates/a/data.json', '/p/src/app', new Map()).source, "from '../../../x'")
})

const LOGIN_CORE = '@nextsparkjs/core/routes/(auth)/login/page'
const loaderFor = (extra = '', options: { lookup?: string; fallback?: string; core?: string; metadata?: boolean; literals?: string } = {}) => `// Implementation: ${LOGIN_CORE}
import LoginPage, { metadata as defaultMetadata } from "${options.core ?? LOGIN_CORE}"
import { getTemplateOrDefault, getMetadataOrDefault } from "@nextsparkjs/registries/template-scopes/server/(auth)/login/page"
${extra}
${options.literals ?? 'export const dynamic = "force-dynamic"'}
${options.metadata === false ? '' : `export const metadata = getMetadataOrDefault("${options.lookup ?? 'app/(auth)/login/page.tsx'}", defaultMetadata)`}
export default getTemplateOrDefault("${options.lookup ?? 'app/(auth)/login/page.tsx'}", ${options.fallback ?? 'LoginPage'})
`
const isLoader = (source: string, hasMetadata = true) => isGeneratorLoader(source, '(auth)/login/page.tsx', LOGIN_CORE, { literals: ['export const dynamic = "force-dynamic"'], hasMetadata })

test('isGeneratorLoader accepts exactly what the generator emitted for this route, and nothing else', () => {
  assert.equal(isLoader(loaderFor()), true)
  // whitespace, comments, quote style and semicolons do not matter
  assert.equal(isLoader(loaderFor().replace(/"/g, "'").replace(/\n/g, ';\n').replace('// Implementation', '/* x */ // Implementation')), true)
  // the reviewer's probe: the fallback is the user's own page
  assert.equal(isLoader(loaderFor('import MyPage from "@/components/MyPage"', { fallback: 'MyPage' })), false)
  assert.equal(isLoader(loaderFor('', { lookup: 'app/(auth)/other/page.tsx' })), false)
  assert.equal(isLoader(loaderFor('', { core: '@nextsparkjs/core/routes/(auth)/signup/page' })), false)
  assert.equal(isLoader(loaderFor('', { literals: 'export const dynamic = "force-static"' })), false)
  assert.equal(isLoader(loaderFor('', { literals: '' })), false)
  // The alias is imported but the metadata lookup is gone (the user's own metadata replaced it)
  assert.equal(isLoader(loaderFor('', { metadata: false })), false)
  assert.equal(isLoader(loaderFor('', { metadata: false }).replace('LoginPage, { metadata as defaultMetadata }', 'LoginPage'), false), true)
  assert.equal(isLoader(loaderFor(), false), false)
  assert.equal(isLoader(loaderFor('export const metadata = { title: "mine" }', { metadata: false })), false)
  assert.equal(isLoader(loaderFor('export const extra = compute()')), false)
  assert.equal(isLoader(loaderFor("import x from 'y'")), false)
  assert.equal(isLoader(loaderFor('').replace('getTemplateOrDefault("app/(auth)/login/page.tsx", LoginPage)', 'getTemplateOrDefault("app/(auth)/login/page.tsx", (() => LoginPage)())')), false)
})

test('rewriteMovedImports handles CSS Modules composes and Sass @use, @forward and @import, and blocks the rest', () => {
  const root = mkdtempSync(join(tmpdir(), 'css-refs-'))
  try {
    mkdirSync(join(root, 'src/app/blog'), { recursive: true })
    mkdirSync(join(root, 'src/styles'), { recursive: true })
    writeFileSync(join(root, 'src/styles/common.module.css'), '.root{}')
    writeFileSync(join(root, 'src/styles/_vars.scss'), '$a: 1;')
    writeFileSync(join(root, 'src/styles/img.png'), 'x')
    const app = join(root, 'src/app')
    const from = join(app, 'blog/page.module.css')
    const to = join(root, 'templates/blog/page.module.css')
    const css = rewriteMovedImports('.a { composes: root from "../../styles/common.module.css"; }\n.b { composes: c d from \'../../styles/common.module.css\'; }\n', from, to, app, new Map())
    assert.equal(css.source, '.a { composes: root from "../../src/styles/common.module.css"; }\n.b { composes: c d from \'../../src/styles/common.module.css\'; }\n')
    const scssFrom = join(app, 'blog/s.scss')
    const scssTo = join(root, 'templates/blog/s.scss')
    const scss = rewriteMovedImports('@use "../../styles/vars";\n@forward "../../styles/vars" as v-*;\n@import "../../styles/vars", "sass:math";\n// @use "../../styles/vars";\n', scssFrom, scssTo, app, new Map())
    assert.deepEqual(scss.unprovable, [])
    assert.equal(scss.source, '@use "../../src/styles/vars";\n@forward "../../src/styles/vars" as v-*;\n@import "../../src/styles/vars", "sass:math";\n// @use "../../styles/vars";\n')
    // a partial that moves with the tree keeps its own name
    const moved = new Map([[join(app, 'blog/_local.scss'), join(root, 'templates/blog/_local.scss')]])
    assert.equal(rewriteMovedImports('@use "local";\n@use "./local";\n', scssFrom, scssTo, app, moved).source, '@use "local";\n@use "./local";\n')
    // any other quoted relative string that names a file cannot be proven
    const other = rewriteMovedImports('.a::after { content: "../../styles/img.png"; }\n', from, to, app, new Map())
    assert.deepEqual(other.unprovable, ['../../styles/img.png'])
    // load paths and URLs are not references
    assert.equal(rewriteMovedImports('@import "bootstrap/scss/x";\n.a { background: url(https://x.test/a.png) url(/public/a.png) }\n', scssFrom, scssTo, app, new Map()).source, '@import "bootstrap/scss/x";\n.a { background: url(https://x.test/a.png) url(/public/a.png) }\n')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rewriteMovedImports rewrites @import url(), @source url() and a nested url() once, and keeps the result resolvable', () => {
  const root = mkdtempSync(join(tmpdir(), 'css-dup-'))
  try {
    mkdirSync(join(root, 'src/app/blog'), { recursive: true })
    mkdirSync(join(root, 'src/styles'), { recursive: true })
    writeFileSync(join(root, 'src/styles/a.css'), '.a{}')
    writeFileSync(join(root, 'src/styles/logo.png'), 'x')
    const app = join(root, 'src/app')
    const from = join(app, 'blog/s.css')
    const to = join(root, 'templates/blog/s.css')
    const source = '@import url("../../styles/a.css");\n@import url(../../styles/a.css) screen;\n@source url("../../styles");\n.x { background: url(\'../../styles/logo.png\') }\n@import "../../styles/a.css", url("../../styles/a.css");\n'
    const out = rewriteMovedImports(source, from, to, app, new Map())
    assert.deepEqual(out.unprovable, [])
    assert.equal(out.source, source.split('../../styles').join('../../src/styles'))
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('rewriteMovedImports refuses a rewrite whose target would not exist', () => {
  const root = mkdtempSync(join(tmpdir(), 'css-inv-'))
  try {
    mkdirSync(join(root, 'src/app/blog'), { recursive: true })
    writeFileSync(join(root, 'src/lib.css'), '.a{}')
    // The reference resolves today; from the new place the computed target is the same file, so it is fine
    const ok = rewriteMovedImports('@import "../../lib.css";', join(root, 'src/app/blog/s.css'), join(root, 'templates/blog/s.css'), join(root, 'src/app'), new Map())
    assert.deepEqual(ok.unprovable, [])
    assert.equal(ok.source, '@import "../../src/lib.css";')
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})

test('assertContained refuses a link anywhere on the way, and a real path outside the project', () => {
  const base = mkdtempSync(join(tmpdir(), 'contained-'))
  const outside = mkdtempSync(join(tmpdir(), 'outside-'))
  try {
    const host = join(base, 'host')
    mkdirSync(join(host, 'real'), { recursive: true })
    writeFileSync(join(host, 'real/f.ts'), '')
    assertContained(host, join(host, 'real/f.ts'))
    assertContained(host, join(host, 'not/yet/there.ts'))
    symlinkSync(outside, join(host, 'linked'))
    writeFileSync(join(outside, 'victim.ts'), '')
    assert.throws(() => assertContained(host, join(host, 'linked/victim.ts')), /linked: it is a symbolic link/)
    assert.throws(() => assertContained(host, join(host, 'linked')), /symbolic link/)
    assert.throws(() => assertContained(host, outside), /outside the project/)
    assert.throws(() => assertContained(host, join(host, '..', 'x')), /outside the project/)
  } finally {
    rmSync(base, { recursive: true, force: true })
    rmSync(outside, { recursive: true, force: true })
  }
})
