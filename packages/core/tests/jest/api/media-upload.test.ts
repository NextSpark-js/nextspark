import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockAuthenticateRequest = jest.fn()
const mockResolveTeamContext = jest.fn()
const mockCheckPermission = jest.fn()
const mockPut = jest.fn()
const mockCreateMedia = jest.fn()
const mockExtractImageDimensions = jest.fn()

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: mockAuthenticateRequest,
  createAuthFailureResponse: jest.fn(),
  resolveTeamContext: mockResolveTeamContext,
}))

jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown) => Response.json(data),
  createApiError: (message: string, status: number, details?: unknown, code?: string) => Response.json({ message, details, code }, { status }),
}))

jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))

jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({
  checkPermission: mockCheckPermission,
}))

jest.mock('@nextsparkjs/core/lib/config/config-sync', () => ({
  MEDIA_CONFIG: undefined,
}))

jest.mock('@nextsparkjs/core/lib/services/media.service', () => ({
  MediaService: { create: mockCreateMedia },
}))

jest.mock('@nextsparkjs/core/lib/media/utils', () => ({
  extractImageDimensions: mockExtractImageDimensions,
}))

jest.mock('@vercel/blob', () => ({ put: mockPut }))

const mockWriteFile = jest.fn()
jest.mock('fs/promises', () => ({ writeFile: mockWriteFile, mkdir: jest.fn() }))

import { POST } from '@/app/api/v1/media/upload/route'

describe('POST /api/v1/media/upload', () => {
  const env = process.env as Record<string, string | undefined>
  const savedNodeEnv = env.NODE_ENV
  afterEach(() => { env.NODE_ENV = savedNodeEnv })

  beforeEach(() => {
    jest.clearAllMocks()
    process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_test'
    mockAuthenticateRequest.mockResolvedValue({ success: true, user: { id: 'user-1' } })
    mockResolveTeamContext.mockResolvedValue('team-1')
    mockCheckPermission.mockResolvedValue(true)
    mockPut.mockResolvedValue({ url: 'https://blob.example/upload.png' })
    mockExtractImageDimensions.mockResolvedValue(undefined)
    mockCreateMedia.mockResolvedValue({ id: 'media-1' })
  })

  const upload = async (files: FormDataEntryValue[]) => {
    const formData = { getAll: jest.fn().mockReturnValue(files) }
    return POST({ formData: jest.fn().mockResolvedValue(formData) } as never)
  }

  const imageFile = () => Object.assign(
    new File(['image'], 'upload.png', { type: 'image/png' }),
    { arrayBuffer: jest.fn().mockResolvedValue(new TextEncoder().encode('image').buffer) }
  )

  it('uploads files when files contains only File values', async () => {
    const response = await upload([imageFile()])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ count: 1 })
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it('ignores string values when files also contains a File', async () => {
    const response = await upload(['not-a-file', imageFile()])

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ count: 1 })
    expect(mockPut).toHaveBeenCalledTimes(1)
  })

  it('returns 400 when files contains only strings', async () => {
    const response = await upload(['not-a-file'])

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({ message: 'No files uploaded' })
    expect(mockPut).not.toHaveBeenCalled()
  })

  describe('without a storage provider', () => {
    beforeEach(() => { delete process.env.BLOB_READ_WRITE_TOKEN })

    it('answers 503 STORAGE_NOT_CONFIGURED in production and writes nothing', async () => {
      env.NODE_ENV = 'production'
      const response = await upload([imageFile()])

      expect(response.status).toBe(503)
      const body = await response.json()
      expect(body.code).toBe('STORAGE_NOT_CONFIGURED')
      expect(body.message).toContain('BLOB_READ_WRITE_TOKEN')
      expect(body.details).toEqual({ missing: 'BLOB_READ_WRITE_TOKEN' })
      expect(mockWriteFile).not.toHaveBeenCalled()
      expect(mockPut).not.toHaveBeenCalled()
      expect(mockCreateMedia).not.toHaveBeenCalled()
    })

    it('treats a malformed token like a missing one in production', async () => {
      env.NODE_ENV = 'production'
      process.env.BLOB_READ_WRITE_TOKEN = 'not-a-blob-token'

      expect((await upload([imageFile()])).status).toBe(503)
    })

    it('keeps the local fallback in development', async () => {
      env.NODE_ENV = 'development'
      const response = await upload([imageFile()])

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ count: 1, storage: 'local' })
      expect(mockWriteFile).toHaveBeenCalledTimes(1)
    })
  })

  it('does not fall back to a local file when Blob fails in production', async () => {
    env.NODE_ENV = 'production'
    mockPut.mockRejectedValue(new Error('blob down'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    jest.spyOn(console, 'warn').mockImplementation(() => {})

    const response = await upload([imageFile()])

    expect(response.status).toBe(500)
    expect(mockWriteFile).not.toHaveBeenCalled()
  })
})
