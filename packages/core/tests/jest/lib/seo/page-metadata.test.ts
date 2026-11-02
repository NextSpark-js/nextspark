/**
 * Metadata of the public pages (#365): a canonical link and Open Graph tags next to the title and description, resolved
 * against the app URL the public layout declares as `metadataBase`.
 */
jest.mock('@nextsparkjs/core/lib/config/public-config-client', () => ({ APP_NAME: 'Test App' }))
jest.mock('next-intl/server', () => ({ getMessages: async () => ({}) }))
jest.mock('next-intl', () => ({ NextIntlClientProvider: () => null }))
jest.mock('@nextsparkjs/core/components/public/entities/PublicEntityGrid', () => ({ PublicEntityGrid: () => null }))

import { resolveAppUrl } from '../../../../src/lib/utils/base-url'
import { pageMetadata } from '../../../../src/lib/seo/page-metadata'
import { defaultMetadata } from '../../../../src/routes/_internal/public-layout'
import { createPublicArchiveMetadata } from '../../../../src/routes/_internal/public-archive-route'
import type { EntityConfig } from '../../../../src/lib/entities/types'

describe('pageMetadata', () => {
  it('carries the canonical path and repeats title and description in Open Graph', () => {
    expect(pageMetadata({ title: 'Support', description: 'Get help', path: '/support' })).toEqual({
      title: 'Support',
      description: 'Get help',
      alternates: { canonical: '/support' },
      openGraph: { type: 'website', siteName: 'Test App', title: 'Support', description: 'Get help', url: '/support' },
    })
  })
})

describe('public layout defaults', () => {
  it('resolve the relative canonical against the app URL and set the Open Graph defaults', () => {
    expect(defaultMetadata.metadataBase).toBeInstanceOf(URL)
    expect(defaultMetadata.metadataBase?.href).toBe(new URL(resolveAppUrl()).href)
    expect(defaultMetadata.openGraph).toMatchObject({ type: 'website', siteName: 'Test App' })
  })
})

describe('createPublicArchiveMetadata', () => {
  const entity = (access: Record<string, unknown>) =>
    ({ slug: 'posts', names: { singular: 'Post', plural: 'Posts' }, access }) as unknown as EntityConfig

  it('puts the canonical at the entity basePath, or at its slug without one', async () => {
    const withBase = await createPublicArchiveMetadata(entity({ basePath: '/blog' }))()
    expect(withBase.alternates?.canonical).toBe('/blog')
    expect(withBase.openGraph?.title).toBe('Posts | Test App')
    expect((await createPublicArchiveMetadata(entity({}))()).alternates?.canonical).toBe('/posts')
  })
})
