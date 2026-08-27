/**
 * Tests for the mcp-registry generator.
 *
 * Run: node --test packages/core/scripts/build/registry/__tests__/mcp-registry.test.mjs
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'

import { generateMcpRegistry } from '../generators/mcp-registry.mjs'

const CONFIG = { outputDir: '/project/.nextspark/registries', isNpmMode: false }

test('emits an empty MCP_OVERRIDES map when no overrides were discovered', () => {
  const out = generateMcpRegistry([], CONFIG)
  assert.match(out, /export const MCP_OVERRIDES: Record<string, McpEntityOverride> = \{\s*\}/)
  assert.doesNotMatch(out, /^import .+McpOverride/m)
})

test('emits one literal import + map entry per discovered override', () => {
  const out = generateMcpRegistry(
    [{ slug: 'customers', importPath: '@/contents/themes/default/entities/customers/mcp', themeName: 'default' }],
    CONFIG
  )
  assert.match(out, /import CustomersMcpOverride from '@\/contents\/themes\/default\/entities\/customers\/mcp'/)
  assert.match(out, /'customers': CustomersMcpOverride,/)
})

test('imports the McpEntityOverride type from @/core/lib/mcp in monorepo mode', () => {
  const out = generateMcpRegistry([], CONFIG)
  assert.match(out, /import type \{ McpEntityOverride \} from '@\/core\/lib\/mcp'/)
})

test('converts @/core/lib/mcp to @nextsparkjs/core/lib/mcp in npm mode', () => {
  const out = generateMcpRegistry([], { ...CONFIG, isNpmMode: true })
  assert.match(out, /import type \{ McpEntityOverride \} from '@nextsparkjs\/core\/lib\/mcp'/)
})

test('PascalCases hyphenated/underscored/nested slugs into a valid identifier', () => {
  const out = generateMcpRegistry(
    [
      { slug: 'meal-plans', importPath: '@/contents/themes/default/entities/meal-plans/mcp' },
      { slug: 'pantry_items', importPath: '@/contents/themes/default/entities/pantry_items/mcp' },
    ],
    CONFIG
  )
  assert.match(out, /import MealPlansMcpOverride from/)
  assert.match(out, /import PantryItemsMcpOverride from/)
  assert.match(out, /'meal-plans': MealPlansMcpOverride,/)
  assert.match(out, /'pantry_items': PantryItemsMcpOverride,/)
})

test('handles multiple overrides, one import + entry each, in discovery order', () => {
  const out = generateMcpRegistry(
    [
      { slug: 'customers', importPath: '@/contents/themes/default/entities/customers/mcp' },
      { slug: 'tasks', importPath: '@/contents/themes/default/entities/tasks/mcp' },
    ],
    CONFIG
  )
  const importLines = out.match(/^import \w+McpOverride from .+$/gm) ?? []
  assert.equal(importLines.length, 2)
  assert.match(out, /'customers': CustomersMcpOverride,[\s\S]*'tasks': TasksMcpOverride,/)
})
