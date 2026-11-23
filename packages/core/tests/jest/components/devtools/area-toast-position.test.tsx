/**
 * @jest-environment jsdom
 *
 * #537: the areas move the one toaster to the bottom right with a rule that exists only while their layout renders.
 */
import React from 'react'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, cleanup } from '@testing-library/react'
import { AreaToastPosition, AREA_TOAST_RULES } from '@/core/providers/area-toast-position'

afterEach(cleanup)

describe('AreaToastPosition', () => {
  test('puts the left-anchored toaster and its toasts on the right', () => {
    render(<AreaToastPosition />)
    const css = document.querySelector('style[data-cy="area-toast-position"]')?.textContent
    expect(css).toBe(AREA_TOAST_RULES)
    expect(css).toContain("[data-sonner-toaster][data-x-position='left']{left:auto;right:var(--offset-right)}")
    expect(css).toContain("[data-sonner-toast][data-x-position='left']{left:auto;right:0}")
  })
})

describe('where the toast rule is mounted', () => {
  const src = (file: string) => readFileSync(path.join(__dirname, '../../../../src', file), 'utf8')
  const count = (text: string) => (text.match(/<AreaToastPosition \/>/g) ?? []).length

  test('in both layouts of each area (core\'s own and the one around a project\'s), and nowhere shared with the dashboard or the public pages', () => {
    expect(count(src('routes/_internal/devtools-layout.tsx'))).toBe(2)
    expect(count(src('routes/_internal/superadmin-layout.tsx'))).toBe(2)
    for (const shared of ['providers/DashboardProviders.tsx', 'routes/layout.tsx', 'providers/group-providers.tsx', 'components/ui/sonner.tsx']) {
      expect(src(shared)).not.toContain('AreaToastPosition')
    }
  })
})
