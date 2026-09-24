import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const SOURCE_ROOT = process.env.DOCS_CONTRACT_ROOT
  ? path.resolve(process.env.DOCS_CONTRACT_ROOT)
  : REPO_ROOT

const DOCS_DIRS = [
  'packages/core/docs',
  'apps/dev/docs',
  'plugins/ai/docs',
  'apps/dev/plugins/langchain/docs',
]

const README_FILES = [
  'README.md',
  'apps/mobile/README.md',
]

const CLAUDE_COMMANDS_DIR = '.claude/commands'

function packageAndPluginReadmes(): string[] {
  return ['packages', 'plugins'].flatMap(dir => {
    const root = path.join(SOURCE_ROOT, dir)
    if (!fs.existsSync(root)) return []
    return fs.readdirSync(root, { withFileTypes: true })
      .filter(entry => entry.isDirectory())
      .map(entry => path.join(dir, entry.name, 'README.md'))
      .filter(file => fs.existsSync(path.join(SOURCE_ROOT, file)))
  })
}

const REMOVED_PNPM_SCRIPTS = [
  'build:app',
  'build:theme',
  'check-dynamic-imports',
  'check:dynamic-imports',
  'cypress:open',
  'cypress:run',
  'db:verify',
  'dev:my-theme',
  'dev:watch',
  'lint:fix',
  'registry:build',
  'test:e2e',
  'test:integration',
  'test:unit',
  'theme:build',
  'theme:build-watch',
  'type-check',
] as const

function markdownFiles(relDir: string): string[] {
  const dir = path.join(SOURCE_ROOT, relDir)
  if (!fs.existsSync(dir)) return []

  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const entryPath = path.join(relDir, entry.name)
    if (entry.isDirectory()) return markdownFiles(entryPath)
    return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
  })
}

function documentationFiles(): string[] {
  return [...new Set([
    ...DOCS_DIRS.flatMap(markdownFiles),
    ...markdownFiles(CLAUDE_COMMANDS_DIR),
    ...README_FILES.filter(file => fs.existsSync(path.join(SOURCE_ROOT, file))),
    ...packageAndPluginReadmes(),
  ])]
}

function assertDoesNotNameRetiredCreateApp(file: string, content: string): void {
  assert.doesNotMatch(
    content,
    /@nextsparkjs\/create-app/,
    `${file} names the retired @nextsparkjs/create-app package instead of create-nextspark-app`
  )
}

test('documentation names the published create-nextspark-app initializer', () => {
  for (const file of documentationFiles()) {
    assertDoesNotNameRetiredCreateApp(
      file,
      fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
    )
  }
})

test('published initializer check rejects the retired package name', () => {
  assert.throws(
    () => assertDoesNotNameRetiredCreateApp('README.md', 'npx @nextsparkjs/create-app my-saas'),
    /retired @nextsparkjs\/create-app package/
  )
})

test('documentation does not recommend removed pnpm scripts', () => {
  for (const docsDir of DOCS_DIRS) {
    for (const file of markdownFiles(docsDir)) {
      const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
      for (const script of REMOVED_PNPM_SCRIPTS) {
        const escaped = script.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const staleCommand = content.match(new RegExp(`pnpm\\s+${escaped}(?=\\s|[\`'"),.;:]|$)`))
        assert.equal(
          staleCommand,
          null,
          `${file} recommends removed script \`pnpm ${script}\``
        )
      }
      assert.doesNotMatch(content, /npm install -g pnpm(?:@\S+)?/, `${file} installs pnpm through npm instead of Corepack`)
      assert.doesNotMatch(content, /pnpm --filter @nextsparkjs\/dev (?:dev|start)/, `${file} uses an app script whose undeclared dotenv CLI is unavailable when invoked directly`)
      assert.doesNotMatch(content, /--testPathPatterns(?:=|\s)/, `${file} uses an unsupported Jest option name`)
      assert.doesNotMatch(content, /node node_modules\/@nextspark(?:js)?\/core\/scripts\/build\/theme\.mjs/, `${file} invokes the packaged theme helper with an invalid project-root calculation`)
    }
  }
})

test('monorepo guides do not invoke absent root test or start scripts', () => {
  for (const file of [
    'packages/core/docs/01-fundamentals/06-development-workflow.md',
    'packages/core/docs/02-getting-started/02-setup.md',
    'packages/core/docs/08-plugin-system/08-testing-plugins.md',
    'packages/core/docs/08-plugin-system/09-creating-custom-plugins.md',
    'packages/core/docs/12-testing/01-testing-overview.md',
    'packages/core/docs/12-testing/02-unit-testing-jest.md',
    'packages/core/docs/12-testing/10-ci-workflows.md',
    'packages/core/docs/14-permissions/05-migration-guide.md',
    'packages/core/docs/16-claude-workflow/03-agents.md',
    'packages/core/docs/16-claude-workflow/04-workflow-phases.md',
    'packages/core/docs/16-claude-workflow/07-quality-gates.md',
  ]) {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
    assert.doesNotMatch(content, /pnpm\s+test(?=\s|[`'"),.;]|$)/, `${file} invokes the absent root test script`)
    assert.doesNotMatch(content, /pnpm\s+start(?=\s|[`'"),.;]|$)/, `${file} invokes the absent root start script`)
    assert.doesNotMatch(content, /(?:^|`)\s*(?:pnpm\s+)?tsc\s+--noEmit/m, `${file} type-checks from the monorepo root instead of apps/dev`)
  }
})

test('documentation does not advertise Node 18 or Node 20 as supported', () => {
  for (const file of documentationFiles()) {
      const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
      const legacyVersion = content.split(/\r?\n/).find(line =>
        !line.includes('@types/node') && (
          /\bNode(?:\.js)?\b.*\bv?(?:18|20)(?:\.(?:\d+|x)){0,2}\b/.test(line) ||
          /\bnode-version\s*:\s*['"]?(?:18|20)(?:\.(?:\d+|x)){0,2}/.test(line)
        )
      )
      assert.equal(
        legacyVersion,
        undefined,
        `${file} still names a Node version below the documented 22.14+ floor`
      )
  }
})

test('runtime requirements state the Node 22.14.0 floor', () => {
  for (const file of documentationFiles()) {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
    const incompleteRequirement = content.split(/\r?\n/).find(line =>
      /\bNode(?:\.js)?\s+22(?:\+|\s|$)/.test(line)
    )
    assert.equal(incompleteRequirement, undefined, `${file} does not state the Node 22.14.0 floor`)
  }
})

test('getting-started requirements use the Node 22.14 floor', () => {
  for (const file of markdownFiles('packages/core/docs/02-getting-started')) {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
    assert.doesNotMatch(content, /pnpm@?10\.17|Should (?:show|be): 10\.17/, `${file} contradicts the repository's pnpm 9 packageManager`)
  }

  for (const file of [
    'packages/core/docs/02-getting-started/00-quick-start.md',
    'packages/core/docs/02-getting-started/01-installation.md',
    'packages/core/docs/02-getting-started/02-setup.md',
  ]) {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
    assert.match(content, /Node(?:\.js)? 22\.14\+/, `${file} does not state the Node 22.14+ floor`)
  }
})

test('Corepack instructions state its Node 22.14.0 download requirement', () => {
  for (const file of [
    'packages/core/docs/02-getting-started/00-quick-start.md',
    'packages/core/docs/02-getting-started/01-installation.md',
    'packages/core/docs/02-getting-started/10-troubleshooting.md',
    'packages/core/docs/17-updates/01-update-core.md',
    'packages/create-nextspark-app/README.md',
  ]) {
    const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
    assert.match(content, /Corepack needs Node\.js 22\.14\.0 or later to download pnpm: Corepack in Node\.js 22\.13\.x fails with `Cannot find matching keyid`\./, `${file} does not explain Corepack's Node requirement`)
  }
})

test('docs do not describe the removed port or implicit dev workers', () => {
  for (const docsDir of DOCS_DIRS.slice(0, 2)) {
    for (const file of markdownFiles(docsDir)) {
      const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
      assert.doesNotMatch(content, /localhost:5173|\bport 5173\b/i, `${file} still uses the retired development port`)
      assert.doesNotMatch(content, /registries rebuild on startup|development server rebuilds registr(?:y|ies)|pnpm dev[^\n]*auto-rebuilds/i, `${file} says pnpm dev starts a registry worker`)
      assert.doesNotMatch(content, /^next dev\b/m, `${file} invokes Next.js without the repository package manager`)
    }
  }
})

test('Cypress wrapper examples pass supported paths and flags', () => {
  for (const docsDir of DOCS_DIRS.slice(0, 2)) {
    for (const file of markdownFiles(docsDir)) {
      const content = fs.readFileSync(path.join(SOURCE_ROOT, file), 'utf8')
      const extraSeparator = content.match(/pnpm\s+cy:run\s+--\s+--spec\b/)
      assert.equal(
        extraSeparator,
        null,
        `${file} passes an extra -- that prevents the Cypress wrapper from receiving --spec`
      )
      assert.doesNotMatch(
        content,
        /pnpm\s+cy:run\s+--config-file\b/,
        `${file} bypasses the wrapper's project-root Cypress configuration`
      )
      assert.doesNotMatch(
        content,
        /pnpm\s+cy:run\s+--spec\s+["']cypress\/e2e\//,
        `${file} gives the wrapper a path prefix that it adds itself`
      )
    }
  }
})

test('generated-project docs use the generated config paths and current CLI surface', () => {
  const gettingStartedFile = 'packages/core/docs/20-npm-distribution/00-getting-started.md'
  const wizardFile = 'packages/core/docs/02-getting-started/03-project-wizard.md'
  const packageFile = 'packages/core/docs/20-npm-distribution/02-package-json.md'
  const configFile = 'packages/core/docs/20-npm-distribution/04-config-system.md'
  const troubleshootingFile = 'packages/core/docs/20-npm-distribution/09-troubleshooting.md'

  const gettingStarted = fs.readFileSync(path.join(SOURCE_ROOT, gettingStartedFile), 'utf8')
  const wizard = fs.readFileSync(path.join(SOURCE_ROOT, wizardFile), 'utf8')
  const packageDoc = fs.readFileSync(path.join(SOURCE_ROOT, packageFile), 'utf8')
  const configDoc = fs.readFileSync(path.join(SOURCE_ROOT, configFile), 'utf8')
  const troubleshooting = fs.readFileSync(path.join(SOURCE_ROOT, troubleshootingFile), 'utf8')

  assert.match(gettingStarted, /pnpm 9\.0\.0/, `${gettingStartedFile} does not name the repository package-manager version`)
  assert.doesNotMatch(gettingStarted, /pnpm 8\+/, `${gettingStartedFile} still advertises the previous pnpm floor`)
  assert.match(wizard, /doctor[\s\S]{0,400}JSONC comments/i, `${wizardFile} does not explain the fresh-project doctor limitation`)
  assert.doesNotMatch(packageDoc, /@nextspark\/core\b/, `${packageFile} uses the historical package scope`)
  assert.doesNotMatch(packageDoc, /nextspark\s+generate:app\b/, `${packageFile} recommends a removed CLI command`)
  assert.match(configDoc, /required `nextspark\.config\.ts`/, `${configFile} does not describe the required root config`)
  assert.doesNotMatch(configDoc, /optional root `nextspark\.config\.ts`/, `${configFile} still describes the root config as optional`)

  for (const staleCommand of [
    /cat\s+nextspark\.config\.ts/,
    /grep\s+plugins\s+nextspark\.config\.ts/,
    /pnpm\s+tsc\s+nextspark\.config\.ts/,
    /node_modules\/@nextspark\/core/,
    /ls\s+packages\/core\/migrations/,
  ]) {
    assert.doesNotMatch(troubleshooting, staleCommand, `${troubleshootingFile} still uses a path absent from generated projects`)
  }
})
