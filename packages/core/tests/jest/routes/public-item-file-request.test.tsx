/**
 * A request for a file (/favicon.ico, /robots.txt) that reaches the public item route ([slug], [...slug]) is answered
 * with notFound() before anything is read: only known static-file extensions count, a slug may contain a dot.
 */
const notFound = jest.fn(() => {
  throw new Error('NEXT_NOT_FOUND')
})
const fetchPublishedItem = jest.fn()
jest.mock('next/navigation', () => ({ notFound: () => notFound() }))
jest.mock('@nextsparkjs/core/components/public/pageBuilder', () => ({ PageRenderer: () => null }))
jest.mock('../../../src/routes/_internal/public-entity-shared', () => ({
  fetchPublishedItem: (...args: unknown[]) => fetchPublishedItem(...args),
  getResolvedBlocks: jest.fn(),
}))

import { createPublicItemRoute, createPublicItemMetadata } from '../../../src/routes/_internal/public-item-route'
import type { EntityConfig } from '../../../src/lib/entities/types'

const config = { slug: 'pages' } as unknown as EntityConfig
const props = (slug: string | string[]) => ({ params: Promise.resolve({ slug }), searchParams: Promise.resolve({}) })

beforeEach(() => {
  notFound.mockClear()
  fetchPublishedItem.mockReset().mockResolvedValue(null)
})

describe('public item route and a request for a file', () => {
  it.each(['favicon.ico', 'robots.txt', 'Apple-Touch-Icon.PNG', ['assets', 'logo.png']])('answers notFound() for %j without reading the database', async slug => {
    await expect(createPublicItemRoute(config)(props(slug))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(fetchPublishedItem).not.toHaveBeenCalled()
  })

  it('does not render a project template for it', async () => {
    const Template = jest.fn(() => null)
    await expect(createPublicItemRoute(config, Template)(props('favicon.ico'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(Template).not.toHaveBeenCalled()
  })

  it.each(['release-1.0', 'v2.5', 'node-18.x', ['guides', 'v1.2']])('still reads the database and renders the item for the slug %j', async slug => {
    fetchPublishedItem.mockResolvedValue({ id: '1', title: 'T', slug: 'x', blocks: [], locale: 'en' })
    const element = await createPublicItemRoute(config)(props(slug))
    expect(notFound).not.toHaveBeenCalled()
    expect(element).toBeTruthy()
    expect(fetchPublishedItem).toHaveBeenCalledWith(config, Array.isArray(slug) ? slug.join('/') : slug)
  })

  it('runs a project template for a slug with a dot', async () => {
    const Template = jest.fn(() => null)
    const element = (await createPublicItemRoute(config, Template)(props('release-1.0'))) as { type: unknown; props: { params: Promise<{ slug: string }> } }
    expect(element.type).toBe(Template)
    expect(await element.props.params).toEqual({ slug: 'release-1.0' })
  })

  it('reads metadata for a slug with a dot', async () => {
    await createPublicItemMetadata(config)({ params: Promise.resolve({ slug: 'v2.5' }) })
    expect(fetchPublishedItem).toHaveBeenCalledWith(config, 'v2.5')
  })

  it('leaves a page slug alone', async () => {
    await expect(createPublicItemRoute(config)(props('about'))).rejects.toThrow('NEXT_NOT_FOUND')
    expect(fetchPublishedItem).toHaveBeenCalledWith(config, 'about')
  })

  it('has no metadata to look up for a file', async () => {
    expect(await createPublicItemMetadata(config)({ params: Promise.resolve({ slug: 'favicon.ico' }) })).toEqual({ title: 'Not Found' })
    expect(fetchPublishedItem).not.toHaveBeenCalled()
  })
})
