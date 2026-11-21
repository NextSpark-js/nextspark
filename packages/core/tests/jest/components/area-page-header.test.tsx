/**
 * Devtools and superadmin share one page header (icon, title, subtitle, actions at the right) and the same full-width
 * content area (#533): at 1920 px superadmin left about 220 px empty at each side while the tables of devtools did not.
 */
import React from 'react'
import { readFileSync } from 'fs'
import { join } from 'path'
import { render, screen } from '@testing-library/react'
import { Shield } from 'lucide-react'

import { AreaPageHeader } from '@/core/components/area/AreaPageHeader'

describe('AreaPageHeader', () => {
  it('shows the icon, the title as the page heading, the subtitle and the actions', () => {
    const { container } = render(<AreaPageHeader icon={Shield} title="Users" subtitle="All of them" actions={<button>Refresh</button>} />)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Users')
    expect(screen.getByText('All of them')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy()
    expect(container.querySelector('svg')).not.toBeNull()
  })

  it('has no subtitle or actions element when it has none, and the tone picks the color of the area', () => {
    const { container } = render(<AreaPageHeader icon={Shield} title="Users" tone="red" />)
    expect(container.querySelectorAll('p')).toHaveLength(0)
    expect(container.querySelector('.bg-red-100')).not.toBeNull()
    expect(container.querySelector('.bg-violet-100')).toBeNull()
  })
})

describe('the content area of the two layouts', () => {
  const content = (file: string) => {
    const source = readFileSync(join(__dirname, '../../../src/routes/_internal', file), 'utf8')
    return source.match(/<main[^>]*>\s*<div className="([^"]*)"/)?.[1]
  }

  it('is full width in both, with no max-width that centers it', () => {
    const devtools = content('devtools-layout.tsx')
    const superadmin = content('superadmin-layout.tsx')
    expect(superadmin).toBe(devtools)
    expect(devtools).toContain('w-full')
    expect(devtools).not.toMatch(/max-w-|container/)
  })
})
