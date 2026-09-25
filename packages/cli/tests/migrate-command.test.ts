import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { before, test } from 'node:test'
import { access, chmod, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as tar from 'tar'

import { buildCli } from './built-cli.js'

let cliEntry: string
before(() => { cliEntry = buildCli() })

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CORE_SOURCE = join(PKG_ROOT, '../core')
const CORE_SYNC_SUPPORT = [
  'scripts/build/registry/write-places.mjs',
  'scripts/build/registry/project-mode.mjs',
  'scripts/build/registry/post-build/own-gitignores.mjs',
  'scripts/build/safe-fs.mjs',
]

async function write(root: string, file: string, content: string): Promise<void> {
  const target = join(root, file)
  await mkdir(join(target, '..'), { recursive: true })
  await writeFile(target, content)
}

function git(root: string, args: string[]): void {
  execFileSync('git', args, { cwd: root, stdio: 'ignore' })
}

async function startRepository(root: string): Promise<void> {
  git(root, ['init', '--quiet'])
  git(root, ['config', 'user.email', 'fixture@example.test'])
  git(root, ['config', 'user.name', 'Fixture'])
}

async function commitFixture(root: string): Promise<void> {
  git(root, ['add', '.'])
  git(root, ['commit', '--quiet', '-m', 'fixture'])
}

/** Install the same guarded sync prerequisites a production core provides. */
async function installSyncableCore(root: string, registry: string, version = '0.0.0-test'): Promise<void> {
  const core = 'node_modules/@nextsparkjs/core'
  await write(root, `${core}/package.json`, JSON.stringify({ name: '@nextsparkjs/core', version }))
  for (const file of CORE_SYNC_SUPPORT) await write(root, `${core}/${file}`, await readFile(join(CORE_SOURCE, file), 'utf8'))
  await write(root, `${core}/templates/app/layout.tsx`, 'export default function Layout() { return null }\n')
  await write(root, `${core}/templates/app/page.tsx`, 'export default function Page() { return null }\n')
  await write(root, `${core}/scripts/build/registry.mjs`, registry)
  await write(root, 'node_modules/next/package.json', JSON.stringify({ name: 'next', version: '16.0.0' }))
}

function run(root: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cliEntry, 'migrate', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
    // The migrate command may inspect an older published core. Tests must
    // never let an accidental lookup escape to the real npm registry.
    env: { ...process.env, npm_config_registry: 'http://127.0.0.1:9', ...env },
  })
}

function runWithoutActiveTheme(root: string, args: string[]) {
  const env = { ...process.env }
  delete env.NEXT_PUBLIC_ACTIVE_THEME
  return spawnSync(process.execPath, [cliEntry, 'migrate', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...env, npm_config_registry: 'http://127.0.0.1:9' },
  })
}

async function flatFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-flat-'))
  await startRepository(root)
  await write(root, 'package.json', JSON.stringify({
    name: 'flat', packageManager: 'pnpm@9.0.0', dependencies: { next: '^16.0.0', '@nextsparkjs/core': '0.1.0-beta.192' },
  }))
  await write(root, 'packages/tool/package.json', JSON.stringify({
    name: '@flat/tool', dependencies: { '@nextsparkjs/cli': '^0.1.0-beta.192', '@nextsparkjs/ui': '~0.1.0-beta.192' },
  }))
  await write(root, 'next.config.mjs', 'export default {}\n')
  await write(root, '.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
  await write(root, 'node_modules/@nextsparkjs/core/package.json', '{"name":"@nextsparkjs/core"}\n')
  await write(root, 'node_modules/@nextsparkjs/core/templates/app/layout.tsx', 'export default function Layout() { return null }\n')
  await write(root, 'node_modules/@nextsparkjs/core/templates/next.config.mjs', 'export default {}\n')
  await write(root, 'contents/themes/acme/index.ts', 'export {}\n')
  await commitFixture(root)
  return root
}

async function monorepoFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-monorepo-'))
  await startRepository(root)
  await write(root, 'package.json', JSON.stringify({
    name: 'repo', packageManager: 'pnpm@9.0.0',
    devDependencies: { next: '^16.0.0', '@nextsparkjs/ai-workflow': '0.1.0-beta.167' },
  }))
  await write(root, 'pnpm-workspace.yaml', "packages:\n  - 'web'\n  - 'packages/*'\n")
  await write(root, 'next.config.mjs', 'export default {}\n')
  await write(root, 'web/package.json', JSON.stringify({
    name: 'web', dependencies: { next: '^16.0.0', '@nextsparkjs/core': '0.1.0-beta.192', '@nextsparkjs/cli': '0.1.0-beta.192' },
    scripts: { theme: 'node scripts/check.mjs contents/themes/acme' },
  }))
  await write(root, 'web/pnpm-workspace.yaml', "packages:\n  - '../packages/*'\n")
  await write(root, 'web/pnpm-lock.yaml', 'lockfileVersion: 9\n')
  await write(root, 'web/.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await write(root, 'web/next.config.mjs', "const rewrite = (source) => source.replace('generated layout import', 'theme layout import')\nexport default { webpack(config) { return config } }\n")
  await write(root, 'web/next.config.cjs', "module.exports = { webpack(config) { config.resolve.alias['@/src/app/(templates)/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n")
  await write(root, 'web/app/layout.tsx', 'export default function Layout() { return <main /> }\n')
  await write(root, 'web/app/page.tsx', 'export default function Changed() { return null }\n')
  await write(root, 'web/app/project-only.tsx', 'export default function ProjectOnly() { return null }\n')
  await write(root, 'web/proxy.ts', 'export default {}\n')
  await write(root, 'web/tsconfig.json', '{"compilerOptions":{"paths":{"@/*":["./*"],"theme":["contents/themes/acme/*"]}}}\n')
  await write(root, 'web/jest.config.cjs', "module.exports = {\n  rootDir: '../../../..',\n  theme: 'contents/themes/acme',\n}\n")
  await write(root, 'web/scripts/check.mjs', "const theme = '../../../contents/themes/acme'\n")
  for (const output of ['dist', 'build', 'out', '.turbo', 'coverage']) {
    await write(root, `web/${output}/tsconfig.json`, '{"compilerOptions":{"paths":{"theme":["contents/themes/acme/*"]}}}\n')
  }
  await write(root, 'web/.gitignore', 'contents/themes/acme/tests/output\nignored-output/\n')
  await write(root, 'web/ignored-output/tsconfig.json', '{"compilerOptions":{"paths":{"theme":["contents/themes/acme/*"]}}}\n')
  await write(root, 'web/node_modules/@nextsparkjs/core/package.json', '{"name":"@nextsparkjs/core"}\n')
  await write(root, 'web/node_modules/@nextsparkjs/core/templates/app/layout.tsx', 'export default function Layout() { return <main /> }\n')
  await write(root, 'web/node_modules/@nextsparkjs/core/templates/app/page.tsx', 'export default function Page() { return null }\n')
  await write(root, 'web/node_modules/@nextsparkjs/core/templates/next.config.mjs', 'export default {}\n')
  await write(root, 'web/node_modules/@nextsparkjs/core/templates/proxy.ts', 'export default {}\n')
  await write(root, 'web/contents/themes/acme/middleware.ts', 'export function middleware() {}\n')
  await write(root, 'web/contents/themes/acme/public/logo.txt', 'same bytes\n')
  await write(root, 'web/contents/themes/acme/README.md', 'theme copy\n')
  await write(root, 'web/public/logo.txt', 'same bytes\n')
  await write(root, 'web/README.md', 'host copy\n')
  await write(root, 'web/contents/themes/acme/templates/page.tsx', "import Page from '@/contents/themes/acme/components/Page'\n")
  await write(root, 'web/contents/plugins/local/index.ts', "import Plugin from '@/contents/plugins/local/Plugin'\n")
  await write(root, 'packages/tokens/package.json', JSON.stringify({ name: '@acme/tokens', dependencies: { '@nextsparkjs/ui': '0.1.0-beta.167' } }))
  await write(root, 'packages/tokens/scripts/read-theme.mjs', "readFileSync('web/contents/themes/acme/styles/globals.css')\n")
  await commitFixture(root)
  await write(root, 'web/lib/not-yet-tracked.ts', 'export const local = true\n')
  return root
}

async function ambiguousHostsFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-ambiguous-'))
  await startRepository(root)
  for (const directory of ['app', 'dashboard']) {
    await write(root, `${directory}/package.json`, JSON.stringify({ name: directory, dependencies: { next: '^16.0.0' } }))
    await write(root, `${directory}/next.config.mjs`, 'export default {}\n')
  }
  await commitFixture(root)
  return root
}

async function generatedRewriteFixture(config: string): Promise<string> {
  const root = await flatFixture()
  await write(root, 'next.config.mjs', config)
  return root
}

test('migrate --dry-run resolves a flat host and reports empty risk categories', async () => {
  const root = await flatFixture()
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.ok(report.hostRoot, result.stdout)
    assert.equal(report.hostRoot.path, '.')
    assert.match(report.hostRoot.reason, /next\.config/)
    assert.equal(report.versions.drift, false)
    assert.deepEqual(report.versions.driftVersions, ['0.1.0-beta.192'])
    assert.equal(report.activeTheme.name, 'acme')
    assert.equal(report.activeTheme.plugins.length, 0)
    assert.equal(report.appTemplates.identical.length, 1)
    assert.equal(report.collisions.reserved.length, 0)
    assert.equal(report.collisions.files.length, 0)
    assert.equal(report.untracked.length, 0)
    assert.equal(report.siblingThemeReferences.length, 0)

    const text = run(root, ['--dry-run'])
    assert.equal(text.status, 0, `${text.stdout}\n${text.stderr}`)
    assert.match(text.stdout, /Host root/)
    assert.match(text.stdout, /Root-first collisions/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run resolves a monorepo web host and reports migration risks', async () => {
  const root = await monorepoFixture()
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.ok(report.hostRoot, result.stdout)
    assert.equal(report.hostRoot.path, 'web')
    assert.match(report.hostRoot.reason, /package\.json depends on next/)
    assert.equal(report.versions.drift, true)
    assert.deepEqual(report.versions.driftVersions, ['0.1.0-beta.167', '0.1.0-beta.192'])
    assert.equal(report.activeTheme.name, 'acme')
    assert.equal(report.activeTheme.plugins[0].name, 'local')
    assert.equal(report.appTemplates.identical.includes('layout.tsx'), true, JSON.stringify(report.appTemplates))
    assert.equal(report.appTemplates.modified.some((entry: { path: string; changedLines: number }) => entry.path === 'page.tsx' && entry.changedLines > 0), true)
    assert.equal(report.appTemplates.projectOnly.includes('project-only.tsx'), true)
    assert.equal(report.rootTemplates.modified.some((entry: { path: string }) => entry.path === 'next.config.mjs'), true)
    assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, ['next.config.cjs'])
    assert.ok(report.imports.themeOccurrences > 0)
    assert.ok(report.imports.pluginOccurrences > 0)
    const jestThemeReference = report.toolingReferences.find((entry: { path: string }) => entry.path === 'web/jest.config.cjs')
    assert.equal(jestThemeReference.relativeDepth, false)
    const helperThemeReference = report.toolingReferences.find((entry: { path: string }) => entry.path === 'web/scripts/check.mjs')
    assert.equal(helperThemeReference.relativeDepth, true)
    assert.equal(report.toolingReferences.some((entry: { path: string }) => /web\/(?:dist|build|out|\.turbo|coverage|ignored-output)\//.test(entry.path)), false)
    assert.equal(report.collisions.reserved.some((entry: { path: string }) => entry.path === 'middleware.ts'), true)
    assert.equal(report.collisions.files.some((entry: { path: string; identical: boolean }) => entry.path === 'public/logo.txt' && entry.identical), true)
    assert.equal(report.collisions.files.some((entry: { path: string; identical: boolean }) => entry.path === 'README.md' && !entry.identical), true)
    assert.equal(report.untracked.some((file: string) => file === 'web/lib/not-yet-tracked.ts'), true)
    assert.equal(report.siblingThemeReferences.some((entry: { path: string }) => entry.path === 'packages/tokens/scripts/read-theme.mjs'), true)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const [shape, config] of [
  ['method shorthand', "export default { webpack(config) { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n"],
  ['arrow function', "export default { webpack: (config) => { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n"],
  ['async arrow function', "export default { webpack: async (config) => { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n"],
  ['function property', "export default { webpack: function (config) { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n"],
  ['method shorthand with destructured Next options', "export default { webpack(config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n"],
  ['arrow function with destructured Next options', "export default { webpack: (config, { buildId, dev, isServer, defaultLoaders, nextRuntime, webpack }) => { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n"],
] as const) {
  test(`migrate --dry-run detects a generated-route alias rewrite in a webpack ${shape}`, async () => {
    const root = await generatedRewriteFixture(config)
    try {
      const result = run(root, ['--dry-run', '--json'])
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
      const report = JSON.parse(result.stdout)
      assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, ['next.config.mjs'])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('migrate --dry-run detects a generated-route resolveAlias rewrite in turbopack config', async () => {
  const root = await generatedRewriteFixture("export default { turbopack: { resolveAlias: { '@/src/app/(templates)/layout.tsx': '@/contents/themes/acme/templates/layout.tsx' } } }\n")
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, ['next.config.mjs'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run detects a generated-route NormalModuleReplacementPlugin rewrite', async () => {
  const root = await generatedRewriteFixture("export default { webpack(config) { config.plugins.push(new webpack.NormalModuleReplacementPlugin(/app\\/layout/, '@/contents/themes/acme/templates/layout.tsx')); return config } }\n")
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, ['next.config.mjs'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run detects a generated-route string replacement', async () => {
  const root = await generatedRewriteFixture("const generatedRoute = '@/app/layout.tsx'.replace('@/app/layout.tsx', '@/contents/themes/acme/templates/layout.tsx')\nexport default {}\n")
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, ['next.config.mjs'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run ignores an ordinary string that mentions webpack and layout', async () => {
  const root = await generatedRewriteFixture("const description = \"webpack: (config) => { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx' }\"\nexport default {}\n")
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run ignores a comment that mentions a generated-route rewrite', async () => {
  const root = await generatedRewriteFixture("// webpack(config) { config.resolve.alias['@/app/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx' }\nexport default {}\n")
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const [shape, config] of [
  ['webpack alias assignment', "export default { webpack(config) { config.resolve.alias['@/components/Button'] = '@/contents/themes/acme/components/Button'; return config } }\n"],
  ['turbopack alias object', "export default { turbopack: { resolveAlias: { '@lib/format': './lib/format' } } }\n"],
] as const) {
  test(`migrate --dry-run ignores an unrelated ${shape}`, async () => {
    const root = await generatedRewriteFixture(config)
    try {
      const result = run(root, ['--dry-run', '--json'])
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
      const report = JSON.parse(result.stdout)
      assert.deepEqual(report.rootTemplates.generatorImportRewriteWarnings, [])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('migrate --dry-run reports deterministic ambiguous host selection', async () => {
  const root = await ambiguousHostsFixture()
  try {
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.equal(report.hostRoot.path, 'app')
    assert.match(report.hostRoot.reason, /ambiguous host signals/i)
    assert.match(report.hostRoot.reason, /lexicographic/i)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run reports no active theme when .env.example is absent', async () => {
  const root = await flatFixture()
  try {
    await rm(join(root, '.env.example'))
    const result = runWithoutActiveTheme(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.equal(report.activeTheme.name, null)
    assert.equal(report.activeTheme.source, null)
    assert.ok(report.warnings.some((warning: string) => /No active theme/.test(warning)))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate --dry-run explains that it requires a git repository', async () => {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-no-git-'))
  try {
    const result = run(root, ['--dry-run', '--json'], { GIT_CEILING_DIRECTORIES: dirname(root) })
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /nextspark migrate: This command must run inside a git repository\./)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate without --dry-run explains that the moving slice is not available', async () => {
  const root = await flatFixture()
  try {
    const result = run(root, [])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /rerun with --yes/i)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

async function moveFixture({
  monorepo = false,
  collision = false,
  middleware = 'export function middleware() { return undefined }\n',
  duplicateImport = false,
  unknownReference = false,
  brokenImport = false,
  preexistingBrokenImport = false,
  aliases = false,
}: {
  monorepo?: boolean
  collision?: boolean
  middleware?: string
  duplicateImport?: boolean
  unknownReference?: boolean
  brokenImport?: boolean
  preexistingBrokenImport?: boolean
  aliases?: boolean
} = {}): Promise<{ root: string, host: string }> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-move-'))
  await startRepository(root)
  const host = monorepo ? 'web' : '.'
  const atHost = (file: string) => host === '.' ? file : join(host, file)
  await write(root, atHost('package.json'), JSON.stringify({ name: 'fixture', packageManager: 'pnpm@9.0.0', dependencies: { next: '^16.0.0' }, scripts: { check: 'node scripts/check.mjs contents/themes/acme' } }, null, 2))
  await write(root, atHost('next.config.mjs'), 'export default {}\n')
  await write(root, atHost('nextspark.config.ts'), "export default { theme: 'acme', plugins: ['local'] }\n")
  await write(root, atHost('.env.example'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  const tsconfigPaths = aliases
    ? { '@/*': ['./*'], '@/contents/*': ['./contents/*'], '@/themes/*': ['./contents/themes/*'], '@/plugins/*': ['./contents/plugins/*'], '@legacy-theme/*': ['./contents/themes/acme/*'] }
    : { '@/*': ['contents/themes/acme/*'] }
  const cypressPaths = aliases
    ? { '@/*': ['./*'], '@cypress-theme/*': ['./contents/themes/acme/*'] }
    : undefined
  await write(root, atHost('tsconfig.json'), `${JSON.stringify({ include: ['contents/themes/acme/**/*.ts'], compilerOptions: { paths: tsconfigPaths } })}\n`)
  await write(root, atHost('tsconfig.cypress.json'), `${JSON.stringify({ include: ['contents/themes/acme/tests/cypress/**/*.ts'], compilerOptions: cypressPaths ? { paths: cypressPaths } : {} })}\n`)
  await write(root, atHost('pnpm-workspace.yaml'), "packages:\n  - 'contents/themes/*'\n  - 'contents/plugins/*'\n")
  await write(root, atHost('.gitignore'), 'contents/themes/acme/tests/output\n')
  await write(root, atHost('scripts/check.mjs'), "const theme = '../../../contents/themes/acme'\n")
  const buttonSource = duplicateImport
    ? "import { Icon } from './Icon'\nexport const Button = Icon\n"
    : unknownReference
      ? "import notes from '../docs/notes'\nexport const loadNotes = () => import(`../docs/notes`)\nexport const Button = notes\n"
      : brokenImport
        ? "import missing from '../app/missing'\nconst resolved = require.resolve('../app/missing')\nexport const Button = missing ?? resolved\n"
        : preexistingBrokenImport
          ? "import missing from '../missing'\nexport const Button = missing\n"
        : 'export const Button = true\n'
  await write(root, atHost('contents/themes/acme/components/Button.ts'), buttonSource)
  await write(root, atHost('contents/themes/acme/templates/page.tsx'), "import { Button } from '../components/Button'\nexport default Button\n")
  await write(root, atHost('contents/themes/acme/styles/globals.css'), brokenImport ? '@import url("../app/missing.css");\n' : '@import "../components/Button.css";\n')
  await write(root, atHost('contents/themes/acme/components/Button.css'), '.button {}\n')
  await write(root, atHost('contents/themes/acme/tests/jest.config.cjs'), "module.exports = { rootDir: '../../../../' }\n")
  await write(root, atHost('contents/themes/acme/middleware.ts'), middleware)
  await write(root, atHost('contents/themes/acme/lib/use-hook.ts'), "import { middleware } from '../middleware'\nexport { middleware }\n")
  await write(root, atHost('contents/plugins/local/index.ts'), "export { default as Plugin } from '@/contents/plugins/local/Plugin'\n")
  await write(root, atHost('contents/plugins/local/Plugin.ts'), 'export default true\n')
  if (aliases) {
    await write(root, atHost('contents/themes/acme/tests/alias-imports.ts'), "import { Button as themeButton } from '@/themes/acme/components/Button'\nimport plugin from '@/plugins/local/Plugin'\nimport { Button as customButton } from '@legacy-theme/components/Button'\nexport { themeButton, plugin, customButton }\n")
    await write(root, atHost('contents/themes/acme/tests/cypress/alias-imports.cy.ts'), "import { Button } from '@cypress-theme/components/Button'\nexport { Button }\n")
  }
  if (duplicateImport) {
    await write(root, atHost('contents/themes/acme/components/Icon.ts'), 'export const Icon = true\n')
    await write(root, atHost('components/Icon.ts'), 'export const Icon = true\n')
  }
  if (unknownReference) {
    await write(root, atHost('contents/themes/acme/docs/notes.ts'), 'export default "notes"\n')
    await write(root, atHost('scripts/read-notes.mjs'), "const notes = '@/contents/themes/acme/docs/notes.ts'\n")
  }
  if (brokenImport) {
    await write(root, atHost('contents/themes/acme/app/missing.ts'), 'export default true\n')
    await write(root, atHost('contents/themes/acme/app/missing.css'), '.missing {}\n')
  }
  if (collision) {
    await write(root, atHost('contents/themes/acme/public/same.txt'), 'same\n')
    await write(root, atHost('public/same.txt'), 'same\n')
    await write(root, atHost('contents/themes/acme/README.md'), 'theme README\n')
    await write(root, atHost('README.md'), 'host README\n')
  }
  if (monorepo) {
    await write(root, 'package.json', JSON.stringify({ name: 'repo', packageManager: 'pnpm@9.0.0' }))
    await write(root, 'pnpm-workspace.yaml', "packages:\n  - 'web'\n  - 'packages/*'\n")
    await write(root, 'packages/tokens/package.json', JSON.stringify({ name: '@fixture/tokens' }))
    await write(root, 'packages/tokens/scripts/read.mjs', "readFileSync('web/contents/themes/acme/styles/globals.css')\n")
  }
  await commitFixture(root)
  return { root, host: join(root, host) }
}

async function symlinkedMoveFixture(link: 'themes' | 'plugins'): Promise<{ root: string, host: string, sharedFile: string }> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-symlink-'))
  await startRepository(root)
  const host = join(root, 'apps/dev')
  await write(root, 'package.json', JSON.stringify({ name: 'repo', packageManager: 'pnpm@9.0.0' }))
  await write(root, 'apps/dev/package.json', JSON.stringify({ name: 'dev', dependencies: { next: '^16.0.0' } }))
  await write(root, 'apps/dev/next.config.mjs', 'export default {}\n')
  await write(root, 'apps/dev/.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await write(root, 'themes/acme/components/Button.ts', 'export const Button = true\n')
  await write(root, 'plugins/local/Plugin.ts', 'export default true\n')
  await mkdir(join(host, 'contents'), { recursive: true })
  if (link === 'themes') {
    await symlink('../../../themes', join(host, 'contents/themes'))
    await mkdir(join(host, 'contents/plugins/local'), { recursive: true })
    await write(root, 'apps/dev/contents/plugins/local/Plugin.ts', 'export default true\n')
  } else {
    await mkdir(join(host, 'contents/themes/acme/components'), { recursive: true })
    await write(root, 'apps/dev/contents/themes/acme/components/Button.ts', 'export const Button = true\n')
    await symlink('../../../plugins', join(host, 'contents/plugins'))
  }
  await commitFixture(root)
  return {
    root,
    host,
    sharedFile: link === 'themes' ? join(root, 'themes/acme/components/Button.ts') : join(root, 'plugins/local/Plugin.ts'),
  }
}

async function customRootDirectoriesFixture(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-custom-roots-'))
  await startRepository(root)
  await write(root, 'package.json', JSON.stringify({ name: 'fixture', packageManager: 'pnpm@9.0.0', dependencies: { next: '^16.0.0' } }))
  await write(root, 'next.config.mjs', 'export default {}\n')
  await write(root, '.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await write(root, 'contents/themes/acme/services/load.ts', "import { run } from '@/contents/themes/acme/workers/run'\nexport const load = run\n")
  await write(root, 'contents/themes/acme/hooks/use-run.ts', "import { run } from '../workers/run'\nexport const useRun = run\n")
  await write(root, 'contents/themes/acme/workers/run.ts', 'export const run = true\n')
  await commitFixture(root)
  return root
}

test('migrate --yes moves an intact legacy project and rewrites its source and tooling', async () => {
  const { root } = await moveFixture()
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /Migration complete/)
    assert.match(result.stdout, /git -C .* checkout -- \./)
    assert.equal(await readFile(join(root, 'components/Button.ts'), 'utf8'), 'export const Button = true\n')
    assert.match(await readFile(join(root, 'templates/page.tsx'), 'utf8'), /\.\.\/components\/Button/)
    assert.match(await readFile(join(root, 'config/hooks/proxy.ts'), 'utf8'), /export function proxyHook/)
    const hookUse = await readFile(join(root, 'lib/use-hook.ts'), 'utf8')
    assert.match(hookUse, /proxyHook/)
    assert.doesNotMatch(hookUse, /middleware/)
    assert.match(await readFile(join(root, 'plugins/local/index.ts'), 'utf8'), /@\/plugins\/local/)
    assert.doesNotMatch(await readFile(join(root, 'tsconfig.json'), 'utf8'), /contents\/themes/)
    assert.doesNotMatch(await readFile(join(root, 'tsconfig.cypress.json'), 'utf8'), /contents\/themes/)
    assert.doesNotMatch(await readFile(join(root, 'pnpm-workspace.yaml'), 'utf8'), /contents\/themes/)
    assert.doesNotMatch(await readFile(join(root, '.gitignore'), 'utf8'), /contents\/themes/)
    assert.doesNotMatch(await readFile(join(root, 'package.json'), 'utf8'), /contents\/themes/)
    assert.doesNotMatch(await readFile(join(root, 'scripts/check.mjs'), 'utf8'), /contents\/themes/)
    assert.equal((await readFile(join(root, '.env.example'), 'utf8')).includes('NEXT_PUBLIC_ACTIVE_THEME'), false)
    assert.equal(await readFile(join(root, 'nextspark.config.ts'), 'utf8'), "export default { theme: 'acme', plugins: ['local'] }\n")
    assert.match(await readFile(join(root, 'tests/jest.config.cjs'), 'utf8'), /rootDir: '\.\.'/)
    await assert.rejects(access(join(root, 'contents')))
    assert.match(result.stdout, /contents\/: removed/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate rewrites an aliased legacy middleware import to the proxy hook export', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'contents/themes/acme/lib/use-hook.ts', "import { middleware as mw } from '../middleware'\nexport { mw }\n")
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'lib/use-hook.ts'), 'utf8'), "import { proxyHook as mw } from '../config/hooks/proxy'\nexport { mw }\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate refuses an unsupported legacy middleware import shape before moving files', async () => {
  const { root } = await moveFixture()
  try {
    const source = "import middleware from '../middleware'\nexport { middleware }\n"
    await write(root, 'contents/themes/acme/lib/use-hook.ts', source)
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Cannot safely rewrite legacy middleware import in contents\/themes\/acme\/lib\/use-hook\.ts:1/)
    assert.equal(await readFile(join(root, 'contents/themes/acme/lib/use-hook.ts'), 'utf8'), source)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate preserves a test re-export of its locally aliased middleware binding', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'contents/themes/acme/tests/re-export-hook.test.ts', "import { middleware } from '../middleware'\nexport { middleware }\n")
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'tests/re-export-hook.test.ts'), 'utf8'), "import { proxyHook as middleware } from '../config/hooks/proxy'\nexport { middleware }\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate moves explicit and custom top-level source directories and rewrites their imports', async () => {
  const root = await customRootDirectoriesFixture()
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /legacy contents\/ imports in moved output: 0/)
    assert.equal(await readFile(join(root, 'services/load.ts'), 'utf8'), "import { run } from '@/workers/run'\nexport const load = run\n")
    assert.equal(await readFile(join(root, 'hooks/use-run.ts'), 'utf8'), "import { run } from '../workers/run'\nexport const useRun = run\n")
    assert.equal(await readFile(join(root, 'workers/run.ts'), 'utf8'), 'export const run = true\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate derives legacy theme and plugin aliases from every project tsconfig', async () => {
  const { root } = await moveFixture({ aliases: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(
      await readFile(join(root, 'tests/alias-imports.ts'), 'utf8'),
      "import { Button as themeButton } from '@/components/Button'\nimport plugin from '@/plugins/local/Plugin'\nimport { Button as customButton } from '@/components/Button'\nexport { themeButton, plugin, customButton }\n",
    )
    assert.equal(await readFile(join(root, 'tests/cypress/alias-imports.cy.ts'), 'utf8'), "import { Button } from '@/components/Button'\nexport { Button }\n")
    const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'))
    assert.deepEqual(tsconfig.compilerOptions.paths, { '@/*': ['./*'], '@/contents/*': ['./contents/*'] })
    const cypress = JSON.parse(await readFile(join(root, 'tsconfig.cypress.json'), 'utf8'))
    assert.deepEqual(cypress.compilerOptions.paths, { '@/*': ['./*'] })
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const legacyTargetExists of [false, true]) {
  test(`migrate does not apply a nested tsconfig alias to an unrelated host import${legacyTargetExists ? ' when the corrupted target exists' : ''}`, async () => {
    const { root } = await moveFixture()
    try {
      await write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./*'] } } }))
      await write(root, 'lib/consumer.ts', "import { helper } from '@/lib/helper'\nexport const consumer = helper\n")
      await write(root, 'lib/helper.ts', 'export const helper = true\n')
      await write(root, 'contents/themes/acme/widgets/tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@/*': ['./src/*'] } } }))
      if (legacyTargetExists) await write(root, 'contents/themes/acme/widgets/src/lib/helper.ts', 'export const helper = false\n')
      await commitFixture(root)

      const result = run(root, ['--yes'])
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
      assert.equal(await readFile(join(root, 'lib/consumer.ts'), 'utf8'), "import { helper } from '@/lib/helper'\nexport const consumer = helper\n")
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('migrate reads JSONC aliases through relative and package extends chains using the defining config baseUrl', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'tsconfig.json', '{\n  // TypeScript permits comments and trailing commas here.\n  "extends": "@fixture/tsconfig/base.json",\n}\n')
    await write(root, 'node_modules/@fixture/tsconfig/base.json', '{ "extends": "../../../config/base.json" }\n')
    await write(root, 'config/base.json', JSON.stringify({ compilerOptions: { baseUrl: '..', paths: { '@legacy/*': ['contents/themes/acme/*'] } } }))
    await write(root, 'contents/themes/acme/tests/extends-alias.ts', "import { Button } from '@legacy/components/Button'\nexport { Button }\n")
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'tests/extends-alias.ts'), 'utf8'), "import { Button } from '@/components/Button'\nexport { Button }\n")
    const base = JSON.parse(await readFile(join(root, 'config/base.json'), 'utf8'))
    assert.deepEqual(base.compilerOptions.paths, {})
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate names an unparseable tsconfig in its alias report instead of silently skipping it', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'tsconfig.invalid.json', '{ // missing closing brace\n  "compilerOptions": {\n')
    await commitFixture(root)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /Alias configuration warnings/)
    assert.match(result.stdout, /tsconfig\.invalid\.json/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const [shape, middleware] of [
  ['named function', 'export function middleware(req: Request) { return req }\n'],
  ['named async function', 'export async function middleware(req: Request) { return req }\n'],
  ['const arrow', 'export const middleware = (req: Request) => req\n'],
  ['const async arrow', 'export const middleware = async (req: Request) => req\n'],
  ['const function expression', 'export const middleware = function (req: Request) { return req }\n'],
  ['let arrow', 'export let middleware = (req: Request) => req\n'],
  ['let function expression', 'export let middleware = function (req: Request) { return req }\n'],
  ['default named function', 'export default function middleware(req: Request) { return req }\n'],
  ['default async named function', 'export default async function middleware(req: Request) { return req }\n'],
  ['default anonymous function', 'export default function (req: Request) { return req }\n'],
  ['default arrow', 'export default (req: Request) => req\n'],
  ['default async arrow', 'export default async (req: Request) => req\n'],
  ['default identifier', 'const middleware = (req: Request) => req\nexport default middleware\n'],
] as const) {
  test(`migrate rewrites the ${shape} middleware export to proxyHook`, async () => {
    const { root } = await moveFixture({ middleware })
    try {
      const result = run(root, ['--yes'])
      assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
      const proxy = await readFile(join(root, 'config/hooks/proxy.ts'), 'utf8')
      assert.match(proxy, /export (?:(?:async )?(?:function|const|let) proxyHook\b|\{ middleware as proxyHook \})/)
      assert.doesNotMatch(proxy, /export\s+default/)
      assert.doesNotMatch(proxy, /export\s+(?:const|let|function|async function)\s+middleware\b/)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('migrate refuses an unrecognized middleware export before changing the tree', async () => {
  const middleware = 'const middleware = withAuth((req: Request) => req)\nexport default withLogging(middleware)\n'
  const { root } = await moveFixture({ middleware })
  try {
    const result = run(root, ['--yes'])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /middleware export shape is not recognized/i)
    assert.equal(await readFile(join(root, 'contents/themes/acme/middleware.ts'), 'utf8'), middleware)
    await assert.rejects(access(join(root, 'config/hooks/proxy.ts')))
    assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate resolves relative imports of byte-identical duplicates to the existing destination', async () => {
  const { root } = await moveFixture({ duplicateImport: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(await readFile(join(root, 'components/Button.ts'), 'utf8'), /from '\.\/Icon'/)
    await assert.rejects(access(join(root, 'contents/themes/acme/components/Icon.ts')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate moves the recognized docs root and rewrites imports to it', async () => {
  const { root } = await moveFixture({ unknownReference: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'scripts/read-notes.mjs'), 'utf8'), "const notes = '@/docs/notes.ts'\n")
    const button = await readFile(join(root, 'components/Button.ts'), 'utf8')
    assert.match(button, /from '\.\.\/docs\/notes'/)
    assert.match(button, /import\(`\.\.\/docs\/notes`\)/)
    assert.equal(await readFile(join(root, 'docs/notes.ts'), 'utf8'), 'export default "notes"\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate stops before writes on a different-content host collision', async () => {
  const { root } = await moveFixture({ collision: true })
  try {
    const result = run(root, ['--yes'])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /Refusing to overwrite different host files: README\.md/)
    assert.doesNotMatch(result.stdout, /Migration complete/)
    assert.equal(await readFile(join(root, 'public/same.txt'), 'utf8'), 'same\n')
    assert.equal(await readFile(join(root, 'contents/themes/acme/public/same.txt'), 'utf8'), 'same\n')
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'host README\n')
    assert.equal(await readFile(join(root, 'contents/themes/acme/README.md'), 'utf8'), 'theme README\n')
    await assert.rejects(access(join(root, 'components/Button.ts')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate ends non-zero and lists a moved file import whose reserved target was not moved', async () => {
  const { root } = await moveFixture({ brokenImport: true })
  try {
    const result = run(root, ['--yes'])
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /Migration complete/)
    assert.match(result.stdout, /MIGRATION FAILED: migration introduced broken imports/)
    assert.match(result.stdout, /components\/Button\.ts:1 → \.\.\/app\/missing/)
    assert.match(result.stdout, /components\/Button\.ts:2 → \.\.\/app\/missing/)
    assert.match(result.stdout, /styles\/globals\.css:1 → \.\.\/app\/missing\.css/)
    const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'))
    assert.deepEqual(tsconfig.compilerOptions.paths, { '@/*': ['contents/themes/acme/*'] })
    await access(join(root, 'components/Button.ts'))
    await access(join(root, 'contents/themes/acme/app/missing.ts'))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate reports broken imports that predate the move as warnings and exits zero', async () => {
  const { root } = await moveFixture({ preexistingBrokenImport: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /Migration complete/)
    assert.match(result.stdout, /WARNING: migration completed; these imports were already broken before migration \(exit 0\)/)
    assert.match(result.stdout, /components\/Button\.ts:1 → \.\.\/missing/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const link of ['themes', 'plugins'] as const) {
  test(`migrate refuses a symlinked contents/${link} tree before moving shared repository files`, async () => {
    const { root, host, sharedFile } = await symlinkedMoveFixture(link)
    try {
      const result = run(host, ['--yes'])
      assert.notEqual(result.status, 0)
      assert.match(result.stderr, new RegExp(`contents/${link}.*(?:symbolic link|outside the host root)`, 'i'))
      await access(sharedFile)
      await assert.rejects(access(link === 'themes' ? join(host, 'components/Button.ts') : join(host, 'plugins/local/Plugin.ts')))
      assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('migrate moves only the selected monorepo host and rewrites sibling helper paths', async () => {
  const { root, host } = await moveFixture({ monorepo: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(host, 'styles/globals.css'), 'utf8'), '@import "../components/Button.css";\n')
    assert.doesNotMatch(await readFile(join(root, 'packages/tokens/scripts/read.mjs'), 'utf8'), /contents\/themes\/acme/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate refuses a dirty tree and its documented rollback restores tracked and untracked move output', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'untracked.txt', 'dirty\n')
    const dirty = run(root, ['--yes'])
    assert.notEqual(dirty.status, 0)
    assert.match(dirty.stderr, /dirty git tree/)
    await rm(join(root, 'untracked.txt'))
    const moved = run(root, ['--yes'])
    assert.equal(moved.status, 0, `${moved.stdout}\n${moved.stderr}`)
    const rollbackCommands = moved.stdout
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.startsWith('git -C '))
    assert.equal(rollbackCommands.length, 2, moved.stdout)
    execFileSync('/bin/sh', ['-c', rollbackCommands.join('\n')], { cwd: root, stdio: 'ignore' })
    assert.equal(await readFile(join(root, 'contents/themes/acme/components/Button.ts'), 'utf8'), 'export const Button = true\n')
    await assert.rejects(access(join(root, 'components/Button.ts')))
    assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate creates a missing root-first config from required local and packaged plugins', async () => {
  const { root } = await moveFixture()
  try {
    await rm(join(root, 'nextspark.config.ts'))
    await write(root, 'package.json', JSON.stringify({
      name: 'fixture', packageManager: 'pnpm@9.0.0',
      dependencies: { next: '^16.0.0', '@nextsparkjs/plugin-langchain': '^1.0.0' },
    }))
    await write(root, 'contents/themes/acme/package.json', JSON.stringify({ requiredPlugins: ['local', '@nextsparkjs/plugin-langchain', 'missing'] }))
    await commitFixture(root)

    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    assert.deepEqual(JSON.parse(dryRun.stdout).config, { plannedCreation: true, plugins: ['@nextsparkjs/plugin-langchain', 'local'] })
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'nextspark.config.ts'), 'utf8'), "import { defineConfig } from '@nextsparkjs/core/lib/config'\n\nexport default defineConfig({\n  plugins: [\"@nextsparkjs/plugin-langchain\",\"local\"],\n})\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate reads plugins from the legacy config/theme.config.ts shape', async () => {
  const { root } = await moveFixture()
  try {
    await rm(join(root, 'nextspark.config.ts'))
    await write(root, 'contents/plugins/amplitude/index.ts', 'export default true\n')
    await write(root, 'contents/themes/acme/config/theme.config.ts', "export const themeConfig = { requiredPlugins: ['local'], plugins: ['amplitude'] }\n")
    await commitFixture(root)

    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    assert.deepEqual(JSON.parse(dryRun.stdout).config.plugins, ['amplitude', 'local'])
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(await readFile(join(root, 'nextspark.config.ts'), 'utf8'), /plugins: \["amplitude","local"\]/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate handles a nested real-shape workspace with only historical previous-core evidence', async () => {
  const { root, host } = await moveFixture({ monorepo: true })
  const support = await mkdtemp(join(tmpdir(), 'nextspark-migrate-real-shape-'))
  try {
    await rm(join(root, 'web/nextspark.config.ts'))
    await rm(join(root, 'web/contents/plugins/local'), { recursive: true, force: true })
    await write(root, '.gitignore', 'web/node_modules/\nweb/contents/themes/acme/tests/output\n')
    await write(root, 'pnpm-workspace.yaml', "packages:\n  - 'web'\n  - 'web/contents/themes/*'\n  - 'web/contents/plugins/*'\n")
    await write(root, 'web/contents/plugins/amplitude/index.ts', 'export default true\n')
    await write(root, 'web/contents/plugins/amplitude/.env.example', 'AMPLITUDE_KEY=synthetic\n')
    await write(root, 'web/contents/themes/acme/config/theme.config.ts', `import type { ThemeConfig } from '@nextsparkjs/core/types/theme'

export const acmeThemeConfig: ThemeConfig = {
  name: 'acme',
  displayName: 'Acme',
  version: '1.0.0',
  // The real legacy project declared plugins inside config/theme.config.ts,
  // not in the theme package.json or a top-level nextspark config.
  plugins: ['amplitude'],
  defaultMode: 'light',
}

export default acmeThemeConfig
`)
    const hostPackage = JSON.parse(await readFile(join(host, 'package.json'), 'utf8'))
    hostPackage.dependencies['@nextsparkjs/core'] = '0.1.0-beta.183'
    await write(root, 'web/package.json', `${JSON.stringify(hostPackage, null, 2)}\n`)
    await write(root, 'web/app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'web/app/page.tsx', 'export default function Page() { return <main>beta.183</main> }\n')
    await write(root, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  web:\n    dependencies:\n      '@nextsparkjs/core':\n        specifier: 0.1.0-beta.183\n        version: 0.1.0-beta.183\n")
    await commitFixture(root)

    hostPackage.dependencies['@nextsparkjs/core'] = 'file:/tmp/nextsparkjs-core-0.1.0-beta.192.tgz'
    await write(root, 'web/package.json', `${JSON.stringify(hostPackage, null, 2)}\n`)
    await write(root, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  web:\n    dependencies:\n      '@nextsparkjs/core':\n        specifier: file:/tmp/nextsparkjs-core-0.1.0-beta.192.tgz\n        version: file:../../tmp/nextsparkjs-core-0.1.0-beta.192.tgz(react@19.2.7)\n")
    await commitFixture(root)

    await installSyncableCore(host, "console.log('src/app/(templates) generated')\n", '0.1.0-beta.192')
    await write(root, 'web/node_modules/@nextsparkjs/core/templates/app/page.tsx', 'export default function Page() { return <main>beta.192</main> }\n')
    await write(support, 'package/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.183' }))
    await write(support, 'package/templates/app/page.tsx', 'export default function Page() { return <main>beta.183</main> }\n')
    const archive = join(support, 'core.tgz')
    await tar.c({ cwd: support, file: archive, gzip: true }, ['package'])
    const bin = join(support, 'bin')
    await write(bin, 'pnpm', `#!/usr/bin/env node\nconst { copyFileSync } = require('node:fs')\nconst { join } = require('node:path')\nconst destination = process.argv[process.argv.indexOf('--pack-destination') + 1]\ncopyFileSync(process.env.FAKE_CORE_TARBALL, join(destination, 'core.tgz'))\n`)
    await chmod(join(bin, 'pnpm'), 0o755)
    const env = { PATH: `${bin}:${process.env.PATH}`, FAKE_CORE_TARBALL: archive }

    const dryRun = run(host, ['--dry-run', '--json'], env)
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.equal(report.hostRoot.path, 'web')
    assert.equal(report.appTemplates.previousTemplateVersion, '0.1.0-beta.183')
    assert.match(report.appTemplates.previousTemplateVersionSource, /^git [0-9a-f]{8}:(?:web\/package\.json|pnpm-lock\.yaml)$/)
    assert.deepEqual(report.appTemplates.identical, ['layout.tsx'])
    assert.deepEqual(report.appTemplates.generatedByPreviousTemplate, ['page.tsx'])
    assert.deepEqual(report.config.plugins, ['amplitude'])

    const result = run(host, ['--yes'], env)
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    await assert.rejects(access(join(host, 'app')))
    await assert.rejects(access(join(host, 'contents')))
    assert.equal(await readFile(join(host, 'plugins/amplitude/.env.example'), 'utf8'), 'AMPLITUDE_KEY=synthetic\n')
    assert.match(await readFile(join(host, 'nextspark.config.ts'), 'utf8'), /plugins: \["amplitude"\]/)
    assert.match(result.stdout, /post-migration route-root guard: passed/)
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(support, { recursive: true, force: true })
  }
})

test('migrate rebases nested theme tsconfig and jest roots after moving tests to the project root', async () => {
  const { root } = await moveFixture({ aliases: true })
  try {
    await write(root, 'cypress.d.ts', 'declare namespace Cypress {}\n')
    await write(root, 'tsconfig.cypress.json', '{}\n')
    await write(root, 'contents/themes/acme/tests/tsconfig.json', JSON.stringify({
      extends: '../../../../tsconfig.cypress.json',
      compilerOptions: {
        baseUrl: '../../../..',
        paths: {
          '@/*': ['./*'],
          '@/core/*': ['./core/*'],
          '@/contents/*': ['./contents/*'],
        },
      },
      include: ['../../../../cypress.d.ts', 'cypress/**/*.ts'],
    }, null, 2) + '\n')
    await write(root, 'contents/themes/acme/tests/jest/tsconfig.jest.json', JSON.stringify({
      extends: '../../../../../tsconfig.json',
    }, null, 2) + '\n')
    await write(root, 'contents/themes/acme/tests/jest/jest.config.cjs', "const path = require('path')\nconst projectRoot = path.resolve(__dirname, '../../../../..')\nmodule.exports = {\n  rootDir: projectRoot,\n  moduleNameMapper: {\n    '^@/contents/(.*)$': '<rootDir>/contents/$1',\n    '^@/entities/(.*)$': '<rootDir>/contents/entities/$1',\n    '^@/plugins/(.*)$': '<rootDir>/contents/plugins/$1',\n    '^@/themes/(.*)$': '<rootDir>/contents/themes/$1',\n  },\n}\n")
    await write(root, 'contents/themes/acme/tests/cypress/smoke.cy.ts', 'export {}\n')
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const testConfig = JSON.parse(await readFile(join(root, 'tests/tsconfig.json'), 'utf8'))
    assert.equal(testConfig.extends, '../tsconfig.cypress.json')
    assert.equal(testConfig.compilerOptions.baseUrl, '..')
    assert.deepEqual(testConfig.compilerOptions.paths, {
      '@/*': ['./*'],
      '@/core/*': ['./core/*'],
      '@/contents/*': ['./*'],
    })
    assert.deepEqual(testConfig.include, ['../cypress.d.ts', 'cypress/**/*.ts'])
    const jestTsconfig = JSON.parse(await readFile(join(root, 'tests/jest/tsconfig.jest.json'), 'utf8'))
    assert.equal(jestTsconfig.extends, '../../tsconfig.json')
    const jestConfig = await readFile(join(root, 'tests/jest/jest.config.cjs'), 'utf8')
    assert.match(jestConfig, /path\.resolve\(__dirname, '\.\.\/\.\.'\)/)
    assert.match(jestConfig, /'\^@\/contents\/\(\.\*\)\$': '<rootDir>\/\$1'/)
    assert.match(jestConfig, /'\^@\/entities\/\(\.\*\)\$': '<rootDir>\/entities\/\$1'/)
    assert.match(jestConfig, /'\^@\/plugins\/\(\.\*\)\$': '<rootDir>\/plugins\/\$1'/)
    assert.match(jestConfig, /'\^@\/themes\/acme\/\(\.\*\)\$': '<rootDir>\/\$1'/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate rebases root-inspecting tests and preserves their local middleware binding', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'contents/themes/acme/tests/jest/lib/i18n/root-first-contracts.test.ts', `import { join, resolve } from 'path'
import { middleware } from '@/contents/themes/acme/middleware'

const APP_ROOT = resolve(__dirname, '../../../../../../..')
const THEME_ROOT = resolve(__dirname, '../../../..')
const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME
const proxyPath = join(APP_ROOT, 'proxy.ts')
const authGroup = join(APP_ROOT, 'app', '(auth)')
const graph = ['middleware.ts']
const registryImport = /from '@\\/contents\\/themes\\/acme\\/middleware'/

void [middleware, APP_ROOT, THEME_ROOT, activeTheme, proxyPath, authGroup, graph, registryImport]
`)
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const migrated = await readFile(join(root, 'tests/jest/lib/i18n/root-first-contracts.test.ts'), 'utf8')
    assert.match(migrated, /import \{ proxyHook as middleware \} from '@\/config\/hooks\/proxy'/)
    assert.match(migrated, /const APP_ROOT = resolve\(__dirname, '\.\.\/\.\.\/\.\.\/\.\.'\)/)
    assert.match(migrated, /const THEME_ROOT = resolve\(__dirname, '\.\.\/\.\.\/\.\.\/\.\.'\)/)
    assert.match(migrated, /const activeTheme = "acme"/)
    assert.match(migrated, /join\(APP_ROOT, 'proxy\.ts'\)/)
    assert.match(migrated, /join\(APP_ROOT, 'src', 'app', '\(auth\)'\)/)
    assert.match(migrated, /const graph = \['config\/hooks\/proxy\.ts'\]/)
    assert.match(migrated, /\/from '@\\\/config\\\/hooks\\\/proxy'\//)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate replaces the removed theme middleware predicate with the root-first project predicate', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'proxy.ts', "import { hasThemeMiddleware, executeThemeMiddleware, getThemeAppConfig } from '@nextsparkjs/core/lib/middleware'\nexport async function proxy(request: unknown) {\n  const activeTheme = process.env.NEXT_PUBLIC_ACTIVE_THEME\n  if (activeTheme && hasThemeMiddleware(activeTheme)) {\n    const response = await executeThemeMiddleware(activeTheme, request, null)\n    if (response) return response\n  }\n  return getThemeAppConfig(activeTheme as string)\n}\n")
    await write(root, 'contents/themes/acme/lib/boot.ts', "import { hasThemeMiddleware } from '@nextsparkjs/core/lib/middleware'\nexport function assertHook() {\n  if (!hasThemeMiddleware('acme')) throw new Error('missing hook')\n}\n")
    await write(root, 'contents/themes/acme/tests/jest/boot.test.ts', "jest.mock('@nextsparkjs/core/lib/middleware', () => ({ hasThemeMiddleware: () => true }))\n")
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'proxy.ts'), 'utf8'), "import { hasProjectMiddleware, executeProjectMiddleware, getProjectAppConfig } from '@nextsparkjs/core/lib/middleware'\nexport async function proxy(request: unknown) {\n  const activeTheme = undefined\n  if (hasProjectMiddleware()) {\n    const response = await executeProjectMiddleware(request, null)\n    if (response) return response\n  }\n  return getProjectAppConfig()\n}\n")
    assert.equal(await readFile(join(root, 'lib/boot.ts'), 'utf8'), "import { hasProjectMiddleware } from '@nextsparkjs/core/lib/middleware'\nexport function assertHook() {\n  if (!hasProjectMiddleware()) throw new Error('missing hook')\n}\n")
    assert.equal(await readFile(join(root, 'tests/jest/boot.test.ts'), 'utf8'), "jest.mock('@nextsparkjs/core/lib/middleware', () => ({ hasProjectMiddleware: () => true }))\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate renames known removed core scripts and warns for unknown core script references', async () => {
  const { root } = await moveFixture()
  try {
    const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    pkg.scripts = {
      jest: 'node node_modules/@nextsparkjs/core/scripts/test/jest-theme.mjs',
      old: 'node node_modules/@nextsparkjs/core/scripts/test/no-longer-there.mjs',
    }
    await write(root, 'package.json', `${JSON.stringify(pkg, null, 2)}\n`)
    await commitFixture(root)
    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.deepEqual(report.coreScripts.renamed, ['jest'])
    assert.match(report.coreScripts.warnings.join('\n'), /no-longer-there/)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(JSON.parse(await readFile(join(root, 'package.json'), 'utf8')).scripts.jest, 'node node_modules/@nextsparkjs/core/scripts/test/jest.mjs')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate archives custom legacy app files, removes generated ones, and prepares src/app', async () => {
  const { root } = await moveFixture()
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'app/page.tsx', 'export default function CustomizedPage() { return null }\n')
    await commitFixture(root)
    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.deepEqual(report.generatedHost.customizations, ['page.tsx'])
    assert.equal(report.generatedHost.customizationsDestination, 'legacy-app-customizations')
    assert.equal(report.generatedHost.nextStep, null)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    await assert.rejects(access(join(root, 'app/layout.tsx')))
    assert.equal(await readFile(join(root, 'legacy-app-customizations/page.tsx'), 'utf8'), 'export default function CustomizedPage() { return null }\n')
    assert.equal((await lstat(join(root, 'src/app'))).isDirectory(), true)
    const tsconfig = JSON.parse(await readFile(join(root, 'tsconfig.json'), 'utf8'))
    assert.ok(tsconfig.exclude.includes('legacy-app-customizations'))
    assert.match(result.stdout, /excluded legacy-app-customizations from tsconfig/)
    assert.doesNotMatch(result.stdout, /nextspark sync:app --force/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate stops before touching a legacy app when core lacks guarded sync support', async () => {
  const { root } = await moveFixture()
  try {
    const app = 'export default function Layout() { return null }\n'
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/layout.tsx', app)
    await write(root, 'app/layout.tsx', app)
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.notEqual(result.status, 0)
    assert.match(result.stderr, /missing guarded sync support: scripts\/build\/registry\.mjs/)
    assert.match(result.stderr, /Upgrade @nextsparkjs\/core to the same version as the CLI/)
    assert.match(result.stdout, /Rollback after migration failure/)
    assert.equal(await readFile(join(root, 'app/layout.tsx'), 'utf8'), app)
    await assert.rejects(access(join(root, 'src/app')))
    assert.equal(await readFile(join(root, 'contents/themes/acme/middleware.ts'), 'utf8'), 'export function middleware() { return undefined }\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate runs the guarded sync path before removing the legacy app host', async () => {
  const { root } = await moveFixture()
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await mkdir(join(root, 'app/nested/empty'), { recursive: true })
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /Sync complete/)
    assert.match(result.stdout, /Generated host: removed 1 generated file/)
    await assert.rejects(access(join(root, 'app/layout.tsx')))
    assert.match(await readFile(join(root, 'src/app/layout.tsx'), 'utf8'), /@nextspark-generated/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate removes the emptied legacy app root and records the route-root guard', async () => {
  const { root } = await moveFixture()
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'app/(templates)/generated.tsx', '/* Generated by: scripts/build-registry.mjs */\nexport default null\n')
    await mkdir(join(root, 'app/nested/empty'), { recursive: true })
    await write(root, '.gitignore', 'contents/themes/acme/tests/output\napp/(templates)/\n')
    await commitFixture(root)

    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.deepEqual(report.routeRootGuard, { currentRoots: ['app'], checkedAfterMigration: true })
    assert.deepEqual(report.appTemplates.generatedByLegacyRegistry, ['(templates)/generated.tsx'])
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    await assert.rejects(access(join(root, 'app')))
    assert.match(result.stdout, /post-migration route-root guard: passed/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate fails the post-migration route-root guard and its rollback restores app', async () => {
  const { root } = await moveFixture()
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'pages/legacy.tsx', 'export default function Legacy() { return null }\n')
    await commitFixture(root)

    const failed = run(root, ['--yes'])
    assert.notEqual(failed.status, 0)
    assert.match(failed.stderr, /Post-migration route-root check failed: pages remains next to src\/app/)
    const commands = [...new Set(failed.stdout.split('\n').map(line => line.trim()).filter(line => line.startsWith('git -C ')))]
    assert.equal(commands.length, 2, failed.stdout)
    execFileSync('/bin/sh', ['-c', commands.join('\n')], { cwd: root, stdio: 'ignore' })
    assert.equal(await readFile(join(root, 'app/layout.tsx'), 'utf8'), 'export default function Layout() { return null }\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate stops loudly and preserves app when guarded sync fails', async () => {
  const { root } = await moveFixture()
  try {
    await installSyncableCore(root, "console.error('registry generation failed')\nprocess.exit(1)\n")
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.notEqual(result.status, 0)
    assert.doesNotMatch(result.stdout, /Migration complete/)
    assert.match(result.stderr, /MIGRATION FAILED: sync:app did not generate the new src\/app host/)
    assert.match(result.stdout, /Rollback after migration failure/)
    assert.equal(await readFile(join(root, 'app/layout.tsx'), 'utf8'), 'export default function Layout() { return null }\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate late failure rollback restores all newly-created migration paths to git HEAD', async () => {
  const { root } = await moveFixture({ brokenImport: true })
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await rm(join(root, 'nextspark.config.ts'))
    await rm(join(root, '.env.example'))
    await write(root, 'contents/themes/acme/.env.example', 'THEME_VALUE=yes\n')
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'app/page.tsx', 'export default function Custom() { return null }\n')
    await commitFixture(root)

    const failed = run(root, ['--yes'], { NEXT_PUBLIC_ACTIVE_THEME: 'acme' })
    assert.notEqual(failed.status, 0)
    assert.match(failed.stdout, /MIGRATION FAILED: migration introduced broken imports/)
    const commands = [...new Set(failed.stdout.split('\n').map(line => line.trim()).filter(line => line.startsWith('git -C ')))]
    assert.equal(commands.length, 2, failed.stdout)
    execFileSync('/bin/sh', ['-c', commands.join('\n')], { cwd: root, stdio: 'ignore' })
    assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
    assert.equal(execFileSync('git', ['diff', '--exit-code', 'HEAD'], { cwd: root, encoding: 'utf8' }), '')
    await assert.rejects(access(join(root, 'nextspark.config.ts')))
    assert.equal(await readFile(join(root, 'contents/themes/acme/.env.example'), 'utf8'), 'THEME_VALUE=yes\n')
    await assert.rejects(access(join(root, 'legacy-app-customizations')))
    assert.match(await readFile(join(root, 'app/page.tsx'), 'utf8'), /Custom/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

for (const trackedKeep of [false, true]) {
  test(`migrate late failure rollback preserves pre-existing ${trackedKeep ? 'tracked' : 'untracked'} generated-host files`, async () => {
    const { root } = await moveFixture({ brokenImport: true })
    try {
      await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
      await write(root, '.gitignore', 'src/app/keep.ts\n.nextspark/something\n')
      await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
      await write(root, 'app/page.tsx', 'export default function Custom() { return null }\n')
      await write(root, 'src/app/keep.ts', 'export const userOwned = true\n')
      await write(root, '.nextspark/something', 'user-owned state\n')
      if (trackedKeep) await commitFixture(root)
      else {
        await rm(join(root, 'src/app/keep.ts'))
        await rm(join(root, '.nextspark/something'))
        await commitFixture(root)
        await write(root, 'src/app/keep.ts', 'export const userOwned = true\n')
        await write(root, '.nextspark/something', 'user-owned state\n')
      }

      const failed = run(root, ['--yes'], { NEXT_PUBLIC_ACTIVE_THEME: 'acme' })
      assert.notEqual(failed.status, 0)
      assert.match(failed.stdout, /MIGRATION FAILED: migration introduced broken imports/)
      const commands = [...new Set(failed.stdout.split('\n').map(line => line.trim()).filter(line => line.startsWith('git -C ')))]
      assert.equal(commands.length, 2, failed.stdout)
      execFileSync('/bin/sh', ['-c', commands.join('\n')], { cwd: root, stdio: 'ignore' })

      assert.equal(await readFile(join(root, 'src/app/keep.ts'), 'utf8'), 'export const userOwned = true\n')
      assert.equal(await readFile(join(root, '.nextspark/something'), 'utf8'), 'user-owned state\n')
      await assert.rejects(access(join(root, 'src/app/layout.tsx')))
      await assert.rejects(access(join(root, 'src/app/page.tsx')))
      await assert.rejects(access(join(root, '.nextspark/sync-state.json')))
      assert.equal(execFileSync('git', ['diff', '--exit-code', 'HEAD'], { cwd: root, encoding: 'utf8' }), '')
      assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
}

test('migrate late-failure rollback restores ignored sync state and in-place config edits byte-for-byte', async () => {
  const { root } = await moveFixture({ brokenImport: true })
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await write(root, 'app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, 'app/page.tsx', 'export default function Custom() { return null }\n')
    await rm(join(root, '.gitignore'))
    await rm(join(root, 'tsconfig.json'))
    await commitFixture(root)
    await write(root, '.git/info/exclude', '.gitignore\ntsconfig.json\n.nextspark/sync-state.json\n')

    const originalGitignore = '# ignored user rules\n'
    const originalTsconfig = '{\n  "exclude": [\n    "pre-existing"\n  ]\n}\n'
    const originalState = Buffer.from('{"machine":"before-migrate"}\n')
    await write(root, '.gitignore', originalGitignore)
    await write(root, 'tsconfig.json', originalTsconfig)
    await mkdir(join(root, '.nextspark'), { recursive: true })
    await writeFile(join(root, '.nextspark/sync-state.json'), originalState)

    const failed = run(root, ['--yes'], { NEXT_PUBLIC_ACTIVE_THEME: 'acme' })
    assert.notEqual(failed.status, 0)
    assert.match(failed.stdout, /MIGRATION FAILED: migration introduced broken imports/)
    const commands = [...new Set(failed.stdout.split('\n').map(line => line.trim()).filter(line => line.startsWith('git -C ')))]
    assert.equal(commands.length, 2, failed.stdout)
    execFileSync('/bin/sh', ['-c', commands.join('\n')], { cwd: root, stdio: 'ignore' })

    assert.equal(await readFile(join(root, '.gitignore'), 'utf8'), originalGitignore)
    assert.equal(await readFile(join(root, 'tsconfig.json'), 'utf8'), originalTsconfig)
    assert.deepEqual(await readFile(join(root, '.nextspark/sync-state.json')), originalState)
    await assert.rejects(access(join(root, '.nextspark/migrate-rollback')))
    assert.equal(execFileSync('git', ['diff', '--exit-code', 'HEAD'], { cwd: root, encoding: 'utf8' }), '')
    assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate preserves JSONC exclude comments containing brackets while archiving legacy app customizations', async () => {
  const { root } = await moveFixture()
  try {
    await installSyncableCore(root, "console.log('src/app/(templates) generated')\n")
    await write(root, 'app/custom.tsx', 'export default function Custom() { return null }\n')
    await write(root, 'tsconfig.json', '{\n  "exclude": [\n    // ] remains part of this comment\n    "old-output]",\n  ],\n}\n')
    await commitFixture(root)

    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const tsconfig = await readFile(join(root, 'tsconfig.json'), 'utf8')
    assert.match(tsconfig, /\/\/ \] remains part of this comment/)
    assert.match(tsconfig, /"old-output\]",/)
    assert.match(tsconfig, /"old-output\]",\n    "legacy-app-customizations"\n  \],/)
    const parsed = JSON.parse(tsconfig.replace(/\/\/.*$/gm, '').replace(/,\s*([}\]])/g, '$1'))
    assert.deepEqual(parsed.exclude, ['old-output]', 'legacy-app-customizations'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate moves a theme env example and plugin examples without reading their values', async () => {
  const { root } = await moveFixture()
  try {
    await rm(join(root, '.env.example'))
    await write(root, 'contents/themes/acme/.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\nPUBLIC_VALUE=yes\n')
    await write(root, 'contents/plugins/local/.env.example', 'PLUGIN_VALUE=yes\n')
    await commitFixture(root)
    const result = run(root, ['--yes'], { NEXT_PUBLIC_ACTIVE_THEME: 'acme' })
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, '.env.example'), 'utf8'), 'PUBLIC_VALUE=yes\n')
    assert.equal(await readFile(join(root, 'plugins/local/.env.example'), 'utf8'), 'PLUGIN_VALUE=yes\n')
    await assert.rejects(access(join(root, 'contents')))
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate names every entry that prevents contents from being removed', async () => {
  const { root } = await moveFixture()
  try {
    await symlink('../README.md', join(root, 'contents/leftover-link'))
    await commitFixture(root)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal((await lstat(join(root, 'contents/leftover-link'))).isSymbolicLink(), true)
    assert.match(result.stdout, /contents\/: contents\/leftover-link \(not moved because its destination conflicts or is reserved\)/)
    assert.doesNotMatch(result.stdout, /contents\/: removed/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate reports rather than merges a differing theme env example', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, '.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\nROOT_VALUE=yes\n')
    await write(root, 'contents/themes/acme/.env.example', 'NEXT_PUBLIC_ACTIVE_THEME=acme\nTHEME_VALUE=yes\n')
    await commitFixture(root)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /differs from the root \.env\.example and will not be merged/)
    assert.equal(await readFile(join(root, '.env.example'), 'utf8'), 'ROOT_VALUE=yes\n')
    assert.equal(await readFile(join(root, 'contents/themes/acme/.env.example'), 'utf8'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\nTHEME_VALUE=yes\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate alias rewrites omit TypeScript extensions and trailing index', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@ds': ['contents/themes/acme/components/DS/index.ts'] } } }))
    await write(root, 'contents/themes/acme/components/DS/index.ts', 'export const DS = true\n')
    await write(root, 'contents/themes/acme/tests/ds.ts', "import { DS } from '@ds'\nexport { DS }\n")
    await commitFixture(root)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'tests/ds.ts'), 'utf8'), "import { DS } from '@/components/DS'\nexport { DS }\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate keeps an alias trailing index when a sibling module would change resolution', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@ds': ['contents/themes/acme/components/DS/index.ts'] } } }))
    await write(root, 'contents/themes/acme/components/DS/index.ts', 'export const DS = true\n')
    await write(root, 'contents/themes/acme/components/DS.ts', 'export const DS = false\n')
    await write(root, 'contents/themes/acme/tests/ds.ts', "import { DS } from '@ds'\nexport { DS }\n")
    await commitFixture(root)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'tests/ds.ts'), 'utf8'), "import { DS } from '@/components/DS/index'\nexport { DS }\n")
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate warns when legacy theme config plugins are not literal strings', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'contents/themes/acme/nextspark.config.ts', "export default { plugins: getThemePlugins() }\n")
    await commitFixture(root)
    const result = run(root, ['--dry-run', '--json'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    const report = JSON.parse(result.stdout)
    assert.ok(report.warnings.some((warning: string) => /nextspark\.config\.ts plugins may be incomplete/.test(warning)), result.stdout)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate does not fetch an old core when every legacy app file is already classified', async () => {
  const { root } = await moveFixture()
  const support = await mkdtemp(join(tmpdir(), 'nextspark-migrate-no-fetch-'))
  try {
    const oldTemplate = '# old core docs\n'
    await write(root, 'app/api/docs.md', oldTemplate)
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/api/docs.md', '# current core docs\n')
    const hash = createHash('sha256').update(oldTemplate).digest('hex')
    await write(root, '.nextspark/sync-state.json', JSON.stringify({ coreVersion: '0.1.0-beta.190', files: { 'app/api/docs.md': { core: 'different-template-hash', written: hash } } }))
    await commitFixture(root)

    const bin = join(support, 'bin')
    const calls = join(support, 'pnpm-calls')
    await write(bin, 'pnpm', '#!/bin/sh\nprintf invoked > "$PNPM_CALL_LOG"\nexit 1\n')
    await chmod(join(bin, 'pnpm'), 0o755)
    const dryRun = run(root, ['--dry-run', '--json'], { PATH: `${bin}:${process.env.PATH}`, PNPM_CALL_LOG: calls })
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.deepEqual(report.appTemplates.generatedBySyncState, ['api/docs.md'])
    assert.deepEqual(report.generatedHost.customizations, [])
    await assert.rejects(access(calls))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(support, { recursive: true, force: true })
  }
})

test('migrate keeps taggable files when their tag was removed or names src/app instead', async () => {
  const { root } = await moveFixture()
  try {
    const page = 'export default function Page() { return <main>project owns this</main> }\n'
    const layoutBody = 'export default function Layout() { return <main>copied</main> }\n'
    const layoutHash = createHash('sha256').update(layoutBody).digest('hex')
    await write(root, 'app/page.tsx', page)
    await write(root, 'app/layout.tsx', `// @nextspark-generated core@0.1.0-beta.190 path=src/app/layout.tsx sha256=${layoutHash}\n${layoutBody}`)
    await write(root, 'node_modules/@nextsparkjs/core/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.190' }))
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/page.tsx', 'export default function Page() { return null }\n')
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/layout.tsx', 'export default function Layout() { return null }\n')
    await write(root, '.nextspark/sync-state.json', JSON.stringify({
      coreVersion: '0.1.0-beta.190',
      files: { 'app/page.tsx': { core: createHash('sha256').update(page).digest('hex') } },
    }))
    await commitFixture(root)

    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    assert.deepEqual(JSON.parse(dryRun.stdout).generatedHost.customizations, ['layout.tsx', 'page.tsx'])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate treats a CRLF-only difference from the current app template as generated', async () => {
  const { root } = await moveFixture()
  try {
    const template = 'export default function Layout() { return null }\n'
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/layout.tsx', template)
    await write(root, 'app/layout.tsx', template.replace(/\n/g, '\r\n'))
    await commitFixture(root)

    const dryRun = run(root, ['--dry-run', '--json'])
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.deepEqual(report.appTemplates.identical, ['layout.tsx'])
    assert.deepEqual(report.generatedHost.customizations, [])
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate byte-matches an unmodified beta.183 app file from the version in git history', async () => {
  const { root } = await moveFixture()
  const support = await mkdtemp(join(tmpdir(), 'nextspark-migrate-old-core-'))
  try {
    const oldTemplate = 'export default function Page() { return <main>beta.183</main> }\r\n'
    const currentTemplate = 'export default function Page() { return <main>beta.192</main> }\n'
    const oldPprLayout = 'export default function Layout() { return <main>beta.183 PPR</main> }\n'
    const oldGlobals = '@import "../../../themes/default/styles/globals.css";\n'
    const migratedGlobals = '@import "../contents/themes/acme/styles/globals.css";\n'
    const packageFile = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    packageFile.dependencies['@nextsparkjs/core'] = '0.1.0-beta.183'
    await write(root, 'package.json', `${JSON.stringify(packageFile, null, 2)}\n`)
    await write(root, 'app/page.tsx', oldTemplate)
    await write(root, 'app/layout.tsx', oldPprLayout)
    await write(root, 'app/globals.css', migratedGlobals)
    await commitFixture(root)

    packageFile.dependencies['@nextsparkjs/core'] = '0.1.0-beta.192'
    await write(root, 'package.json', `${JSON.stringify(packageFile, null, 2)}\n`)
    await write(root, 'next.config.mjs', 'export default { cacheComponents: true }\n')
    await write(root, 'node_modules/@nextsparkjs/core/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.192' }))
    await write(root, 'node_modules/next/package.json', JSON.stringify({ name: 'next', version: '16.2.0' }))
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/page.tsx', currentTemplate)
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/layout.tsx', 'export default function Layout() { return <main>beta.192</main> }\n')
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/globals.css', '@import "../styles/globals.css";\n')
    await commitFixture(root)

    await write(support, 'package/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.183' }))
    await write(support, 'package/templates/app/page.tsx', oldTemplate.replace(/\r\n/g, '\n'))
    await write(support, 'package/templates/app/layout.tsx', 'export default function Layout() { return <main>beta.183</main> }\n')
    await write(support, 'package/templates/app/layout.ppr.tsx', oldPprLayout)
    await write(support, 'package/templates/app/globals.css', oldGlobals)
    const archive = join(support, 'nextsparkjs-core-0.1.0-beta.183.tgz')
    await tar.c({ cwd: support, file: archive, gzip: true }, ['package'])
    const bin = join(support, 'bin')
    await write(bin, 'pnpm', `#!/usr/bin/env node\nconst { copyFileSync } = require('node:fs')\nconst { join } = require('node:path')\nconst destination = process.argv[process.argv.indexOf('--pack-destination') + 1]\ncopyFileSync(process.env.FAKE_CORE_TARBALL, join(destination, 'nextsparkjs-core-0.1.0-beta.183.tgz'))\n`)
    await chmod(join(bin, 'pnpm'), 0o755)

    const dryRun = run(root, ['--dry-run', '--json'], { PATH: `${bin}:${process.env.PATH}`, FAKE_CORE_TARBALL: archive })
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.equal(report.appTemplates.previousTemplateVersion, '0.1.0-beta.183')
    assert.match(report.appTemplates.previousTemplateVersionSource, /^git [0-9a-f]{8}:package\.json$/)
    assert.equal(report.appTemplates.previousTemplateMethod, 'pnpm pack')
    assert.deepEqual(report.appTemplates.generatedByPreviousTemplate, ['globals.css', 'layout.tsx', 'page.tsx'])
    assert.deepEqual(report.generatedHost.customizations, [])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(support, { recursive: true, force: true })
  }
})

test('migrate keeps unmatched files as customizations and reports when the previous core cannot be fetched', async () => {
  const { root } = await moveFixture()
  const support = await mkdtemp(join(tmpdir(), 'nextspark-migrate-no-network-'))
  try {
    const packageFile = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    packageFile.dependencies['@nextsparkjs/core'] = '0.1.0-beta.183'
    await write(root, 'package.json', `${JSON.stringify(packageFile, null, 2)}\n`)
    await write(root, 'app/page.tsx', 'export default function Page() { return <main>old core</main> }\n')
    await commitFixture(root)
    packageFile.dependencies['@nextsparkjs/core'] = '0.1.0-beta.192'
    await write(root, 'package.json', `${JSON.stringify(packageFile, null, 2)}\n`)
    await write(root, 'node_modules/@nextsparkjs/core/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.192' }))
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/page.tsx', 'export default function Page() { return null }\n')
    await commitFixture(root)

    const bin = join(support, 'bin')
    await write(bin, 'pnpm', '#!/bin/sh\nexit 1\n')
    await chmod(join(bin, 'pnpm'), 0o755)
    const dryRun = run(root, ['--dry-run', '--json'], { PATH: `${bin}:${process.env.PATH}` })
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.equal(report.appTemplates.previousTemplateUnavailableReason, 'pnpm could not retrieve or unpack the package')
    assert.deepEqual(report.generatedHost.customizations, ['page.tsx'])
    assert.ok(report.warnings.some((warning: string) => /Could not fetch @nextsparkjs\/core@0\.1\.0-beta\.183/.test(warning)))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(support, { recursive: true, force: true })
  }
})

test('migrate falls back conservatively when fetching the previous core times out', async () => {
  const { root } = await moveFixture()
  const support = await mkdtemp(join(tmpdir(), 'nextspark-migrate-timeout-'))
  try {
    const packageFile = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
    packageFile.dependencies['@nextsparkjs/core'] = '0.1.0-beta.183'
    await write(root, 'package.json', `${JSON.stringify(packageFile, null, 2)}\n`)
    await write(root, 'app/page.tsx', 'export default function Page() { return <main>old core</main> }\n')
    await commitFixture(root)
    packageFile.dependencies['@nextsparkjs/core'] = '0.1.0-beta.192'
    await write(root, 'package.json', `${JSON.stringify(packageFile, null, 2)}\n`)
    await write(root, 'node_modules/@nextsparkjs/core/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.192' }))
    await write(root, 'node_modules/@nextsparkjs/core/templates/app/page.tsx', 'export default function Page() { return null }\n')
    await commitFixture(root)

    const bin = join(support, 'bin')
    await write(bin, 'pnpm', '#!/bin/sh\nwhile :; do :; done\n')
    await chmod(join(bin, 'pnpm'), 0o755)
    const dryRun = run(root, ['--dry-run', '--json'], {
      PATH: `${bin}:${process.env.PATH}`,
      NEXTSPARK_MIGRATE_NETWORK_TIMEOUT_MS: '100',
    })
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.match(report.appTemplates.previousTemplateUnavailableReason, /timed out after 100ms while running pnpm pack/)
    assert.deepEqual(report.generatedHost.customizations, ['page.tsx'])
    assert.ok(report.warnings.some((warning: string) => /timed out after 100ms while running pnpm pack/.test(warning)))
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(support, { recursive: true, force: true })
  }
})

test('migrate finds the previous core in the repository lockfile host importer', async () => {
  const { root, host } = await moveFixture({ monorepo: true })
  const support = await mkdtemp(join(tmpdir(), 'nextspark-migrate-lock-core-'))
  try {
    const oldTemplate = 'export default function Page() { return <main>locked old core</main> }\n'
    const hostPackage = JSON.parse(await readFile(join(host, 'package.json'), 'utf8'))
    hostPackage.dependencies['@nextsparkjs/core'] = '^0.1.0-beta.180'
    await write(root, 'web/package.json', `${JSON.stringify(hostPackage, null, 2)}\n`)
    await write(root, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  web:\n    dependencies:\n      '@nextsparkjs/core':\n        specifier: ^0.1.0-beta.180\n        version: 0.1.0-beta.183\n")
    await write(root, 'web/app/page.tsx', oldTemplate)
    await commitFixture(root)

    hostPackage.dependencies['@nextsparkjs/core'] = 'file:/tmp/nextsparkjs-core-0.1.0-beta.192.tgz'
    await write(root, 'web/package.json', `${JSON.stringify(hostPackage, null, 2)}\n`)
    await write(root, 'pnpm-lock.yaml', "lockfileVersion: '9.0'\nimporters:\n  web:\n    dependencies:\n      '@nextsparkjs/core':\n        specifier: file:/tmp/nextsparkjs-core-0.1.0-beta.192.tgz\n        version: file:../../tmp/nextsparkjs-core-0.1.0-beta.192.tgz(react@19.2.7)\n")
    await write(root, 'web/node_modules/@nextsparkjs/core/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.192' }))
    await write(root, 'web/node_modules/@nextsparkjs/core/templates/app/page.tsx', 'export default function Page() { return null }\n')
    await commitFixture(root)

    await write(support, 'package/package.json', JSON.stringify({ name: '@nextsparkjs/core', version: '0.1.0-beta.183' }))
    await write(support, 'package/templates/app/page.tsx', oldTemplate)
    const archive = join(support, 'core.tgz')
    await tar.c({ cwd: support, file: archive, gzip: true }, ['package'])
    const bin = join(support, 'bin')
    await write(bin, 'pnpm', `#!/usr/bin/env node\nconst { copyFileSync } = require('node:fs')\nconst { join } = require('node:path')\nconst destination = process.argv[process.argv.indexOf('--pack-destination') + 1]\ncopyFileSync(process.env.FAKE_CORE_TARBALL, join(destination, 'core.tgz'))\n`)
    await chmod(join(bin, 'pnpm'), 0o755)

    const dryRun = run(host, ['--dry-run', '--json'], { PATH: `${bin}:${process.env.PATH}`, FAKE_CORE_TARBALL: archive })
    assert.equal(dryRun.status, 0, `${dryRun.stdout}\n${dryRun.stderr}`)
    const report = JSON.parse(dryRun.stdout)
    assert.equal(report.appTemplates.previousTemplateVersion, '0.1.0-beta.183')
    assert.match(report.appTemplates.previousTemplateVersionSource, /^git [0-9a-f]{8}:pnpm-lock\.yaml$/)
    assert.deepEqual(report.appTemplates.generatedByPreviousTemplate, ['page.tsx'])
  } finally {
    await rm(root, { recursive: true, force: true })
    await rm(support, { recursive: true, force: true })
  }
})

test('migrate accepts aliases that resolve to generated registries during broken-import checks', async () => {
  const { root } = await moveFixture()
  try {
    await write(root, 'tsconfig.json', JSON.stringify({ compilerOptions: { paths: { '@nextsparkjs/registries/*': ['.nextspark/registries/*'] } } }))
    await write(root, 'contents/themes/acme/components/registry.ts', "import registry from '@nextsparkjs/registries/generated'\nexport default registry\n")
    await commitFixture(root)
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.doesNotMatch(result.stdout, /broken imports/)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
