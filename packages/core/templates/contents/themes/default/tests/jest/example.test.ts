/**
 * Example Jest test for your NextSpark project
 *
 * Run with: pnpm test:theme
 */
import { describe, test, expect } from '@jest/globals'

describe('Example Tests', () => {
  test('should pass a basic assertion', () => {
    expect(1 + 1).toBe(2)
  })

  test('should work with arrays', () => {
    const items = ['alpha', 'beta', 'gamma']
    expect(items).toHaveLength(3)
    expect(items).toContain('beta')
  })

  test('should work with objects', () => {
    const user = { name: 'Test', role: 'admin' }
    expect(user).toHaveProperty('name')
    expect(user.role).toBe('admin')
  })
})
