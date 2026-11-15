/**
 * #464: the search boxes of the superadmin users, teams and subscriptions lists (one shared SearchInput) and of the media
 * library stop at the API's cap, so a term of 201 characters cannot be typed and the list never answers
 * 400 SEARCH_TERM_TOO_LONG. The browser counts UTF-16 units, so it never lets through more than the cap in characters.
 */
import { render } from '@testing-library/react'
import { SearchInput } from '@/core/components/superadmin/filters/SearchInput'
import { MediaToolbar } from '@/core/components/media/MediaToolbar'
import { MAX_SEARCH_TERM_LENGTH } from '@/core/lib/utils/like-pattern'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))

describe('search inputs carry the API cap as maxLength (#464)', () => {
  it('the superadmin SearchInput', () => {
    const { container } = render(<SearchInput value="" onChange={() => {}} />)
    expect(container.querySelector('input')?.maxLength).toBe(MAX_SEARCH_TERM_LENGTH)
  })

  it('the media toolbar search', () => {
    const { container } = render(
      <MediaToolbar
        searchQuery=""
        onSearchChange={() => {}}
        typeFilter="all"
        onTypeFilterChange={() => {}}
        sortBy="createdAt"
        sortDir="desc"
        onSortChange={() => {}}
        viewMode="grid"
        onViewModeChange={() => {}}
      />
    )
    expect(container.querySelector('input[type="text"]')?.getAttribute('maxlength')).toBe(String(MAX_SEARCH_TERM_LENGTH))
  })
})
