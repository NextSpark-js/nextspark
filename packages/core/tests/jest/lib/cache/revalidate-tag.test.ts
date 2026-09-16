import { revalidateTag as nextRevalidateTag } from 'next/cache'
import { revalidateTag } from '@/core/lib/cache/revalidate-tag'

jest.mock('next/cache', () => ({
  revalidateTag: jest.fn(),
}))

const nextRevalidateTagMock = nextRevalidateTag as unknown as jest.Mock

describe('revalidateTag', () => {
  beforeEach(() => {
    nextRevalidateTagMock.mockClear()
  })

  it('passes the profile Next 16 requires', () => {
    revalidateTag('campaign-stats')

    expect(nextRevalidateTagMock).toHaveBeenCalledTimes(1)
    expect(nextRevalidateTagMock.mock.calls[0]).toHaveLength(2)
    expect(nextRevalidateTagMock).toHaveBeenCalledWith('campaign-stats', { expire: 0 })
  })

  it('expires immediately rather than serving stale data', () => {
    revalidateTag('posts')

    const [, profile] = nextRevalidateTagMock.mock.calls[0]
    // A named profile such as 'max' would make Next 16 revalidate in the
    // background and keep serving the old entry; expire 0 takes the same branch
    // as Next 15's profile-less call.
    expect(typeof profile).toBe('object')
    expect(profile).toEqual({ expire: 0 })
  })
})
