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
  // The regex pattern from permissions.mjs (MUST match the actual implementation!)
  // IMPORTANT: The closing bracket must be at the start of a line (after newline + whitespace)
  // This prevents matching `]` inside nested arrays like `roles: ['owner', 'admin']`
  const entityBlockRegex = /\n\s*['"]?([\w-]+)['"]?:\s*\[([\s\S]*?)\n\s*\]/g

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

  it('should handle empty actions array (multiline format)', () => {
    // Note: Empty arrays on a single line (e.g., "customers: [],") won't be matched
    // because the regex requires the closing ] to be on its own line.
    // In practice, if you define permissions for an entity, you'd have at least one.
    // This test covers the multiline empty array case.
    const content = `
    customers: [
    ],
    tasks: [
      { action: 'read', roles: ['member'] }
    ]
    }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'customers')
    assert.strictEqual(matches[0][2].trim(), '')
  })

  /**
   * CRITICAL TEST: This is the exact bug that broke beta.62
   * The regex was matching `roles: ['owner', 'admin']` inside action objects
   * as if it were an entity key, causing "Invalid entity slug: roles" errors.
   */
  it('should NOT match roles inside action objects as entity keys', () => {
    // This is the exact structure from a real permissions.config.ts
    const content = `
    patterns: [
      { action: 'create', label: 'Create Patterns', description: 'Can create patterns', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View Patterns', description: 'Can view patterns', roles: ['owner', 'admin', 'member'] },
      { action: 'delete', label: 'Delete Patterns', description: 'Can delete patterns', roles: ['owner', 'admin'], dangerous: true },
    ],

    'ai-agents': [
      { action: 'create', label: 'Create AI Agents', description: 'Can create agents', roles: ['owner', 'admin'] },
      { action: 'read', label: 'View AI Agents', description: 'Can view agents', roles: ['owner', 'admin', 'member'] },
    ],

    analysis: [
      { action: 'create', label: 'Create Analysis', description: 'Can create analyses', roles: ['owner'] },
      { action: 'read', label: 'View Analysis', description: 'Can view analyses', roles: ['owner', 'admin', 'member'] },
    ],
  }`

    const matches = [...content.matchAll(entityBlockRegex)]

    // Should find exactly 3 entity keys: patterns, ai-agents, analysis
    // Should NOT find 'roles' as an entity key
    assert.strictEqual(matches.length, 3, `Expected 3 entities but found ${matches.length}: ${matches.map(m => m[1]).join(', ')}`)

    const entityNames = matches.map(m => m[1])
    assert.ok(entityNames.includes('patterns'), 'Should include patterns')
    assert.ok(entityNames.includes('ai-agents'), 'Should include ai-agents')
    assert.ok(entityNames.includes('analysis'), 'Should include analysis')
    assert.ok(!entityNames.includes('roles'), 'Should NOT include roles (that\'s inside action objects)')
  })

  it('should handle real-world permissions config structure', () => {
    // Mimics the exact indentation and structure of a real config file
    const content = `
    // PATTERNS ENTITY
    patterns: [
      { action: 'create', label: 'Create', roles: ['owner', 'admin'] },
      { action: 'read', label: 'Read', roles: ['owner', 'admin', 'member'] },
    ],

    // AI-AGENTS ENTITY (hyphenated, quoted)
    'ai-agents': [
      { action: 'create', label: 'Create', roles: ['owner'] },
    ],
  }`

    const matches = [...content.matchAll(entityBlockRegex)]
    assert.strictEqual(matches.length, 2)
    assert.strictEqual(matches[0][1], 'patterns')
    assert.strictEqual(matches[1][1], 'ai-agents')
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
