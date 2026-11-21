/**
 * @jest-environment jsdom
 *
 * #531: a developer reaches /devtools from the superadmin sidebar (a superadmin is not offered the link), and each area
 * answers an unknown URL with its own not-found page, with the way back to its home.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

let mockRole = 'developer'

jest.mock('next-intl', () => {
  const read = (namespace: string, key: string) =>
    `${namespace}.${key}`.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), require('../../../../src/messages/en/index').default)
  return {
    useLocale: () => 'en',
    useTranslations: (namespace: string) => (key: string) => {
      const value = read(namespace, key)
      if (typeof value !== 'string') throw new Error(`missing ${namespace}.${key}`)
      return value
    },
  }
})
jest.mock('next/navigation', () => ({ usePathname: () => '/superadmin', useRouter: () => ({ push: jest.fn() }), notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND') }) }))
jest.mock('@nextsparkjs/registries/plugin-registry.client', () => ({ getPluginNavItems: () => [] }))
jest.mock('@nextsparkjs/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: mockRole } } }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import { SuperadminSidebar } from '@/core/components/superadmin/layouts/SuperadminSidebar'
import DevtoolsNotFound from '@/core/routes/devtools/not-found'
import SuperadminNotFound from '@/core/routes/superadmin/not-found'
import DevtoolsUnknownPage from '@/core/routes/devtools/[...slug]/page'
import SuperadminUnknownPage from '@/core/routes/superadmin/[...slug]/page'
import en from '@/core/messages/en/index'

afterEach(() => {
  cleanup()
  mockRole = 'developer'
})

describe('the DevTools link of the superadmin sidebar', () => {
  test('a developer sees it, pointing at /devtools', () => {
    render(<SuperadminSidebar pluginItems={[]} />)
    expect(screen.getByLabelText(en.superadmin.sidebar.devtools.title)).toHaveAttribute('href', '/devtools')
  })

  test('a superadmin does not see it', () => {
    mockRole = 'superadmin'
    render(<SuperadminSidebar pluginItems={[]} />)
    expect(document.querySelector('a[href="/devtools"]')).toBeNull()
  })
})

describe('the not-found page of each area', () => {
  test('devtools names the problem and links back to /devtools', () => {
    render(<DevtoolsNotFound />)
    expect(screen.getByText(en.devtools.notFound.title)).toBeInTheDocument()
    expect(screen.getByText(en.devtools.notFound.back).closest('a')).toHaveAttribute('href', '/devtools')
  })

  test('superadmin names the problem and links back to /superadmin', () => {
    render(<SuperadminNotFound />)
    expect(screen.getByText(en.superadmin.notFound.title)).toBeInTheDocument()
    expect(screen.getByText(en.superadmin.notFound.back).closest('a')).toHaveAttribute('href', '/superadmin')
  })

  test('an unknown URL of each area ends in notFound(), which renders that page', () => {
    expect(() => DevtoolsUnknownPage()).toThrow('NEXT_NOT_FOUND')
    expect(() => SuperadminUnknownPage()).toThrow('NEXT_NOT_FOUND')
  })
})
