import { describe, test, expect } from '@jest/globals'
import {
  splitRoutePath,
  defaultMethod,
  countFilledRows,
} from '../../../../src/components/devtools/api-explorer/explorer-helpers'

const row = (key: string) => ({ id: key || Math.random().toString(), key, value: '', enabled: true })

describe('splitRoutePath', () => {
  test('a core route is grouped by its first segment after /api/v1/', () => {
    expect(splitRoutePath('/api/v1/billing/checkout')).toEqual({ group: 'billing', shortPath: 'checkout' })
    expect(splitRoutePath('/api/v1/users')).toEqual({ group: 'users', shortPath: '' })
  })

  test('a project route under /api/ keeps no base and no double slash', () => {
    expect(splitRoutePath('/api/ai/chat/stream')).toEqual({ group: 'ai', shortPath: 'chat/stream' })
    expect(`/${splitRoutePath('/api/ai/orchestrator').shortPath}`).not.toMatch(/^\/\//)
  })

  test('a plugin route is grouped by its plugin, not under one "plugins" group', () => {
    expect(splitRoutePath('/api/plugins/langchain/observability/metrics')).toEqual({ group: 'langchain', shortPath: 'observability/metrics' })
  })

  test('a path with no segment falls in root', () => {
    expect(splitRoutePath('/api/v1/').group).toBe('root')
  })
})

describe('defaultMethod', () => {
  test('prefers GET over a preflight listed first', () => {
    expect(defaultMethod(['OPTIONS', 'GET', 'POST'])).toBe('GET')
  })
  test('skips OPTIONS and HEAD when there is no GET', () => {
    expect(defaultMethod(['OPTIONS', 'POST'])).toBe('POST')
  })
  test('falls back to the first method, then GET', () => {
    expect(defaultMethod(['OPTIONS'])).toBe('OPTIONS')
    expect(defaultMethod([])).toBe('GET')
  })
})

describe('countFilledRows', () => {
  test('counts only the rows that have a key', () => {
    expect(countFilledRows([row(''), row('  '), row('page')])).toBe(1)
    expect(countFilledRows([row(''), row('')])).toBe(0)
  })
})
