/**
 * @jest-environment jsdom
 *
 * A card of a public entity archive links its item by slug, the URL the item's public page answers (`/posts/<slug>` in
 * the blog template). By id the link reached no item page: once the archive answers only at the entity's URL (#540),
 * that link and its prefetch were a 404.
 */
import { render } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))

import { PublicEntityCard } from '@/core/components/public/entities/PublicEntityCard'

const href = (data: Record<string, unknown>) =>
  render(<PublicEntityCard entityConfig={null} entitySlug="posts" data={data} />).container.querySelector('a')?.getAttribute('href')

test('an item with a slug is linked by its slug', () => {
  expect(href({ id: 'post-1', slug: 'why-typescript-won', title: 'Why TypeScript Won' })).toBe('/posts/why-typescript-won')
})

test('an item without a slug keeps its id', () => {
  expect(href({ id: 'post-1', title: 'Untitled' })).toBe('/posts/post-1')
})
