/**
 * @jest-environment node
 *
 * DELETE /api/v1/media/:id removes the file through the driver; GET /api/v1/media/files/:name
 * serves the local driver's files and nothing else.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { afterAll, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockGetById = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockSoftDelete = jest.fn<(...args: unknown[]) => Promise<boolean>>()
const mockSelectStorageDriver = jest.fn<() => unknown>()

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: async () => ({ success: true, user: { id: 'user-1' } }),
  createAuthFailureResponse: jest.fn(),
  resolveTeamContext: async () => 'team-1',
}))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown) => Response.json(data),
  createApiError: (message: string, status: number) => Response.json({ message }, { status }),
  readJsonObject: jest.fn(),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({ checkPermission: async () => true }))
jest.mock('@nextsparkjs/core/lib/services/media.service', () => ({
  MediaService: { getById: mockGetById, softDelete: mockSoftDelete },
}))
jest.mock('@nextsparkjs/core/lib/media/storage', () => ({
  ...jest.requireActual<object>('@nextsparkjs/core/lib/media/storage'),
  selectStorageDriver: mockSelectStorageDriver,
}))

import { DELETE } from '@/app/api/v1/media/[id]/route'
import { GET as getFile } from '@/app/api/v1/media/files/[name]/route'
import { LocalStorageDriver } from '@/core/lib/media/storage/local'

// setup.ts swaps Response and Headers for mocks; the files route streams a real body
const outer = require('vm').runInThisContext('globalThis')
Object.assign(global, { Response: outer.Response, Headers: outer.Headers })

const URL_ = 'https://cdn.example.org/uploads/1_abc.png'
const remove = () => DELETE({} as never, { params: Promise.resolve({ id: 'media-1' }) })

describe('DELETE /api/v1/media/:id', () => {
  const driver = { name: 's3', put: jest.fn(), delete: jest.fn<(url: string) => Promise<void>>() }
  beforeEach(() => {
    jest.clearAllMocks()
    mockSelectStorageDriver.mockReturnValue({ driver, developmentFallback: false })
    mockGetById.mockResolvedValue({ id: 'media-1', url: URL_ })
    mockSoftDelete.mockResolvedValue(true)
    driver.delete.mockResolvedValue(undefined)
  })

  it('soft-deletes the record and removes its file', async () => {
    expect((await remove()).status).toBe(200)
    expect(mockSoftDelete).toHaveBeenCalledWith('media-1', 'user-1', 'team-1')
    expect(driver.delete).toHaveBeenCalledWith(URL_)
  })

  it('removes nothing when the record is not found or already deleted', async () => {
    mockGetById.mockResolvedValue(null)
    expect((await remove()).status).toBe(404)
    mockGetById.mockResolvedValue({ id: 'media-1', url: URL_ })
    mockSoftDelete.mockResolvedValue(false)
    expect((await remove()).status).toBe(404)
    expect(driver.delete).not.toHaveBeenCalled()
  })

  it('still answers 200 when storage fails, and logs it', async () => {
    driver.delete.mockRejectedValue(new Error('S3 DELETE failed with status 500'))
    const error = jest.spyOn(console, 'error').mockImplementation(() => {})
    expect((await remove()).status).toBe(200)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('works without a configured driver', async () => {
    mockSelectStorageDriver.mockReturnValue({ driver: null, message: 'x', details: {} })
    expect((await remove()).status).toBe(200)
  })
})

describe('GET /api/v1/media/files/:name', () => {
  const root = mkdtempSync(join(tmpdir(), 'ns-files-route-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  const NAME = '1700000000000_0123456789abcdef0123456789abcdef.png'
  writeFileSync(join(root, NAME), Buffer.from([0x89, 0x50, 0x4e, 0x47]))
  const get = (name: string, range?: string) =>
    getFile({ headers: new Headers(range ? { range } : {}) } as never, { params: Promise.resolve({ name }) })

  it('serves a local driver file with its type and nosniff', async () => {
    mockSelectStorageDriver.mockReturnValue({ driver: new LocalStorageDriver(root), developmentFallback: false })
    const response = await get(NAME)
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('image/png')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect((await get(NAME, 'bytes=0-1')).status).toBe(206)
  })

  it('answers 404 for a traversal attempt', async () => {
    mockSelectStorageDriver.mockReturnValue({ driver: new LocalStorageDriver(join(root, 'sub')), developmentFallback: false })
    expect((await get(`../${NAME}`)).status).toBe(404)
    expect((await get('..%2F' + NAME)).status).toBe(404)
  })

  it('answers 404 with another driver or the development fallback', async () => {
    mockSelectStorageDriver.mockReturnValue({ driver: { name: 's3' }, developmentFallback: false })
    expect((await get(NAME)).status).toBe(404)
    mockSelectStorageDriver.mockReturnValue({ driver: new LocalStorageDriver(root), developmentFallback: true })
    expect((await get(NAME)).status).toBe(404)
    mockSelectStorageDriver.mockReturnValue({ driver: null, message: 'x', details: {} })
    expect((await get(NAME)).status).toBe(404)
  })
})
