/**
 * @jest-environment jsdom
 *
 * PublicFooter — every internal link must point to a page this app actually
 * serves: a page seeded in the default theme's sample data, or a templated
 * public route (blog, support, docs). A dead entry there is a silent 404
 * nothing else catches.
 */
import fs from 'fs'
import path from 'path'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (key: string) => key }))

import { PublicFooter } from '@/core/components/app/layouts/PublicFooter'

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..', '..', '..', '..', '..')

/** Every in-app path the default theme's seeded pages and templated public routes actually serve. */
function realPublicRoutes(): Set<string> {
  const routes = new Set<string>(['/', '/docs'])

  const pagesSql = fs.readFileSync(path.join(REPO_ROOT, 'themes/default/migrations/093_pages_sample_data.sql'), 'utf8')
  for (const match of pagesSql.matchAll(/VALUES\s*\(\s*'[^']*',\s*'[^']*',\s*'[^']*',\s*'([^']*)'/g)) {
    routes.add(match[1] === 'home' ? '/' : `/${match[1]}`)
  }

  const templatesDir = path.join(REPO_ROOT, 'apps/dev/app/(templates)/(public)')
  for (const entry of fs.readdirSync(templatesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) routes.add(`/${entry.name}`)
  }

  return routes
}

describe('PublicFooter', () => {
  test('every internal link points to a page this app actually serves', () => {
    render(<PublicFooter />)
    const routes = realPublicRoutes()

    const internalHrefs = screen
      .getAllByRole('link')
      .map(link => link.getAttribute('href'))
      .filter((href): href is string => !!href && href.startsWith('/'))

    expect(internalHrefs.length).toBeGreaterThan(0)
    for (const href of internalHrefs) {
      expect(routes.has(href)).toBe(true)
    }
  })

  test('links Resources only to pages this app actually serves', () => {
    render(<PublicFooter />)
    expect(screen.getByText('helpCenter').closest('a')).toHaveAttribute('href', '/support')
  })
})
