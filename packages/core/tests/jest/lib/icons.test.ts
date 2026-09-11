import { describe, it, expect } from '@jest/globals'
import { CheckSquare, Home, Trash2 } from 'lucide-react'

import { getIconName, resolveIcon } from '@/core/lib/icons'

describe('resolveIcon', () => {
  it('resolves a name the registry knows', () => {
    expect(resolveIcon('CheckSquare')).toBe(CheckSquare)
  })

  it('falls back when the name is not in the registry', () => {
    expect(resolveIcon('NotAnIcon', Home)).toBe(Home)
  })

  it('resolves a kebab-case name to the same icon', () => {
    // a theme's sidebar and block configs spell icons 'check-square'
    expect(resolveIcon('check-square')).toBe(CheckSquare)
  })

  it('falls back on an empty name', () => {
    expect(resolveIcon(undefined, Home)).toBe(Home)
    expect(resolveIcon('', Home)).toBe(Home)
  })
})

describe('getIconName', () => {
  it('names a registered icon so it can be resolved back', () => {
    const name = getIconName(CheckSquare)

    expect(name).toBe('CheckSquare')
    expect(resolveIcon(name)).toBe(CheckSquare)
  })

  it('falls back to the icon displayName when the icon is not registered', () => {
    // Trash2 is deliberately outside the mock registry: an icon no config
    // references still has to serialize to something.
    expect(getIconName(Trash2)).toBe(Trash2.displayName)
  })

  it('returns the default name for a missing icon', () => {
    expect(getIconName(undefined)).toBe('Box')
  })
})
