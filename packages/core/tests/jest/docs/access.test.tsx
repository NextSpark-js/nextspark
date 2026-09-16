/**
 * @jest-environment jsdom
 *
 * Docs access: `docs.publicAccess` decides whether /docs needs a session and
 * `docs.public` holds that category's sidebar settings. The boolean
 * `docs.public` of app configs written before publicAccess still means the
 * same as publicAccess, and must not be read as sidebar settings.
 */

let mockThemeAppConfig: Record<string, unknown> | undefined

jest.mock('@nextsparkjs/registries/theme-registry', () => ({
  get THEME_REGISTRY() {
    return { default: { appConfig: mockThemeAppConfig } }
  },
}))

jest.mock('next/navigation', () => ({
  usePathname: () => '/docs/overview/introduction',
}))

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

import { render, screen } from '@testing-library/react'
import { getPublicDocsCategory, isDocsPublic, legacyDocsAccessMessage } from '@/core/lib/docs/access'
import { DocsSidebar } from '@/core/components/docs/docs-sidebar'

const CATEGORY = { enabled: true, open: true, label: 'Guides' }

describe('isDocsPublic', () => {
  test.each([
    [{ publicAccess: false, public: CATEGORY }, false],
    [{ publicAccess: false }, false],
    [{ public: false }, false],
    [{ publicAccess: true, public: false }, false],
    [{ publicAccess: true, public: CATEGORY }, true],
    [{ public: CATEGORY }, true],
    [{ public: true }, true],
    [{}, true],
    [undefined, true],
  ])('%j is public: %s', (docs, expected) => {
    expect(isDocsPublic(docs)).toBe(expected)
  })
})

describe('getPublicDocsCategory', () => {
  test('returns the sidebar settings under docs.public', () => {
    expect(getPublicDocsCategory({ publicAccess: false, public: CATEGORY })).toEqual(CATEGORY)
  })

  test.each([[{ public: false }], [{ public: true }], [{}], [undefined]])('has none for %j', docs => {
    expect(getPublicDocsCategory(docs)).toBeUndefined()
  })
})

describe('legacyDocsAccessMessage', () => {
  test('names the setting to write instead of the access boolean', () => {
    expect(legacyDocsAccessMessage({ public: false })).toContain('docs.publicAccess: false')
  })

  test.each([[{ publicAccess: false, public: CATEGORY }], [{ public: CATEGORY }], [undefined]])('is null for %j', docs => {
    expect(legacyDocsAccessMessage(docs)).toBeNull()
  })
})

describe('DocsSidebar', () => {
  const sections = [
    {
      slug: 'overview',
      title: 'Overview',
      order: 1,
      source: 'public' as const,
      pages: [{ slug: 'introduction', title: 'Introduction', order: 1, path: 'x.md', source: 'public' as const }],
    },
  ]

  test('still lists the docs when docs.public is the older access boolean', () => {
    mockThemeAppConfig = { docs: { public: false } }

    render(<DocsSidebar sections={sections} />)

    expect(screen.getByText('Overview')).toBeTruthy()
  })

  test('uses the label from the public category settings', () => {
    mockThemeAppConfig = { docs: { publicAccess: false, public: CATEGORY } }

    render(<DocsSidebar sections={sections} />)

    expect(screen.getByText('Guides')).toBeTruthy()
  })

  test('renders nothing when the public category is disabled', () => {
    mockThemeAppConfig = { docs: { publicAccess: true, public: { ...CATEGORY, enabled: false } } }

    const { container } = render(<DocsSidebar sections={sections} />)

    expect(container.innerHTML).toBe('')
  })
})
