/**
 * @jest-environment jsdom
 *
 * #505: on a phone-sized viewport the devtools header has a menu button that opens the navigation the sidebar
 * renders (one list, `DevtoolsNav`), with the devtools icon of the sidebar, and the menu closes when the page changes.
 */
import React from 'react'
import { render, screen, cleanup, fireEvent, within } from '@testing-library/react'

let mockPathname = '/devtools'

jest.mock('next-intl', () => {
  const read = (namespace: string, key: string) =>
    `${namespace}.${key}`.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), require('../../../../src/messages/en/index').default)
  return {
    useLocale: () => 'en',
    useMessages: () => require('../../../../src/messages/en/index').default,
    useTranslations: (namespace: string) => (key: string) => {
      const value = read(namespace, key)
      if (typeof value !== 'string') throw new Error(`missing ${namespace}.${key}`)
      return value
    },
  }
})
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname }))
jest.mock('@nextsparkjs/registries/plugin-registry.client', () => ({ getPluginNavItems: () => [] }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import { DevtoolsMobileHeader } from '@/core/components/devtools/DevtoolsMobileHeader'
import { DEVTOOLS_NAV_ITEMS } from '@/core/components/devtools/devtools-nav'
import en from '@/core/messages/en/index'

// jsdom has the element but not its methods: the `open` attribute is what a browser's showModal() and close() toggle
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', '') }
  HTMLDialogElement.prototype.close = function close() { this.removeAttribute('open') }
})

afterEach(() => {
  cleanup()
  mockPathname = '/devtools'
})

const menu = () => document.querySelector('[data-cy="devtools-mobile-menu"]') as HTMLDialogElement

describe('DevtoolsMobileHeader (#505)', () => {
  test('a menu button opens a drawer with every section of the sidebar, as links', () => {
    render(<DevtoolsMobileHeader pluginItems={[]} />)
    expect(menu().open).toBe(false)

    fireEvent.click(screen.getByLabelText(en.common.a11y.openNavigationMenu))

    expect(menu().open).toBe(true)
    const hrefs = within(menu()).getAllByRole('link').map((link) => link.getAttribute('href'))
    for (const item of DEVTOOLS_NAV_ITEMS) expect(hrefs).toContain(item.href)
  })

  test('plugin pages are in the menu too', () => {
    render(<DevtoolsMobileHeader pluginItems={[{ href: '/devtools/plugins/x', label: 'Plugin X', description: 'x' } as never]} />)
    expect(within(menu()).getByText('Plugin X').closest('a')).toHaveAttribute('href', '/devtools/plugins/x')
  })

  test('the header shows the devtools icon of the sidebar, not a filled square', () => {
    render(<DevtoolsMobileHeader pluginItems={[]} />)
    const header = document.querySelector('[data-cy="devtools-mobile-header"]') as HTMLElement
    expect(header.querySelector('svg.lucide-code')).not.toBeNull()
  })

  test('the menu closes when the page changes, and with its close button', () => {
    const { rerender } = render(<DevtoolsMobileHeader pluginItems={[]} />)
    fireEvent.click(screen.getByLabelText(en.common.a11y.openNavigationMenu))
    expect(menu().open).toBe(true)

    mockPathname = '/devtools/style'
    rerender(<DevtoolsMobileHeader pluginItems={[]} />)
    expect(menu().open).toBe(false)

    fireEvent.click(screen.getByLabelText(en.common.a11y.openNavigationMenu))
    fireEvent.click(within(menu()).getByLabelText(en.common.buttons.close))
    expect(menu().open).toBe(false)
  })
})
