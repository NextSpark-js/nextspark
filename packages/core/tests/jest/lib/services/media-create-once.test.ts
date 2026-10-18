import { MediaService } from '@/core/lib/services/media.service'
import { getTransactionClient } from '@/core/lib/db'

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: jest.fn(),
  getTransactionClient: jest.fn(),
}))

const tx = { query: jest.fn(), queryOne: jest.fn(), commit: jest.fn(), rollback: jest.fn() }
const mockGetTransactionClient = getTransactionClient as jest.MockedFunction<typeof getTransactionClient>
const URL_ = 'https://cdn.example.org/uploads/1_abc.png'
const DATA = { filename: 'a.png', fileSize: 12, mimeType: 'image/png', width: 4, height: 3 }

beforeEach(() => {
  jest.clearAllMocks()
  mockGetTransactionClient.mockResolvedValue(tx as never)
})

describe('MediaService.createOnce', () => {
  it('locks the URL, runs prepare, inserts and commits in the user RLS context', async () => {
    tx.queryOne.mockResolvedValueOnce(null).mockResolvedValueOnce({ id: 'media-1', url: URL_ })
    const prepare = jest.fn(async () => DATA)

    const media = await MediaService.createOnce('user-1', 'team-1', URL_, prepare)

    expect(media).toEqual({ id: 'media-1', url: URL_ })
    expect(mockGetTransactionClient).toHaveBeenCalledWith('user-1')
    expect(tx.query).toHaveBeenCalledWith('SELECT pg_advisory_xact_lock(hashtext($1))', [`media-url:${URL_}`])
    expect(tx.queryOne.mock.calls[0]).toEqual(['SELECT 1 FROM "media" WHERE url = $1 LIMIT 1', [URL_]])
    expect(tx.queryOne.mock.calls[1][0]).toContain('INSERT INTO "media"')
    expect(tx.queryOne.mock.calls[1][1]).toEqual(['user-1', 'team-1', URL_, 'a.png', 12, 'image/png', 4, 3, null, null, null])
    expect(prepare).toHaveBeenCalledTimes(1)
    expect(tx.commit).toHaveBeenCalled()
    // The lock comes before the check, the check before prepare
    expect(tx.query.mock.invocationCallOrder[0]).toBeLessThan(tx.queryOne.mock.invocationCallOrder[0])
    expect(tx.queryOne.mock.invocationCallOrder[0]).toBeLessThan(prepare.mock.invocationCallOrder[0])
  })

  it('returns null without running prepare when the URL already has a record', async () => {
    tx.queryOne.mockResolvedValueOnce({ '?column?': 1 })
    const prepare = jest.fn(async () => DATA)

    expect(await MediaService.createOnce('user-1', 'team-1', URL_, prepare)).toBeNull()
    expect(prepare).not.toHaveBeenCalled()
    expect(tx.rollback).toHaveBeenCalled()
    expect(tx.commit).not.toHaveBeenCalled()
  })

  it('rolls back and rethrows when prepare fails', async () => {
    tx.queryOne.mockResolvedValueOnce(null)
    await expect(MediaService.createOnce('user-1', 'team-1', URL_, async () => { throw new Error('rejected') })).rejects.toThrow('rejected')
    expect(tx.rollback).toHaveBeenCalled()
    expect(tx.commit).not.toHaveBeenCalled()
  })

  it('requires user and team', async () => {
    await expect(MediaService.createOnce('', 'team-1', URL_, async () => DATA)).rejects.toThrow('User ID is required')
    await expect(MediaService.createOnce('user-1', '', URL_, async () => DATA)).rejects.toThrow('Team ID is required')
  })
})
