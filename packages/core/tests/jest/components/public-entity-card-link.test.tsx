/**
 * The cards of a public archive link an item to the URL its page answers, `<basePath>/<slug>` (#573): `/blog/<slug>` for
 * posts served under `/blog`, where `/posts/<id>` was a 404 and a failed prefetch on every load.
 */
import { render } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => 'en' }))

import { PublicEntityCard } from '@/core/components/public/entities/PublicEntityCard'

const href = (props: { basePath?: string; entityConfig?: unknown }, data: Record<string, unknown>) =>
  render(<PublicEntityCard entityConfig={(props.entityConfig ?? null) as never} entitySlug="posts" basePath={props.basePath} data={data} />).container
    .querySelector('a')
    ?.getAttribute('href')

test('an item of an entity served under a base path links to <basePath>/<slug>', () => {
  expect(href({ basePath: '/blog' }, { id: 'post-1', slug: 'why-typescript-won', title: 'Why' })).toBe('/blog/why-typescript-won')
})

test('an entity served at the site root (an empty base path) links to /<slug>', () => {
  expect(href({ basePath: '' }, { id: 'p1', slug: 'about' })).toBe('/about')
})

test('an entity with no base path links to /<entity>/<slug>, and by id when the item has no slug', () => {
  expect(href({}, { id: 'post-1', slug: 'a-post' })).toBe('/posts/a-post')
  expect(href({}, { id: 'post-1', title: 'Untitled' })).toBe('/posts/post-1')
  expect(href({ basePath: '/blog' }, { id: 'post-1' })).toBe('/blog/post-1')
})

test('a nested slug keeps its levels', () => {
  expect(href({ basePath: '/qa' }, { id: 'x', slug: 'block/home' })).toBe('/qa/block/home')
})
