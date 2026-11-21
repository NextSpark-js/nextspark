/**
 * @jest-environment jsdom
 *
 * The Style Gallery uses the header of the other devtools pages (icon, title, subtitle) with no "Back to Dev Area"
 * button (#502).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'

// the screens keep their state in the URL (#519)
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/area', useSearchParams: () => new URLSearchParams() }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@nextsparkjs/core/components/superadmin/misc/ComponentGallery', () => ({ ComponentGallery: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/misc/ThemePreview', () => ({ ThemePreview: () => null }))
jest.mock('@nextsparkjs/core/components/superadmin/misc/FieldTypesGallery', () => ({ FieldTypesGallery: () => null }))

import DevStylePage from '@/app/devtools/style/page'

describe('Style Gallery page header', () => {
  test('has the title and no back button to the devtools dashboard (#502)', () => {
    render(<DevStylePage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('title')
    expect(screen.queryByText('back')).toBeNull()
    expect(screen.queryAllByRole('link').filter((a) => a.getAttribute('href') === '/devtools')).toEqual([])
  })
})
