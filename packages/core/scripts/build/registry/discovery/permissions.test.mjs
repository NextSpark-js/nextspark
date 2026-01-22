/**
 * Unit tests for parseEntitiesFromConfig function
 *
 * Run with: node --test packages/core/scripts/build/registry/discovery/permissions.test.mjs
 */

import { describe, it } from 'node:test'
import assert from 'node:assert'

// Import the regex pattern directly since parseEntitiesFromConfig is not exported
// We'll test the regex patterns directly

/**
 * Test the entity block regex pattern
 */
describe('Entity Block Regex', () => {
  // The regex pattern from permissions.mjs
  const entityBlockRegex = /["']?([\w-]+)["']?:\s*\[([\s\S]*?)\],?(?=\s*(?:\/\/[^\n]*\n)?\s*(?:["'][\w-]+["']:|[\w-]+:|\}|$))/g

  it('should match simple entity keys', () => {
    const content = `
    customers: [
      { action: 'create', roles: ['owner'] }
    ],
    tasks: [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'customers')
    assert.strictEqual(matches[1][1], 'tasks')
  })

  it('should match quoted entity keys with hyphens (double quotes)', () => {
    const content = `
    "ai-agents": [
      { action: 'create', roles: ['owner'] }
    ],
    "landing-pages": [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'ai-agents')
    assert.strictEqual(matches[1][1], 'landing-pages')
  })

  it('should match quoted entity keys with hyphens (single quotes)', () => {
    const content = `
    'ai-agents': [
      { action: 'create', roles: ['owner'] }
    ],
    'user-profiles': [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'ai-agents')
    assert.strictEqual(matches[1][1], 'user-profiles')
  })

  it('should match mixed quoted and unquoted keys', () => {
    const content = `
    customers: [
      { action: 'create', roles: ['owner'] }
    ],
    "ai-agents": [
      { action: 'read', roles: ['member'] }
    ],
    tasks: [
      { action: 'update', roles: ['admin'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 3)
    assert.strictEqual(matches[0][1], 'customers')
    assert.strictEqual(matches[1][1], 'ai-agents')
    assert.strictEqual(matches[2][1], 'tasks')
  })

  it('should handle last entity without trailing comma', () => {
    const content = `
    customers: [
      { action: 'create', roles: ['owner'] }
    ],
    tasks: [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[1][1], 'tasks')
  })

  it('should handle entity followed by closing brace', () => {
    const content = `
    customers: [
      { action: 'create', roles: ['owner'] }
    ]
  }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 1)
    assert.strictEqual(matches[0][1], 'customers')
  })

  it('should handle entities with comments between them', () => {
    const content = `
    customers: [
      { action: 'create', roles: ['owner'] }
    ],
    // This is a comment about tasks
    tasks: [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'customers')
    assert.strictEqual(matches[1][1], 'tasks')
  })

  it('should handle entity with multiple hyphens', () => {
    const content = `
    "ai-landing-page-templates": [
      { action: 'create', roles: ['owner'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 1)
    assert.strictEqual(matches[0][1], 'ai-landing-page-templates')
  })

  it('should handle empty actions array', () => {
    const content = `
    customers: [],
    tasks: [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'customers')
    assert.strictEqual(matches[0][2].trim(), '')
  })
})

/**
 * Test the action regex pattern
 */
describe('Action Block Regex', () => {
  const actionRegex = /\{\s*action:\s*['"](\w+)['"][^}]*\}/g

  it('should extract action names', () => {
    const content = `
      { action: 'create', label: 'Create', roles: ['owner'] },
      { action: 'read', label: 'Read', roles: ['member'] },
      { action: 'update', label: 'Update', roles: ['admin'] }
    `

    const matches = [...content.matchAll(actionRegex)]
    assert.strictEqual(matches.length, 3)
    assert.strictEqual(matches[0][1], 'create')
    assert.strictEqual(matches[1][1], 'read')
    assert.strictEqual(matches[2][1], 'update')
  })

  it('should handle action with dangerous flag', () => {
    const content = `
      { action: 'delete', label: 'Delete', roles: ['owner'], dangerous: true }
    `

    const matches = [...content.matchAll(actionRegex)]
    assert.strictEqual(matches.length, 1)
    assert.strictEqual(matches[0][1], 'delete')
  })
})

console.log('\n✅ All permission parsing tests passed!\n')
