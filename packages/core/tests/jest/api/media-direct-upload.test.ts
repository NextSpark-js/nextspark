/**
 * @jest-environment node
 *
 * Direct uploads: POST /api/v1/media/upload/presign, then the client PUTs to storage,
 * then POST /api/v1/media/upload/confirm. Storage is an in-memory driver with the
 * direct-upload methods; the token is the real one (lib/media/upload-token).
 */
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'

const mockAuthenticateRequest = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockResolveTeamContext = jest.fn<(...args: unknown[]) => Promise<unknown>>()
const mockCheckPermission = jest.fn<(...args: unknown[]) => Promise<boolean>>()
const mockSelectStorageDriver = jest.fn<() => unknown>()

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: mockAuthenticateRequest,
  createAuthFailureResponse: () => Response.json({ code: 'AUTH' }, { status: 401 }),
  resolveTeamContext: mockResolveTeamContext,
}))
jest.mock('@nextsparkjs/core/lib/api/helpers', () => ({
  createApiResponse: (data: unknown) => Response.json(data),
  createApiError: (message: string, status: number, details?: unknown, code?: string) => Response.json({ message, details, code }, { status }),
  readJsonObject: async (request: { json: () => Promise<unknown> }) => ({ data: await request.json() }),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({ checkPermission: mockCheckPermission }))
jest.mock('@nextsparkjs/core/lib/config/config-sync', () => ({ MEDIA_CONFIG: { maxSizeMB: 1, allowedMimeTypes: ['image/png', 'video/mp4'] } }))
jest.mock('@nextsparkjs/core/lib/media/utils', () => ({
  ...jest.requireActual<object>('@nextsparkjs/core/lib/media/utils'),
  extractImageDimensions: async () => ({ width: 4, height: 3 }),
}))
jest.mock('@nextsparkjs/core/lib/media/storage', () => ({
  ...jest.requireActual<object>('@nextsparkjs/core/lib/media/storage'),
  selectStorageDriver: mockSelectStorageDriver,
}))

// MediaService.createOnce's contract (one record per URL, `prepare` under the lock, not run when the URL has one)
const records = new Map<string, Record<string, unknown>>()
let failInsert = false
let queue: Promise<unknown> = Promise.resolve()
jest.mock('@nextsparkjs/core/lib/services/media.service', () => ({
  MediaService: {
    createOnce: (userId: string, teamId: string, url: string, prepare: () => Promise<Record<string, unknown>>) => {
      const run = queue.then(async () => {
        if (records.has(url)) return null
        const data = await prepare()
        if (failInsert) throw new Error('db down')
        const media = { id: `media-${records.size + 1}`, userId, teamId, url, ...data }
        records.set(url, media)
        return media
      })
      queue = run.catch(() => {})
      return run
    },
  },
}))

import { POST as presign } from '@/app/api/v1/media/upload/presign/route'
import { POST as confirm } from '@/app/api/v1/media/upload/confirm/route'
import { signUploadClaim } from '@/core/lib/media/upload-token'

const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const HTML = new TextEncoder().encode('<html><script>alert(1)</script></html>')

/** In-memory S3: pending objects, promoted objects, and every discard. */
function memoryDriver() {
  const pending = new Map<string, { bytes: Uint8Array; contentType: string }>()
  const uploads = new Map<string, Uint8Array>()
  const discarded: string[] = []
  const deleted: string[] = []
  const driver = {
    name: 's3',
    put: jest.fn(),
    delete: jest.fn(async (url: string) => { deleted.push(url) }),
    direct: {
      presignUpload: async (name: string, contentType: string, size: number) => ({
        url: `https://bucket.test/pending/${name}?X-Amz-Expires=300`,
        method: 'PUT' as const,
        headers: { 'Content-Type': contentType },
        expiresAt: new Date(Date.now() + 300_000),
        size,
      }),
      stat: async (name: string) => {
        const object = pending.get(name)
        return object ? { size: object.bytes.length, contentType: object.contentType } : null
      },
      readStart: async (name: string, bytes: number) => pending.get(name)!.bytes.subarray(0, bytes),
      promote: async (name: string) => {
        uploads.set(name, pending.get(name)!.bytes)
        pending.delete(name)
      },
      discard: async (name: string) => {
        discarded.push(name)
        pending.delete(name)
      },
      getPublicUrl: (name: string) => `https://cdn.test/uploads/${name}`,
    },
  }
  return { driver, pending, uploads, discarded, deleted }
}

let storage: ReturnType<typeof memoryDriver>
const USER = { id: 'user-1' }

const request = (body: unknown) => ({ json: async () => body, headers: new Headers() }) as never

async function presignFor(body: Record<string, unknown>) {
  const response = await presign(request(body))
  return { status: response.status, body: await response.json() as Record<string, any> }
}

/** Presigns, then plays the client's PUT into pending storage. */
async function uploadDirect(bytes: Uint8Array, mimeType = 'image/png', storedAs = mimeType) {
  const { body } = await presignFor({ filename: 'photo <1>.png', mimeType, size: bytes.length })
  const name = new URL(body.upload.url).pathname.replace('/pending/', '')
  storage.pending.set(name, { bytes, contentType: storedAs })
  return { token: body.token as string, name }
}

async function confirmWith(token: unknown) {
  const response = await confirm(request({ token }))
  return { status: response.status, body: await response.json() as Record<string, any> }
}

beforeEach(() => {
  process.env.BETTER_AUTH_SECRET = 'test-secret-that-is-long-enough-0123456789'
  records.clear()
  failInsert = false
  storage = memoryDriver()
  mockSelectStorageDriver.mockReturnValue({ driver: storage.driver, developmentFallback: false })
  mockAuthenticateRequest.mockResolvedValue({ success: true, user: USER })
  mockResolveTeamContext.mockResolvedValue('team-1')
  mockCheckPermission.mockResolvedValue(true)
  jest.spyOn(console, 'error').mockImplementation(() => {})
})
afterEach(() => jest.restoreAllMocks())

describe('POST /api/v1/media/upload/presign', () => {
  it('answers a presigned PUT for a server-named pending object, and a token', async () => {
    const { status, body } = await presignFor({ filename: '../../etc/passwd.png', mimeType: 'image/png', size: 12 })

    expect(status).toBe(200)
    expect(body.upload).toMatchObject({ method: 'PUT', headers: { 'Content-Type': 'image/png' } })
    expect(body.upload.url).toMatch(/^https:\/\/bucket\.test\/pending\/\d+_[0-9a-f]{32}\.png\?/)
    expect(body.upload.url).not.toContain('passwd')
    expect(typeof body.token).toBe('string')
  })

  it('requires the upload permission and the media:write scope, like the upload route', async () => {
    mockCheckPermission.mockResolvedValue(false)
    expect((await presignFor({ filename: 'a.png', mimeType: 'image/png', size: 12 })).status).toBe(403)
    expect(mockCheckPermission).toHaveBeenCalledWith('user-1', 'team-1', 'media.upload')
    expect(mockAuthenticateRequest).toHaveBeenCalledWith(expect.anything(), { requiredScope: 'media:write' })
  })

  it('refuses a type that is not allowed', async () => {
    const { status, body } = await presignFor({ filename: 'a.html', mimeType: 'text/html', size: 12 })
    expect(status).toBe(400)
    expect(body.code).toBe('FILE_TYPE_NOT_ALLOWED')
  })

  it('refuses a declared size over the limit', async () => {
    const { status, body } = await presignFor({ filename: 'a.png', mimeType: 'image/png', size: 1024 * 1024 + 1 })
    expect(status).toBe(400)
    expect(body.code).toBe('FILE_TOO_LARGE')
  })

  it('refuses a malformed body', async () => {
    expect((await presignFor({ filename: 'a.png', mimeType: 'image/png', size: -1 })).status).toBe(400)
    expect((await presignFor({ filename: 'a.png', mimeType: 'image/png', size: '12' })).status).toBe(400)
  })

  it('answers 400 with a driver that has no direct uploads, and 503 without a driver', async () => {
    mockSelectStorageDriver.mockReturnValue({ driver: { name: 'vercel-blob', put: jest.fn(), delete: jest.fn() }, developmentFallback: false })
    expect((await presignFor({ filename: 'a.png', mimeType: 'image/png', size: 12 })).body.code).toBe('DIRECT_UPLOAD_UNSUPPORTED')
    mockSelectStorageDriver.mockReturnValue({ driver: null, message: 'not configured', details: {} })
    expect((await presignFor({ filename: 'a.png', mimeType: 'image/png', size: 12 })).status).toBe(503)
  })
})

describe('POST /api/v1/media/upload/confirm', () => {
  it('checks the object, moves it out of pending and creates one record', async () => {
    const { token, name } = await uploadDirect(PNG)
    const { status, body } = await confirmWith(token)

    expect(status).toBe(200)
    expect(body.media).toMatchObject({
      url: `https://cdn.test/uploads/${name}`,
      userId: 'user-1',
      teamId: 'team-1',
      filename: 'photo-1-.png',
      fileSize: PNG.length,
      mimeType: 'image/png',
      width: 4,
      height: 3,
    })
    expect(storage.uploads.has(name)).toBe(true)
    expect(storage.pending.has(name)).toBe(false)
    expect(records.size).toBe(1)
  })

  it('a replayed confirm creates no second record', async () => {
    const { token, name } = await uploadDirect(PNG)
    expect((await confirmWith(token)).status).toBe(200)

    // The presigned URL may still be valid: a new PUT into pending is not promoted over the confirmed file
    storage.pending.set(name, { bytes: PNG, contentType: 'image/png' })
    const replay = await confirmWith(token)

    expect(replay).toMatchObject({ status: 409, body: { code: 'UPLOAD_ALREADY_CONFIRMED' } })
    expect(records.size).toBe(1)
  })

  it('concurrent confirms of one token create one record', async () => {
    const { token } = await uploadDirect(PNG)
    const results = await Promise.all([confirmWith(token), confirmWith(token), confirmWith(token)])

    expect(results.map((r) => r.status).sort()).toEqual([200, 409, 409])
    expect(records.size).toBe(1)
  })

  it('refuses bytes that do not match the declared type, and deletes them', async () => {
    const { token, name } = await uploadDirect(HTML)
    const { status, body } = await confirmWith(token)

    expect(status).toBe(400)
    expect(body.code).toBe('FILE_TYPE_MISMATCH')
    expect(storage.discarded).toEqual([name])
    expect(storage.uploads.size).toBe(0)
    expect(records.size).toBe(0)
  })

  it('refuses an object stored with another type, and deletes it', async () => {
    const { token, name } = await uploadDirect(PNG, 'image/png', 'text/html')
    const { status, body } = await confirmWith(token)

    expect(status).toBe(400)
    expect(body.code).toBe('FILE_TYPE_MISMATCH')
    expect(storage.discarded).toEqual([name])
  })

  it('refuses an oversize object, and deletes it', async () => {
    const { token, name } = await uploadDirect(PNG)
    const big = new Uint8Array(1024 * 1024 + 1)
    big.set(PNG)
    storage.pending.set(name, { bytes: big, contentType: 'image/png' })
    const { status, body } = await confirmWith(token)

    expect(status).toBe(400)
    expect(body.code).toBe('FILE_TOO_LARGE')
    expect(storage.discarded).toEqual([name])
    expect(records.size).toBe(0)
  })

  it('refuses an object of another size than declared, and deletes it', async () => {
    const { token, name } = await uploadDirect(PNG)
    storage.pending.set(name, { bytes: Uint8Array.from([...PNG, 0]), contentType: 'image/png' })
    expect((await confirmWith(token)).body.code).toBe('FILE_SIZE_MISMATCH')
    expect(storage.discarded).toEqual([name])
  })

  it('refuses an unknown key: a forged or altered token', async () => {
    const { token } = await uploadDirect(PNG)
    const [payload, signature] = token.split('.')
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString())
    const altered = Buffer.from(JSON.stringify({ ...claim, name: 'someone-elses.png' })).toString('base64url')

    for (const bad of [`${altered}.${signature}`, `${payload}.${signature.slice(0, -2)}AA`, 'pending/x.png', '', 'a.b.c', 42]) {
      const { status, body } = await confirmWith(bad)
      expect(status).toBe(400)
      expect(['INVALID_UPLOAD_TOKEN', undefined]).toContain(body.code)
    }
    expect(records.size).toBe(0)
    expect(storage.discarded).toEqual([])
  })

  it('refuses a key presigned for another user or team, and leaves the object to its owner', async () => {
    const { token, name } = await uploadDirect(PNG)

    mockAuthenticateRequest.mockResolvedValue({ success: true, user: { id: 'user-2' } })
    expect(await confirmWith(token)).toMatchObject({ status: 403, body: { code: 'UPLOAD_NOT_YOURS' } })

    mockAuthenticateRequest.mockResolvedValue({ success: true, user: USER })
    mockResolveTeamContext.mockResolvedValue('team-2')
    expect(await confirmWith(token)).toMatchObject({ status: 403, body: { code: 'UPLOAD_NOT_YOURS' } })

    expect(storage.pending.has(name)).toBe(true)
    expect(storage.discarded).toEqual([])
    expect(records.size).toBe(0)
  })

  it('refuses an expired presign, and deletes the object', async () => {
    const name = '1700000000000_0123456789abcdef0123456789abcdef.png'
    storage.pending.set(name, { bytes: PNG, contentType: 'image/png' })
    const token = signUploadClaim({
      name, userId: 'user-1', teamId: 'team-1', mimeType: 'image/png', size: PNG.length, filename: 'a.png', expiresAt: Date.now() - 1,
    })

    expect(await confirmWith(token)).toMatchObject({ status: 410, body: { code: 'UPLOAD_EXPIRED' } })
    expect(storage.discarded).toEqual([name])
    expect(records.size).toBe(0)
  })

  it('answers 404 when nothing was uploaded', async () => {
    const { token } = await presignFor({ filename: 'a.png', mimeType: 'image/png', size: PNG.length }).then((r) => r.body)
    expect(await confirmWith(token)).toMatchObject({ status: 404, body: { code: 'UPLOAD_NOT_FOUND' } })
    expect(records.size).toBe(0)
  })

  it('deletes the promoted file when the record cannot be created', async () => {
    const { token, name } = await uploadDirect(PNG)
    failInsert = true

    expect((await confirmWith(token)).status).toBe(500)
    expect(storage.driver.delete).toHaveBeenCalledWith(`https://cdn.test/uploads/${name}`)
  })

  it('requires the upload permission', async () => {
    const { token } = await uploadDirect(PNG)
    mockCheckPermission.mockResolvedValue(false)
    expect((await confirmWith(token)).status).toBe(403)
    expect(records.size).toBe(0)
  })
})
