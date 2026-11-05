/**
 * @jest-environment jsdom
 */

/**
 * #406: a page has one `<h1>`, the page's own title. The docs layout's mobile header used to render "Documentation" as
 * another one, and so did the superadmin and settings layouts. axe has no rule for a second `<h1>` (`page-has-heading-one`
 * only asks for one), so the count is checked here.
 */
import { describe, test, expect } from '@jest/globals'
import { render } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { DocsLayout } from '@/core/components/docs/docs-layout'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

describe('docs page', () => {
  test('has one <h1>, the page title, and the layout title is still rendered', () => {
    const { container } = render(
      <DocsLayout>
        {[<nav key="s">sidebar</nav>, <h1 key="p">Page title</h1>]}
      </DocsLayout>
    )
    const h1s = container.querySelectorAll('h1')
    expect(h1s).toHaveLength(1)
    expect(h1s[0].textContent).toBe('Page title')
    expect(container.textContent).toContain('title')
  })
})

describe('layouts of core', () => {
  // A layout wraps pages that carry their own `<h1>`; the exception keeps its reason.
  const srcRoot = path.resolve(__dirname, '../../../../src')
  const layouts = [
    'components/docs/docs-layout.tsx',
    'routes/_internal/superadmin-layout.tsx',
    'routes/dashboard/settings/layout.tsx',
    'routes/layout.tsx',
    'routes/layout.ppr.tsx',
  ]
  test.each(layouts)('%s renders no <h1>', (file) => {
    expect(fs.readFileSync(path.join(srcRoot, file), 'utf8')).not.toMatch(/<h1[\s>]/)
  })
  // routes/_internal/default-auth-layout.tsx keeps its <h1> (the app name): the auth pages use no <h1> of their own
})
