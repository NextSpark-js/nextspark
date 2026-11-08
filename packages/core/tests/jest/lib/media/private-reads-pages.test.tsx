/**
 * @jest-environment node
 */
// #361: public pages sign the files of the page's team (and only those), per request, and nothing changes
// with the private mode off.
import * as React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'

const mockQueryWithRLS = jest.fn()
const mockQuery = jest.fn()
jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(), queryWithRLS: (...args: unknown[]) => mockQueryWithRLS(...args), mutateWithRLS: jest.fn(),
  query: (...args: unknown[]) => mockQuery(...args), getTransactionClient: jest.fn(),
}))
const mockConnection = jest.fn(async () => {})
jest.mock('next/server', () => ({ connection: () => mockConnection() }))
// A block that shows what it was given
jest.mock('@/core/lib/blocks/loader.server', () => ({
  getBlockComponentSSR: () => ({ image, items }: { image?: unknown; items?: { src: string }[] }) =>
    React.createElement('div', { 'data-image': typeof image === 'string' ? image : (image as { url: string })?.url, 'data-items': (items ?? []).map(i => i.src).join('|') }),
}))

// setup.ts swaps crypto.subtle for a mock; aws4fetch needs the real one
const outer = require('vm').runInThisContext('globalThis')
;(global.crypto as { subtle: SubtleCrypto }).subtle = outer.crypto.subtle

import { PageRenderer } from '@/core/components/public/pageBuilder/PageRenderer'
import { signBlocksMedia } from '@/core/lib/media/storage/display'
import { MediaService } from '@/core/lib/services/media.service'

const NAME = (n: string) => `17000000000${n}_0123456789abcdef0123456789abcdef.png`
const mine = `https://s3.example.org/shared/uploads/${NAME('01')}`
const second = `https://s3.example.org/shared/uploads/${NAME('02')}`
const foreignTeam = `https://s3.example.org/shared/uploads/${NAME('03')}`
const external = 'https://elsewhere.example.org/photo.png'

const ENV = {
  STORAGE_DRIVER: 's3', S3_ENDPOINT: 'https://s3.example.org', S3_REGION: 'us-east-1', S3_BUCKET: 'shared',
  S3_ACCESS_KEY_ID: 'AKIDSECRETVALUE1', S3_SECRET_ACCESS_KEY: 'very-secret-value-2', S3_PUBLIC_URL: 'https://cdn.example.org/shared',
  S3_FORCE_PATH_STYLE: 'true',
}
const saved = { ...process.env }
const block = (props: Record<string, unknown>) => ({ id: 'b1', blockSlug: 'x', props })

beforeEach(() => {
  Object.assign(process.env, ENV, { STORAGE_S3_PRIVATE: 'true' })
  mockConnection.mockClear()
  mockQuery.mockReset()
  // The database knows these two as active files of the team asked for
  mockQuery.mockImplementation(async (_sql: string, [urls, team]: [string[], string]) => ({ rows: team === 'team-a' ? urls.filter(u => [mine, second].includes(u)).map(url => ({ url })) : [] }))
  mockQueryWithRLS.mockReset()
})
afterEach(() => { process.env = { ...saved } })

describe('signBlocksMedia', () => {
  it('signs own files of the team at any depth, in strings and in { mediaId, url } references', async () => {
    const blocks = [block({ image: { mediaId: 'm1', url: mine }, items: [{ src: second }, { src: external }], title: 'plain text' })]
    const [signed] = await signBlocksMedia(blocks, 'team-a')
    const props = signed.props as { image: { mediaId: string; url: string }; items: { src: string }[]; title: string }
    expect(props.image.mediaId).toBe('m1')
    expect(props.image.url.startsWith(mine + '?')).toBe(true)
    expect(props.image.url).toContain('X-Amz-Signature=')
    expect(props.items[0].src).toContain('X-Amz-Signature=')
    expect(props.items[1].src).toBe(external)
    expect(props.title).toBe('plain text')
    // the input is untouched: what is stored stays canonical
    expect((blocks[0].props.image as { url: string }).url).toBe(mine)
  })

  it('looks the files up in the page team with the service connection, not a user', async () => {
    await signBlocksMedia([block({ image: mine })], 'team-a')
    expect(mockQuery).toHaveBeenCalledTimes(1)
    expect(mockQuery.mock.calls[0][0]).toContain(`"teamId" = $2`)
    expect(mockQuery.mock.calls[0][0]).toContain(`status = 'active'`)
    expect(mockQuery.mock.calls[0][1]).toEqual([[mine], 'team-a'])
    expect(mockQueryWithRLS).not.toHaveBeenCalled()
  })

  it("leaves a file of another team as the canonical URL", async () => {
    const [out] = await signBlocksMedia([block({ image: foreignTeam })], 'team-a')
    expect(out.props.image).toBe(foreignTeam)
    const [other] = await signBlocksMedia([block({ image: mine })], 'team-b')
    expect(other.props.image).toBe(mine)
  })

  it('returns the very same value, with no query, when the mode is off', async () => {
    delete process.env.STORAGE_S3_PRIVATE
    const blocks = [block({ image: mine })]
    expect(await signBlocksMedia(blocks, 'team-a')).toBe(blocks)
    expect(mockQuery).not.toHaveBeenCalled()
  })

  it('keeps text such as constructor, toString and __proto__, and still signs the file next to it', async () => {
    const texts = ['constructor', 'toString', '__proto__', 'hasOwnProperty']
    const [out] = await signBlocksMedia([block({ image: mine, title: 'constructor', subtitle: 'toString', list: texts, note: '__proto__' })], 'team-a')
    const props = out.props as { image: string; title: string; subtitle: string; list: string[]; note: string }
    expect(props.image).toContain('X-Amz-Signature=')
    expect([props.title, props.subtitle, props.note]).toEqual(['constructor', 'toString', '__proto__'])
    expect(props.list).toEqual(texts)
  })

  it('does not query when no URL is an own object', async () => {
    const blocks = [block({ image: external, title: 'x' })]
    expect((await signBlocksMedia(blocks, 'team-a'))[0].props.image).toBe(external)
    expect(mockQuery).not.toHaveBeenCalled()
  })
})

describe('MediaService.teamUrls', () => {
  it('runs under the user RLS context when there is a user, and answers the matching URLs', async () => {
    mockQueryWithRLS.mockResolvedValue([{ url: mine }])
    expect([...(await MediaService.teamUrls([mine, second], 'team-a', 'user-a'))]).toEqual([mine])
    expect(mockQueryWithRLS).toHaveBeenCalledWith(expect.stringContaining(`"teamId" = $2`), [[mine, second], 'team-a'], 'user-a')
  })
})

describe('PageRenderer with a private bucket', () => {
  const page = (extra: Record<string, unknown> = {}) => ({ id: 'p1', title: 'T', slug: 's', locale: 'en', blocks: [block({ image: mine })], ...extra })

  it('renders per request (not from a cache) with fresh signed URLs for the page team', async () => {
    const html = renderToStaticMarkup(await PageRenderer({ page: page({ teamId: 'team-a' }) }))
    expect(mockConnection).toHaveBeenCalledTimes(1)
    expect(html).toContain('X-Amz-Signature=')
    expect(html).toContain(mine + '?')
  })

  it('shows a file of another team unsigned', async () => {
    const html = renderToStaticMarkup(await PageRenderer({ page: page({ teamId: 'team-b' }) }))
    expect(html).not.toContain('X-Amz-Signature=')
  })

  it('signs nothing for a page without a team', async () => {
    const html = renderToStaticMarkup(await PageRenderer({ page: page() }))
    expect(html).not.toContain('X-Amz-Signature=')
    expect(mockConnection).not.toHaveBeenCalled()
  })

  it('is the same HTML as before, and not dynamic, with the mode off', async () => {
    delete process.env.STORAGE_S3_PRIVATE
    const html = renderToStaticMarkup(await PageRenderer({ page: page({ teamId: 'team-a' }) }))
    expect(mockConnection).not.toHaveBeenCalled()
    expect(mockQuery).not.toHaveBeenCalled()
    expect(html).toContain(`data-image="${mine}"`)
    expect(html).not.toContain('X-Amz-')
  })
})
