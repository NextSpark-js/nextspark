/**
 * @jest-environment jsdom
 *
 * The devtools dashboard links every section the sidebar lists (from the same list, plugins included) and no
 * longer shows the unexplained "Hierarchy Level" (#503).
 */
import { describe, test, expect, jest } from '@jest/globals'
import type { ReactElement } from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next-intl/server', () => ({ getTranslations: async () => (key: string) => key }))
jest.mock('@nextsparkjs/core/lib/plugins/nav-items', () => ({
  getAllPluginNavItems: () => [{ href: '/devtools/my-plugin', label: 'My plugin', description: 'Plugin tools', icon: 'Star' }],
}))

import DevHomePage from '@/app/devtools/page'
import { DEVTOOLS_NAV_ITEMS, DEVTOOLS_ROOT } from '@/core/components/devtools/devtools-nav'

// the page is a server component: render what its async content resolves to
async function renderPage() {
  const content = (DevHomePage() as ReactElement<{ children: ReactElement<object> }>).props.children
  render(await (content.type as (props: object) => Promise<ReactElement>)(content.props))
}

describe('devtools dashboard (#503)', () => {
  test('links every sidebar section except itself, then the plugin pages', async () => {
    await renderPage()

    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(hrefs).toEqual([...DEVTOOLS_NAV_ITEMS.map((i) => i.href).filter((h) => h !== DEVTOOLS_ROOT), '/devtools/my-plugin'])
  })

  test('does not show the hierarchy level', async () => {
    await renderPage()
    expect(screen.queryByText('home.hierarchy')).toBeNull()
    expect(screen.queryByText('100')).toBeNull()
  })
})
