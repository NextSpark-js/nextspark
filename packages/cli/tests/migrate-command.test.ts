import assert from 'node:assert/strict'
import { execFileSync, spawnSync } from 'node:child_process'
import { before, test } from 'node:test'
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises'
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
  await write(root, 'web/next.config.cjs', "module.exports = { webpack(config) { config.resolve.alias['@/app/(templates)/layout.tsx'] = '@/contents/themes/acme/templates/layout.tsx'; return config } }\n")
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
  const root = await generatedRewriteFixture("export default { turbopack: { resolveAlias: { '@/app/(templates)/layout.tsx': '@/contents/themes/acme/templates/layout.tsx' } } }\n")
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
    assert.match(result.stderr, /only report mode exists yet/i)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
})
