/**
 * Tests for the mcp-scopes generator (#541): the scopes of MCP browser sign-in as data, read from the sources of
 * the entity configs and of the `entities/<slug>/mcp.ts` files without running them, and decided by core's own
 * `lib/mcp/exposure.ts`.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/mcp-scopes.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { API_ACCESS_SOURCE, EXPOSURE_SOURCE, generateMcpScopes, loadExposure, planMcpScopes } from '../generators/mcp-scopes.mjs'

const CORE_ROOT = join(dirname(fileURLToPath(import.meta.url)), '../../../..')

/** A project on disk: `files` by relative path. Returns its root and the discovery records of its entities and overrides. */
function project(files) {
  const root = mkdtempSync(join(tmpdir(), 'ns-mcp-scopes-'))
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true })
    writeFileSync(join(root, path), content)
  }
  const entities = Object.keys(files)
    .map(path => /^entities\/([^/]+)\/[^/]+\.config\.ts$/.exec(path))
    .filter(Boolean)
    .map(([path, name]) => ({
      name,
      exportName: /export const (\w+(?:EntityConfig|ChildConfig))/.exec(files[path])?.[1],
      configPath: `@/${path.replace(/\.ts$/, '')}`,
      relativePath: name,
      parent: null,
      source: 'theme',
    }))
  const mcpOverrides = Object.keys(files)
    .map(path => /^entities\/([^/]+)\/mcp\.ts$/.exec(path))
    .filter(Boolean)
    .map(([, slug]) => ({ slug, importPath: `@/entities/${slug}/mcp` }))
  return { root, entities, mcpOverrides, plan: () => planMcpScopes({ entities, mcpOverrides, projectRoot: root, coreRoot: CORE_ROOT }) }
}

const config = (slug, body = `enabled: true, access: { api: true, shared: false }`) =>
  `import { Box } from 'lucide-react'\nimport type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'\nexport const ${slug}EntityConfig: EntityConfig = { slug: '${slug}', icon: Box, ${body} } as unknown as EntityConfig\n`

async function withProject(files, run) {
  const fixture = project(files)
  try {
    return await run(fixture)
  } finally {
    rmSync(fixture.root, { recursive: true, force: true })
  }
}

test('every operation of an entity the API serves has a scope; an entity without an API or not enabled has none', async () => {
  await withProject(
    {
      'entities/tasks/tasks.config.ts': config('tasks'),
      'entities/notes/notes.config.ts': config('notes', `enabled: true, access: { api: false }`),
      'entities/drafts/drafts.config.ts': config('drafts', `enabled: false, access: { api: true }`),
      'entities/ideas/ideas.config.ts': config('ideas', `access: { api: true }`),
    },
    async ({ plan }) => {
      assert.deepEqual(await plan(), {
        // `access.api` set and a slug, as the scope registry counts them: `enabled` is not part of that
        apiEntities: ['drafts', 'ideas', 'tasks'],
        toolScopes: ['tasks:delete', 'tasks:read', 'tasks:write'],
      })
    }
  )
})

test('`access.api` as an object names the operations: a scope only for the ones it serves', async () => {
  await withProject(
    { 'entities/tasks/tasks.config.ts': config('tasks', `enabled: true, access: { api: { read: true, create: true } }`) },
    async ({ plan }) => {
      assert.deepEqual((await plan()).toolScopes, ['tasks:read', 'tasks:write'])
    }
  )
})

test('`patterns` is kept out of MCP by default: it is an API entity with no tool scope', async () => {
  await withProject(
    { 'entities/patterns/patterns.config.ts': config('patterns'), 'entities/tasks/tasks.config.ts': config('tasks') },
    async ({ plan }) => {
      assert.deepEqual(await plan(), { apiEntities: ['patterns', 'tasks'], toolScopes: ['tasks:delete', 'tasks:read', 'tasks:write'] })
    }
  )
})

test('an mcp.ts is read without running it: exclude, excludeOperations and the scopes of its extra tools', async () => {
  await withProject(
    {
      'entities/tasks/tasks.config.ts': config('tasks'),
      'entities/tasks/mcp.ts': `import type { McpEntityOverride } from '@nextsparkjs/core/lib/mcp'
import { auth } from '@nextsparkjs/core/lib/auth'
throw new Error('this module must never be evaluated to compute the scopes')
const operations = ['delete']
const tasksMcpOverride: McpEntityOverride = {
  excludeOperations: operations,
  extraToolScopes: ['customers:read'],
  extraTools: api => [],
}
export default tasksMcpOverride
`,
      'entities/customers/customers.config.ts': config('customers'),
      'entities/customers/mcp.ts': `export default { exclude: true } satisfies import('@nextsparkjs/core/lib/mcp').McpEntityOverride\n`,
      'entities/posts/posts.config.ts': config('posts'),
      // declared scopes count only next to extra tools, as the engine builds them
      'entities/posts/mcp.ts': `export default { excludeOperations: ['create', 'update', 'delete'], extraToolScopes: ['posts:delete'] }\n`,
    },
    async ({ plan }) => {
      assert.deepEqual((await plan()).toolScopes, ['customers:read', 'posts:read', 'tasks:read', 'tasks:write'])
    }
  )
})

test('a method, a shorthand or a reference all count as having extra tools; null and undefined do not', async () => {
  for (const [extraTools, expected] of [
    ['extraTools(api) { return [] }', true],
    ['extraTools', true],
    ['extraTools: buildTools', true],
    ['extraTools: undefined', false],
    ['extraTools: null', false],
  ]) {
    await withProject(
      {
        'entities/tasks/tasks.config.ts': config('tasks', `enabled: true, access: { api: { read: true } }`),
        'entities/tasks/mcp.ts': `const extraTools = () => []\nconst buildTools = extraTools\nexport default { ${extraTools}, extraToolScopes: ['tasks:delete'] }\n`,
      },
      async ({ plan }) => {
        assert.deepEqual((await plan()).toolScopes, expected ? ['tasks:delete', 'tasks:read'] : ['tasks:read'], extraTools)
      }
    )
  }
})

test('the result is what core\'s own exposure rules say of the same facts', async () => {
  const { toolScopesOf, exposedEntities } = await loadExposure(CORE_ROOT, CORE_ROOT)
  const registry = { tasks: { slug: 'tasks', enabled: true, access: { api: { read: true, delete: true } } } }
  assert.deepEqual(toolScopesOf(registry, { overrides: {} }), ['tasks:delete', 'tasks:read'])
  assert.deepEqual(exposedEntities(registry).map(entity => entity.operations), [['list', 'get', 'delete']])
})

test('exposure.ts and api-access.ts stay evaluable on their own: exposure imports api-access and types, api-access nothing', () => {
  const imports = file => [...readFileSync(join(CORE_ROOT, file), 'utf8').matchAll(/^import\s+(type\s+)?[^'"]*from\s+['"]([^'"]+)['"]/gm)].filter(match => !match[1]).map(match => match[2])
  assert.deepEqual(imports(EXPOSURE_SOURCE), ['../entities/api-access'])
  assert.deepEqual(imports(API_ACCESS_SOURCE), [])
})

test('the package ships the two sources the scopes are computed with', () => {
  const { files } = JSON.parse(readFileSync(join(CORE_ROOT, 'package.json'), 'utf8'))
  assert.ok(files.includes(EXPOSURE_SOURCE), `package.json "files" must list ${EXPOSURE_SOURCE}`)
  assert.ok(files.includes(API_ACCESS_SOURCE), `package.json "files" must list ${API_ACCESS_SOURCE}`)
})

test('a value that is not a literal stops the build and names the file and what to write', async () => {
  await withProject(
    {
      'entities/tasks/tasks.config.ts': config('tasks', `enabled: process.env.TASKS === 'on', access: { api: apiAccess() }`),
      'entities/notes/notes.config.ts': `export const notesEntityConfig = buildConfig('notes')\n`,
      'entities/posts/posts.config.ts': config('posts'),
      'entities/posts/mcp.ts': `import { base } from './base'\nexport default { ...base, excludeOperations: operations() }\n`,
      'entities/pages/pages.config.ts': config('pages'),
      'entities/pages/mcp.ts': `export default defineOverride({ exclude: true })\n`,
      'entities/items/items.config.ts': config('items'),
      'entities/items/mcp.ts': `export default { excludeOperations: ['remove'], extraToolScopes: [scope] }\n`,
    },
    async ({ plan }) => {
      await assert.rejects(plan, error => {
        const message = error.message
        assert.match(message, /MCP browser sign-in \(`features\.mcpOAuth`\) is on/)
        assert.match(message, /entities\/tasks \(@\/entities\/tasks\/tasks\.config\): `enabled` is not a literal `true` or `false`/)
        assert.match(message, /entities\/tasks \(@\/entities\/tasks\/tasks\.config\): `access\.api` is not a literal/)
        assert.match(message, /entities\/notes \(@\/entities\/notes\/notes\.config\): has no `const notesEntityConfig = \{ \.\.\. \}` object literal/)
        assert.match(message, /entities\/posts\/mcp\.ts: `exclude` cannot be read \(the object spreads another one/)
        assert.match(message, /entities\/posts\/mcp\.ts: `excludeOperations` is not a literal array of strings/)
        assert.match(message, /entities\/posts\/mcp\.ts: whether it has `extraTools` cannot be read/)
        assert.match(message, /entities\/pages\/mcp\.ts: has no `export default` of an object literal/)
        assert.match(message, /entities\/items\/mcp\.ts: `excludeOperations` names "remove": use list, get, create, update, delete/)
        assert.match(message, /entities\/items\/mcp\.ts: `extraToolScopes` is not a literal array of strings/)
        assert.match(message, /Write those values as literals/)
        return true
      })
    }
  )
})

test('a child entity (`...ChildConfig`) is a definition the API never serves on its own: it is not read', async () => {
  await withProject(
    {
      'entities/orders/orders.config.ts': config('orders'),
      'entities/lines/lines.config.ts': `export const linesChildConfig = makeChild()\n`,
    },
    async ({ plan }) => {
      assert.deepEqual(await plan(), { apiEntities: ['orders'], toolScopes: ['orders:delete', 'orders:read', 'orders:write'] })
    }
  )
})

test('core\'s own entities are read from the core the build runs with', async () => {
  const plan = await planMcpScopes({
    entities: [{ name: 'patterns', exportName: 'patternsEntityConfig', configPath: '@nextsparkjs/core/entities/patterns/patterns.config', relativePath: 'patterns', parent: null, isCore: true, source: 'core' }],
    mcpOverrides: [],
    projectRoot: CORE_ROOT,
    coreRoot: CORE_ROOT,
  })
  assert.deepEqual(plan, { apiEntities: ['patterns'], toolScopes: [] })
})

test('the generated module is data and nothing else: no import, no timestamp, the same bytes for the same lists', () => {
  const scopes = { apiEntities: ['tasks'], toolScopes: ['tasks:read'] }
  const out = generateMcpScopes(scopes)
  assert.doesNotMatch(out, /^\s*import\s/m)
  assert.doesNotMatch(out, /Generated at/)
  assert.equal(out, generateMcpScopes({ ...scopes }))
  assert.match(out, /export const MCP_SCOPES: \{ readonly apiEntities: readonly string\[\]; readonly toolScopes: readonly string\[\] \} = \{\s*"apiEntities": \[\s*"tasks"\s*\],\s*"toolScopes": \[\s*"tasks:read"\s*\]\s*\}/)
  assert.match(out, /Both lists are computed\./)
})

test('a project without the feature gets empty lists and is told its sources were not read', () => {
  const out = generateMcpScopes(null)
  assert.match(out, /"apiEntities": \[\],\s*"toolScopes": \[\]/)
  assert.match(out, /does not turn `features\.mcpOAuth` on, so its sources were not read/)
})
