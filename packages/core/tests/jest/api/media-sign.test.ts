/**
 * @jest-environment node
 */
// #361: POST /api/v1/media/sign signs stored URLs for the screens that render them outside a media row,
// and is not an open signer.
import { NextRequest } from 'next/server'

const mockAuth = jest.fn()
const mockPermission = jest.fn()
jest.mock('@nextsparkjs/core/lib/api/auth/dual-auth', () => ({
  authenticateRequest: (...args: unknown[]) => mockAuth(...args),
  createAuthFailureResponse: () => new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
  resolveTeamContext: jest.fn().mockResolvedValue('team-a'),
}))
jest.mock('@nextsparkjs/core/lib/api/rate-limit', () => ({ withRateLimitTier: (handler: unknown) => handler }))
jest.mock('@nextsparkjs/core/lib/permissions/check', () => ({ checkPermission: (...args: unknown[]) => mockPermission(...args) }))

// The files of each team, as the database would answer (team and active status are the query's filter)
const filesByTeam: Record<string, string[]> = {}
const mockTeamUrls = jest.fn(async (urls: string[], teamId: string) => new Set(urls.filter(url => (filesByTeam[teamId] ?? []).includes(url))))
jest.mock('@nextsparkjs/core/lib/services/media.service', () => ({ MediaService: { teamUrls: (...args: [string[], string, string | null]) => mockTeamUrls(...args) } }))

// setup.ts swaps crypto.subtle for a mock; aws4fetch needs the real one
const outer = require('vm').runInThisContext('globalThis')
;(global.crypto as { subtle: SubtleCrypto }).subtle = outer.crypto.subtle

import { POST } from '../../../src/routes/api/v1/media/sign/route'

const NAME = (n: string) => `17000000000${n}_0123456789abcdef0123456789abcdef.png`
const mine = `https://s3.example.org/shared/qa/uploads/${NAME('01')}`
const theirs = `https://s3.example.org/shared/qa/uploads/${NAME('02')}`
const otherEnv = `https://s3.example.org/shared/staging/uploads/${NAME('03')}`
const external = 'https://elsewhere.example.org/photo.png'

const ENV = {
  STORAGE_DRIVER: 's3', S3_ENDPOINT: 'https://s3.example.org', S3_REGION: 'us-east-1', S3_BUCKET: 'shared',
  S3_ACCESS_KEY_ID: 'AKIDSECRETVALUE1', S3_SECRET_ACCESS_KEY: 'very-secret-value-2', S3_PUBLIC_URL: 'https://cdn.example.org/shared',
  S3_FORCE_PATH_STYLE: 'true', STORAGE_S3_KEY_PREFIX: 'qa',
}
const saved = { ...process.env }

const call = async (body: unknown) => {
  const response = await POST(new NextRequest('http://localhost/api/v1/media/sign', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } }), undefined as never)
  return { status: response.status, json: await response.json() }
}

beforeEach(() => {
  Object.assign(process.env, ENV, { STORAGE_S3_PRIVATE: 'true' })
  mockAuth.mockResolvedValue({ success: true, type: 'session', user: { id: 'user-a' } })
  mockPermission.mockResolvedValue(true)
  mockTeamUrls.mockClear()
  filesByTeam['team-a'] = [mine, otherEnv, external]
  filesByTeam['team-b'] = [theirs]
})
afterEach(() => { process.env = { ...saved } })

describe('POST /api/v1/media/sign', () => {
  it('signs a file of the current team and leaves the stored URL as the key', async () => {
    const { status, json } = await call({ urls: [mine] })
    expect(status).toBe(200)
    expect(Object.keys(json.data.signed)).toEqual([mine])
    expect(json.data.signed[mine]).toContain('X-Amz-Signature=')
    expect(json.data.signed[mine].startsWith(mine + '?')).toBe(true)
    // looked up in the caller's team, under the caller's RLS context
    expect(mockTeamUrls).toHaveBeenCalledWith([mine], 'team-a', 'user-a')
  })

  it('does not sign a URL of another origin or another environment, even when the team has a row for it', async () => {
    const { json } = await call({ urls: [external, otherEnv, mine] })
    expect(Object.keys(json.data.signed)).toEqual([mine])
    // the foreign ones never reached the database
    expect(mockTeamUrls).toHaveBeenCalledWith([mine], 'team-a', 'user-a')
  })

  it("does not sign a file of another team, and answers like for an unknown file", async () => {
    const { status, json } = await call({ urls: [theirs] })
    expect(status).toBe(200)
    expect(json.data.signed).toEqual({})
    expect(mockTeamUrls).toHaveBeenCalledWith([theirs], 'team-a', 'user-a')
  })

  it('refuses without authentication, and without the media.read permission', async () => {
    mockAuth.mockResolvedValue({ success: false })
    expect((await call({ urls: [mine] })).status).toBe(401)
    mockAuth.mockResolvedValue({ success: true, type: 'session', user: { id: 'user-a' } })
    mockPermission.mockResolvedValue(false)
    expect((await call({ urls: [mine] })).status).toBe(403)
    expect(mockTeamUrls).not.toHaveBeenCalled()
  })

  it('asks the API-key scope media:read', async () => {
    await call({ urls: [mine] })
    expect(mockAuth).toHaveBeenCalledWith(expect.anything(), { requiredScope: 'media:read' })
  })

  it.each([
    ['no urls', {}],
    ['an empty list', { urls: [] }],
    ['a non-string entry', { urls: [mine, 3] }],
    ['an empty string', { urls: [''] }],
    ['a very long string', { urls: ['https://x.example.org/' + 'a'.repeat(3000)] }],
    ['more than 50 urls', { urls: Array.from({ length: 51 }, (_, i) => `https://x.example.org/${i}.png`) }],
  ])('rejects %s', async (_name, body) => {
    expect((await call(body)).status).toBe(400)
  })

  it('answers nothing with the private mode off, and never queries', async () => {
    delete process.env.STORAGE_S3_PRIVATE
    const { status, json } = await call({ urls: [mine] })
    expect(status).toBe(200)
    expect(json.data.signed).toEqual({})
    expect(mockTeamUrls).not.toHaveBeenCalled()
  })

  it('does not log the URLs or the signature when it fails', async () => {
    mockTeamUrls.mockRejectedValueOnce(new Error('db down'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {})
    const { status } = await call({ urls: [mine] })
    expect(status).toBe(500)
    expect(JSON.stringify(spy.mock.calls)).not.toMatch(/X-Amz|uploads\//)
    spy.mockRestore()
  })
})
