/**
 * @jest-environment node
 */
import { NextRequest } from 'next/server'

jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: jest.fn().mockResolvedValue({ success: true, type: 'session', user: { id: 'owna' } }),
  createAuthFailureResponse: jest.fn(),
  resolveTeamContext: jest.fn().mockResolvedValue('team-a'),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({ checkPermission: jest.fn().mockResolvedValue(true) }))

const own = 'https://s3.example.org/shared/qa/uploads/1700000000000_0123456789abcdef0123456789abcdef.png'
const external = 'https://elsewhere.example.org/photo.png'
const row = (id: string, url: string) => ({ id, teamId: 'team-a', url, filename: 'a.png' })
const mockMedia = {
  getById: jest.fn(async () => row('m1', own)),
  list: jest.fn(async () => ({ data: [row('m1', own), row('m2', external)], total: 2, limit: 20, offset: 0 })),
}
jest.mock('@nextsparkjs/core/lib/services/media.service', () => ({ MediaService: mockMedia }))

// setup.ts swaps crypto.subtle for a mock; aws4fetch needs the real one
const outer = require('vm').runInThisContext('globalThis')
;(global.crypto as { subtle: SubtleCrypto }).subtle = outer.crypto.subtle

import { GET as getOne } from '../../../src/routes/api/v1/media/[id]/route'
import { GET as getList } from '../../../src/routes/api/v1/media/route'

const PRIVATE_ENV = {
  STORAGE_DRIVER: 's3', S3_ENDPOINT: 'https://s3.example.org', S3_REGION: 'us-east-1', S3_BUCKET: 'shared',
  S3_ACCESS_KEY_ID: 'AKIDSECRETVALUE1', S3_SECRET_ACCESS_KEY: 'very-secret-value-2', S3_PUBLIC_URL: 'https://cdn.example.org/shared',
  S3_FORCE_PATH_STYLE: 'true', STORAGE_S3_KEY_PREFIX: 'qa',
}
const saved = { ...process.env }
afterEach(() => { process.env = { ...saved } })

const ctx = { params: Promise.resolve({ id: 'm1' }) }
const body = async (response: Response) => (await response.json()).data

describe('media API with a private bucket', () => {
  beforeEach(() => { Object.assign(process.env, PRIVATE_ENV, { STORAGE_S3_PRIVATE: 'true' }) })

  it('GET /media/:id keeps url canonical and adds a signed displayUrl', async () => {
    const media = await body(await getOne(new NextRequest('http://localhost/api/v1/media/m1'), ctx))
    expect(media.url).toBe(own)
    expect(media.displayUrl).toContain('X-Amz-Signature=')
    expect(media.displayUrl.startsWith(own + '?')).toBe(true)
  })

  it('GET /media signs own objects only', async () => {
    const result = await body(await getList(new NextRequest('http://localhost/api/v1/media')))
    expect(result.data[0].displayUrl).toContain('X-Amz-Signature=')
    expect(result.data[1]).toEqual(row('m2', external))
  })
})

describe('media API without the private option', () => {
  beforeEach(() => { Object.assign(process.env, PRIVATE_ENV); delete process.env.STORAGE_S3_PRIVATE })

  it('returns the rows exactly as stored', async () => {
    const media = await body(await getOne(new NextRequest('http://localhost/api/v1/media/m1'), ctx))
    expect(media).toEqual(row('m1', own))
    const result = await body(await getList(new NextRequest('http://localhost/api/v1/media')))
    expect(result.data).toEqual([row('m1', own), row('m2', external)])
  })
})
