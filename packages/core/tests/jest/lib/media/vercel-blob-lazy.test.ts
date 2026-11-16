/**
 * @jest-environment node
 */
import { describe, expect, it, jest } from '@jest/globals'

// The factory runs when @vercel/blob is first required (#478)
const blobLoads = jest.fn()
const mockPut = jest.fn<(...args: unknown[]) => Promise<{ url: string }>>()
const mockDel = jest.fn<(...args: unknown[]) => Promise<void>>()
jest.mock('@vercel/blob', () => {
  blobLoads()
  return { put: mockPut, del: mockDel }
})

import { selectStorageDriver } from '@/core/lib/media/storage'
import { VercelBlobStorageDriver } from '@/core/lib/media/storage/vercel-blob'

describe('@vercel/blob is loaded on first use', () => {
  it('not by importing the storage module or building the driver', () => {
    selectStorageDriver({ STORAGE_DRIVER: 'vercel-blob', BLOB_READ_WRITE_TOKEN: 'vercel_blob_x' } as NodeJS.ProcessEnv)
    new VercelBlobStorageDriver()
    expect(blobLoads).not.toHaveBeenCalled()
  })

  it('at the first put, and once', async () => {
    mockPut.mockResolvedValue({ url: 'https://store.public.blob.vercel-storage.com/uploads/temp/x.png' })
    const driver = new VercelBlobStorageDriver()
    const name = '1700000000000_0123456789abcdef0123456789abcdef.png'
    await driver.put(name, Buffer.from('x'), 'image/png')
    await driver.put(name, Buffer.from('x'), 'image/png')
    expect(blobLoads).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledTimes(2)
  })
})
