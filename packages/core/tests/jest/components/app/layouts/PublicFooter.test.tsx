/**
 * @jest-environment jsdom
 *
 * PublicFooter — the Resources column must never link to a page nothing
 * serves (#200 docs review: /docs/api had no equivalent left after the docs
 * system moved to the public/superadmin split).
 */
import { render, screen } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('@/core/lib/test', () => ({ sel: (key: string) => key }))

import { PublicFooter } from '@/core/components/app/layouts/PublicFooter'

describe('PublicFooter', () => {
  test('links Resources to real pages only, none of them /docs/api', () => {
    render(<PublicFooter />)

    for (const name of ['helpCenter', 'status', 'changelog']) {
      expect(screen.getByText(name).closest('a')).toHaveAttribute('href', expect.not.stringMatching(/^\/docs\/api$/))
    }
    expect(screen.queryByText('apiDocs')).toBeNull()

    const hrefs = screen.getAllByRole('link').map(link => link.getAttribute('href'))
    expect(hrefs).not.toContain('/docs/api')
  })
})
