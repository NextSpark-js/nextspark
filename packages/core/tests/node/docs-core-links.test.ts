/**
 * Core's own docs (packages/core/docs) are kept as internal monorepo
 * reference and never published, and a plugin's own docs/ is never scanned
 * into the docs registry either - so any claim elsewhere in the docs that
 * /docs/core/, /docs/theme/ or /docs/plugins/ is a real route (as a link, in
 * prose, or in a URL-structure code block) points nowhere real. Likewise,
 * there is a single `pnpm build:registries` command that rebuilds every
 * registry together - a namespaced `registry:build:<type>` script does not
 * exist.
 *
 * The additional tests keep registry-source, import-path, generator, and
 * command references accurate throughout the core documentation.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const ROOT_PACKAGE_JSON = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'package.json'), 'utf8'))
const ROOT_SCRIPTS: Record<string, string> = ROOT_PACKAGE_JSON.scripts

const CORE_DOCS_DIR = 'packages/core/docs'
// Override this for a historical docs tree without changing the checkout. The
// override points directly at packages/core/docs; production tests use this
// repository's docs directory.
const CORE_DOCS_ROOT = process.env.CORE_DOCS_ROOT
  ? path.resolve(process.env.CORE_DOCS_ROOT)
  : path.join(REPO_ROOT, CORE_DOCS_DIR)
const DOCUMENTATION_SYSTEM_DIR = '15-documentation-system'
const AI_PLUGIN_INSTALL_DOC = 'plugins/ai/docs/01-getting-started/02-installation.md'

function docFiles(relDir: string): string[] {
  return fs.readdirSync(path.join(CORE_DOCS_ROOT, relDir))
    .filter(name => name.endsWith('.md'))
    .map(name => path.join(relDir, name))
}

function coreDocFiles(relDir = ''): string[] {
  return fs.readdirSync(path.join(CORE_DOCS_ROOT, relDir), { withFileTypes: true })
    .flatMap(entry => {
      const entryPath = path.join(relDir, entry.name)
      if (entry.isDirectory()) return coreDocFiles(entryPath)
      return entry.isFile() && entry.name.endsWith('.md') ? [entryPath] : []
    })
}

test('the documentation-system docs do not claim /docs/core/, /docs/theme/ or /docs/plugins/ is a real route', () => {
  for (const file of docFiles(DOCUMENTATION_SYSTEM_DIR)) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    for (const unpublishedPath of ['/docs/core/', '/docs/theme/', '/docs/plugins/']) {
      assert.doesNotMatch(content, new RegExp(unpublishedPath.replace(/\//g, '\\/')), `${file} still claims ${unpublishedPath} is a route`)
    }
  }
})

test('core docs do not use the removed core docs registry import path', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /(?:@\/)?core\/lib\/registries\/docs-registry/,
      `${file} still names the removed core docs registry path`
    )
  }
})

test('core docs do not describe core or plugin documentation as registry sources', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /(?:scans?|scanning|indexes?)\s+(?:all\s+)?(?:markdown\s+files\s+in\s+)?`?(?:packages\/)?core\/docs(?:\/\*\*\/\*\.md)?/i,
      `${file} still describes core documentation as a docs registry source`
    )
    assert.doesNotMatch(
      content,
      /(?:scans?|scanning|indexes?)\s+(?:all\s+)?(?:`?(?:contents\/)?plugins\/[^\s`]+\/docs|plugin\s+docs)/i,
      `${file} still describes plugin documentation as a docs registry source`
    )
  }
})

test('core documentation does not recommend removed registry build commands', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /pnpm\s+registry:build(?:-watch)?\b/,
      `${file} recommends a nonexistent pnpm registry command`
    )
    assert.doesNotMatch(
      content,
      /node\s+packages\/core\/scripts\/build\/registry\.mjs\b/,
      `${file} invokes the monorepo registry script without cd apps/dev and ../../`
    )
  }
})

test('core docs do not recommend the uninvoked standalone docs generator', () => {
  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /(?:core\/)?scripts\/build\/docs-registry\.mjs/,
      `${file} still presents the standalone docs registry script as a generator`
    )
  }
})

test('the AI plugin install doc does not recommend a registry:build:<type> script', () => {
  const content = fs.readFileSync(path.join(REPO_ROOT, AI_PLUGIN_INSTALL_DOC), 'utf8')
  assert.doesNotMatch(content, /registry:build:\w/, `${AI_PLUGIN_INSTALL_DOC} still recommends a namespaced registry:build script`)
})

test('registry build and watch commands name a runnable context', () => {
  const monorepoCommand = 'cd apps/dev && node ../../packages/core/scripts/build/registry.mjs'
  const generatedBuild = 'pnpm build:registries'
  const generatedWatch = 'pnpm exec nextspark registry:watch'
  const monorepoContext = '> **Registry commands in this guide** run in the NextSpark monorepo, from the repository root. In a generated project, build the registries with `pnpm build:registries` and watch them with `pnpm exec nextspark registry:watch`.'
  const generatedProjectContext = '> **Registry commands in this guide** run in a generated project, from its root. In the NextSpark monorepo, run `cd apps/dev && node ../../packages/core/scripts/build/registry.mjs` (add `--watch` to watch).'

  for (const file of coreDocFiles()) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    const lines = content.split(/\r?\n/)
    // Context is visible to readers and appears near the title, not later
    // where it cannot establish the execution context of a command.
    const hasMonorepoDeclaration = lines.slice(0, 20).includes(monorepoContext)
    const hasGeneratedProjectDeclaration = lines.slice(0, 20).includes(generatedProjectContext)

    assert.doesNotMatch(content, /(?<!pnpm exec )(?<!npx )nextspark\s+registry[:\s](?:build|watch)\b/, `${file} invokes nextspark without pnpm exec or npx`)
    assert.doesNotMatch(content, /node\s+(?:core|packages\/core|scripts|node_modules)\/scripts\/build\/registry\.mjs\b/, `${file} invokes the registry script from a nonexistent path`)
    assert.doesNotMatch(content, /build-registry\.mjs\b/, `${file} names the removed build-registry script`)
    assert.doesNotMatch(content, /pnpm\s+registry:watch\b/, `${file} invokes a nonexistent pnpm registry watcher`)
    assert.doesNotMatch(content, /(?:npm run|pnpm)\s+build:registry\b/, `${file} invokes a nonexistent registry build script`)

    for (const [lineIndex, line] of lines.entries()) {
      const nearbyContext = lines.slice(Math.max(0, lineIndex - 12), lineIndex + 1).join('\n')
      if (line.includes(monorepoCommand)) {
        assert.ok(
          hasMonorepoDeclaration || /monorepo/i.test(nearbyContext),
          `${file}:${lineIndex + 1} documents a monorepo command without monorepo context`
        )
      }
      if (line.includes(generatedBuild) || line.includes(generatedWatch)) {
        assert.ok(
          hasGeneratedProjectDeclaration || /generated project/i.test(nearbyContext),
          `${file}:${lineIndex + 1} documents a generated-project command without generated-project context`
        )
      }
    }
  }
})

test('the documentation-system docs do not teach removed selector fallbacks or inert settings', () => {
  for (const file of docFiles(DOCUMENTATION_SYSTEM_DIR)) {
    const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
    assert.doesNotMatch(
      content,
      /ACTIVE_(?:THEME|PROJECT)\s*\|\|\s*['"]default['"]/,
      `${file} shows a default theme the registry build does not fall back to`
    )
  }

  const extending = fs.readFileSync(path.join(CORE_DOCS_ROOT, DOCUMENTATION_SYSTEM_DIR, '07-extending-overriding.md'), 'utf8')
  assert.doesNotMatch(extending, /expanded by default/i, '07-extending-overriding.md says `open` expands a category, and nothing reads it')
  assert.doesNotMatch(extending, /\|\s*`enabled`\s*\|\s*boolean\s*\|\s*Show\/hide this category/i, '07-extending-overriding.md says `enabled` hides any category, and only the public sidebar reads it')
})

test('installation.md builds Core before invoking the registry script', () => {
  const file = '02-getting-started/01-installation.md'
  const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
  const stepFive = content.slice(content.indexOf('### Step 5: Build Registries'))
  const prerequisiteIndex = stepFive.indexOf('pnpm build:core')
  const registryCallIndex = stepFive.indexOf('node ../../packages/core/scripts/build/registry.mjs')
  assert.ok(prerequisiteIndex >= 0, `${file} Step 5 does not mention building Core first`)
  assert.ok(
    prerequisiteIndex < registryCallIndex,
    `${file} Step 5 invokes the registry script before telling the reader to build Core, which the script imports from packages/core/dist`
  )
})

test("quick-start.md's Development Commands Reference names only real root scripts", () => {
  const file = '02-getting-started/00-quick-start.md'
  const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
  const reference = content.slice(content.indexOf('## Development Commands Reference'))
  const block = reference.match(/```bash\n([\s\S]*?)```/)
  assert.ok(block, `${file} has no fenced command block under Development Commands Reference`)

  const bareTest = block![1].match(/^\s*pnpm\s+test\s*($|\s)/m)
  assert.equal(bareTest, null, `${file} recommends \`pnpm test\`, which has no script at the repository root`)

  for (const match of block![1].matchAll(/^\s*pnpm\s+([\w:-]+)/gm)) {
    const script = match[1]
    assert.ok(script in ROOT_SCRIPTS, `${file} recommends \`pnpm ${script}\`, which is not a script in the root package.json`)
  }
})

test("troubleshooting-and-debugging.md's --trace-warnings command runs from apps/dev", () => {
  const file = '03-registry-system/13-troubleshooting-and-debugging.md'
  const content = fs.readFileSync(path.join(CORE_DOCS_ROOT, file), 'utf8')
  assert.match(
    content,
    /cd apps\/dev && node --trace-warnings \.\.\/\.\.\/packages\/core\/scripts\/build\/registry\.mjs/,
    `${file} runs --trace-warnings without cd apps/dev, so it cannot discover the project root`
  )
})
