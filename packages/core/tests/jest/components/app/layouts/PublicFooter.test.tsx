/**
 * @jest-environment jsdom
 *
 * PublicFooter — the Resources column must only link to pages this app
 * actually serves; a dead entry there is a silent 404 nothing else catches.
 */
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (key: string) => key }))

import { PublicFooter } from '@/core/components/app/layouts/PublicFooter'

describe('PublicFooter', () => {
  test('links Resources only to pages this app actually serves', () => {
    render(<PublicFooter />)

    // /support is a real page (apps/dev/app/(templates)/(public)/support).
    // /status, /changelog and /docs/api are not served by anything.
    expect(screen.getByText('helpCenter').closest('a')).toHaveAttribute('href', '/support')
    expect(screen.queryByText('status')).toBeNull()
    expect(screen.queryByText('changelog')).toBeNull()
    expect(screen.queryByText('apiDocs')).toBeNull()

    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'))
    expect(hrefs).not.toContain('/docs/api')
    expect(hrefs).not.toContain('/status')
    expect(hrefs).not.toContain('/changelog')
  })
})
