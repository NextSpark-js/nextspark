import { describe, test, expect } from '@jest/globals'
import { isDevtoolsNavActive } from '@/core/components/devtools/devtools-nav'

describe('isDevtoolsNavActive (#496)', () => {
  test('the dashboard item is active only on the dashboard', () => {
    expect(isDevtoolsNavActive('/devtools', '/devtools')).toBe(true)
    expect(isDevtoolsNavActive('/devtools/', '/devtools')).toBe(true)
    expect(isDevtoolsNavActive('/devtools/config', '/devtools')).toBe(false)
    expect(isDevtoolsNavActive('/devtools/blocks/hero', '/devtools')).toBe(false)
  })

  test('another item is active on its page and under it, not on a sibling with the same prefix', () => {
    expect(isDevtoolsNavActive('/devtools/blocks', '/devtools/blocks')).toBe(true)
    expect(isDevtoolsNavActive('/devtools/blocks/hero', '/devtools/blocks')).toBe(true)
    expect(isDevtoolsNavActive('/devtools/blocks-extra', '/devtools/blocks')).toBe(false)
    expect(isDevtoolsNavActive('/devtools/config', '/devtools/blocks')).toBe(false)
  })
})
