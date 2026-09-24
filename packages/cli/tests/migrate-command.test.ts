import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { before, test } from 'node:test'
import { access, lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import { buildCli } from './built-cli.js'

let cliEntry: string
before(() => { cliEntry = buildCli() })

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

function run(root: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [cliEntry, 'migrate', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
    env: { ...process.env, ...env },
  })
}

function runWithoutActiveTheme(root: string, args: string[]) {
  const env = { ...process.env }
  delete env.NEXT_PUBLIC_ACTIVE_THEME
  return spawnSync(process.execPath, [cliEntry, 'migrate', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 15_000,
    env,
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
  unknown = false,
  collision = false,
  middleware = 'export function middleware() { return undefined }\n',
  duplicateImport = false,
  unknownReference = false,
}: {
  monorepo?: boolean
  unknown?: boolean
  collision?: boolean
  middleware?: string
  duplicateImport?: boolean
  unknownReference?: boolean
} = {}): Promise<{ root: string, host: string }> {
  const root = await mkdtemp(join(tmpdir(), 'nextspark-migrate-move-'))
  await startRepository(root)
  const host = monorepo ? 'web' : '.'
  const atHost = (file: string) => host === '.' ? file : join(host, file)
  await write(root, atHost('package.json'), JSON.stringify({ name: 'fixture', packageManager: 'pnpm@9.0.0', dependencies: { next: '^16.0.0' }, scripts: { check: 'node scripts/check.mjs contents/themes/acme' } }, null, 2))
  await write(root, atHost('next.config.mjs'), 'export default {}\n')
  await write(root, atHost('nextspark.config.ts'), "export default { theme: 'acme', plugins: ['local'] }\n")
  await write(root, atHost('.env.example'), 'NEXT_PUBLIC_ACTIVE_THEME=acme\n')
  await write(root, atHost('tsconfig.json'), '{"include":["contents/themes/acme/**/*.ts"],"compilerOptions":{"paths":{"@/*":["contents/themes/acme/*"]}}}\n')
  await write(root, atHost('tsconfig.cypress.json'), '{"include":["contents/themes/acme/tests/cypress/**/*.ts"]}\n')
  await write(root, atHost('pnpm-workspace.yaml'), "packages:\n  - 'contents/themes/*'\n  - 'contents/plugins/*'\n")
  await write(root, atHost('.gitignore'), 'contents/themes/acme/tests/output\n')
  await write(root, atHost('scripts/check.mjs'), "const theme = '../../../contents/themes/acme'\n")
  const buttonSource = duplicateImport
    ? "import { Icon } from './Icon'\nexport const Button = Icon\n"
    : unknownReference
      ? "import notes from '../docs/notes'\nexport const loadNotes = () => import(`../docs/notes`)\nexport const Button = notes\n"
      : 'export const Button = true\n'
  await write(root, atHost('contents/themes/acme/components/Button.ts'), buttonSource)
  await write(root, atHost('contents/themes/acme/templates/page.tsx'), "import { Button } from '../components/Button'\nexport default Button\n")
  await write(root, atHost('contents/themes/acme/styles/globals.css'), '@import "../components/Button.css";\n')
  await write(root, atHost('contents/themes/acme/components/Button.css'), '.button {}\n')
  await write(root, atHost('contents/themes/acme/tests/jest.config.cjs'), "module.exports = { rootDir: '../../../../' }\n")
  await write(root, atHost('contents/themes/acme/middleware.ts'), middleware)
  await write(root, atHost('contents/themes/acme/lib/use-hook.ts'), "import { middleware } from '../middleware'\nexport { middleware }\n")
  await write(root, atHost('contents/plugins/local/index.ts'), "export { default as Plugin } from '@/contents/plugins/local/Plugin'\n")
  await write(root, atHost('contents/plugins/local/Plugin.ts'), 'export default true\n')
  if (unknown) await write(root, atHost('contents/themes/acme/keep-me.txt'), 'user-owned unknown\n')
  if (duplicateImport) {
    await write(root, atHost('contents/themes/acme/components/Icon.ts'), 'export const Icon = true\n')
    await write(root, atHost('components/Icon.ts'), 'export const Icon = true\n')
  }
  if (unknownReference) {
    await write(root, atHost('contents/themes/acme/docs/notes.ts'), 'export default "notes"\n')
    await write(root, atHost('scripts/read-notes.mjs'), "const notes = '@/contents/themes/acme/docs/notes.ts'\n")
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
    assert.doesNotMatch(await readFile(join(root, 'nextspark.config.ts'), 'utf8'), /theme:/)
    assert.match(await readFile(join(root, 'tests/jest.config.cjs'), 'utf8'), /rootDir: '\.\.'/)
    assert.equal((await lstat(join(root, 'contents/themes'))).isDirectory(), true)
    assert.equal((await lstat(join(root, 'contents/plugins'))).isDirectory(), true)
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

test('migrate preserves references to unknown files and fixes moved files imports back to them', async () => {
  const { root } = await moveFixture({ unknownReference: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.equal(await readFile(join(root, 'scripts/read-notes.mjs'), 'utf8'), "const notes = '@/contents/themes/acme/docs/notes.ts'\n")
    const button = await readFile(join(root, 'components/Button.ts'), 'utf8')
    assert.match(button, /from '\.\.\/contents\/themes\/acme\/docs\/notes'/)
    assert.match(button, /import\(`\.\.\/contents\/themes\/acme\/docs\/notes`\)/)
    assert.equal(await readFile(join(root, 'contents/themes/acme/docs/notes.ts'), 'utf8'), 'export default "notes"\n')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})

test('migrate preserves unknown files and verifies byte-identical collisions without deleting host source', async () => {
  const { root } = await moveFixture({ unknown: true, collision: true })
  try {
    const result = run(root, ['--yes'])
    assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
    assert.match(result.stdout, /keep-me\.txt/)
    assert.equal(await readFile(join(root, 'contents/themes/acme/keep-me.txt'), 'utf8'), 'user-owned unknown\n')
    assert.equal(await readFile(join(root, 'public/same.txt'), 'utf8'), 'same\n')
    await assert.rejects(readFile(join(root, 'contents/themes/acme/public/same.txt'), 'utf8'))
    assert.equal(await readFile(join(root, 'README.md'), 'utf8'), 'host README\n')
    assert.equal(await readFile(join(root, 'contents/themes/acme/README.md'), 'utf8'), 'theme README\n')
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
    execFileSync('/bin/sh', ['-c', rollbackCommands.join('\n')], { cwd: join(root, 'contents/themes/acme'), stdio: 'ignore' })
    assert.equal(await readFile(join(root, 'contents/themes/acme/components/Button.ts'), 'utf8'), 'export const Button = true\n')
    await assert.rejects(access(join(root, 'components/Button.ts')))
    assert.equal(execFileSync('git', ['status', '--short'], { cwd: root, encoding: 'utf8' }), '')
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
