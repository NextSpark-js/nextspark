/**
 * @jest-environment jsdom
 *
 * #532: the devtools nav shows each item as its title, with the description as the link's tooltip, so the list fits a 900px
 * window.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

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
jest.mock('next/navigation', () => ({ usePathname: () => '/devtools' }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))

import { DevtoolsNav } from '@/core/components/devtools/DevtoolsNav'
import en from '@/core/messages/en/index'

afterEach(cleanup)

describe('DevtoolsNav', () => {
  test('an item is its title, and its description is the tooltip', () => {
    render(<DevtoolsNav pluginItems={[{ href: '/devtools/plugins/x', label: 'Plugin X', description: 'Does X', icon: 'Puzzle' } as never]} />)
    expect(screen.queryByText(en.devtools.nav.configDescription)).toBeNull()
    expect(screen.getByText(en.devtools.nav.config).closest('a')).toHaveAttribute('title', en.devtools.nav.configDescription)
    expect(screen.queryByText('Does X')).toBeNull()
    expect(screen.getByText('Plugin X').closest('a')).toHaveAttribute('title', 'Does X')
  })
})
