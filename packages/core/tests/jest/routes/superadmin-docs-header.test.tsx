/**
 * @jest-environment jsdom
 *
 * #548: /superadmin/docs, and the page of a document, use the shared page header of the area (icon, title as the
 * page heading, subtitle) with the docs tree below it, instead of a header of their own.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key, getLocale: async () => 'en' }))
jest.mock('next/navigation', () => ({ usePathname: () => '/superadmin/docs', notFound: () => { throw new Error('NOT_FOUND') } }))
jest.mock('@nextsparkjs/registries/docs-registry', () => ({
  DOCS_REGISTRY: {
    superadmin: [{ slug: 'setup', title: 'Setup', pages: [{ slug: 'deploy', title: 'Deploy', path: 'docs/superadmin/setup/deploy.md' }] }],
  },
}))
jest.mock('../../../src/lib/docs/parser', () => ({
  parseMarkdownFile: async () => ({ metadata: { title: 'Deploy it', description: 'How' }, html: '<p>body</p>' }),
}))

import SuperadminDocsPage from '../../../src/routes/superadmin/docs/page'
import SuperadminDocsDetailPage from '../../../src/routes/superadmin/docs/[section]/[page]/page'

describe('superadmin docs', () => {
  test('the index has the shared header, with the tree and the documents below it', async () => {
    const { container } = render(await SuperadminDocsPage())
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('indexTitle')
    expect(screen.getByText('indexIntro')).toBeInTheDocument()
    expect(container.querySelector('.bg-red-100')).not.toBeNull()
    expect(screen.getByRole('navigation', { name: 'navigation' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Deploy' })).toBeInTheDocument()
  })

  test('a document has the same header, one page heading, and keeps the tree and its own title', async () => {
    render(await SuperadminDocsDetailPage({ params: Promise.resolve({ section: 'setup', page: 'deploy' }) }))
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1)
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('indexTitle')
    expect(screen.getByRole('heading', { level: 2, name: 'Deploy it' })).toBeInTheDocument()
    expect(screen.getByRole('navigation', { name: 'navigation' })).toBeInTheDocument()
  })
})
