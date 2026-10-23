/**
 * @jest-environment node
 */
import { afterEach, beforeEach, describe, expect, it } from '@jest/globals'

import { selectStorageDriver } from '@/core/lib/media/storage'
import { signStoredMediaUrl, withDisplayUrls } from '@/core/lib/media/storage/display'
import { normalizeKeyPrefix, parseS3Config, S3StorageDriver } from '@/core/lib/media/storage/s3'

// setup.ts swaps Response, Headers and crypto.subtle for mocks; the drivers (and aws4fetch) need the real ones
const outer = require('vm').runInThisContext('globalThis')
Object.assign(global, { Response: outer.Response, Headers: outer.Headers })
;(global.crypto as { subtle: SubtleCrypto }).subtle = outer.crypto.subtle

const BASE = {
  STORAGE_DRIVER: 's3',
  S3_ENDPOINT: 'https://s3.example.org',
  S3_REGION: 'us-east-1',
  S3_BUCKET: 'shared',
  S3_ACCESS_KEY_ID: 'AKIDSECRETVALUE1',
  S3_SECRET_ACCESS_KEY: 'very-secret-value-2',
  S3_PUBLIC_URL: 'https://cdn.example.org/shared',
  S3_FORCE_PATH_STYLE: 'true',
}
const env = (vars: Record<string, string | undefined>) => vars as NodeJS.ProcessEnv
const NAME = '1700000000000_0123456789abcdef0123456789abcdef.png'
const OTHER = '1700000000001_fedcba9876543210fedcba9876543210.png'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3, 4])

const driver = (vars: Record<string, string | undefined> = {}) => {
  const parsed = parseS3Config(env({ ...BASE, ...vars }))
  if (!('config' in parsed)) throw new Error(`bad test config: ${JSON.stringify(parsed)}`)
  return new S3StorageDriver(parsed.config)
}

/** An in-memory bucket behind fetch: keys are the path after /shared/. */
let objects: Map<string, { body: string; etag: string }>
let calls: { method: string; url: string }[]
const realFetch = global.fetch

beforeEach(() => {
  objects = new Map()
  calls = []
  global.fetch = (async (input: unknown, init?: RequestInit) => {
    const headers = new Headers(init?.headers)
    const method = init?.method ?? 'GET'
    const url = new URL(String(input))
    calls.push({ method, url: url.toString() })
    const key = decodeURIComponent(url.pathname.replace(/^\/shared\//, ''))
    if (method === 'PUT') {
      const source = headers.get('x-amz-copy-source')
      if (source) {
        const from = objects.get(decodeURIComponent(source.replace(/^\/shared\//, '')))
        if (!from) return new Response('<Error><Code>NoSuchKey</Code></Error>', { status: 404 })
        objects.set(key, { ...from })
        return new Response('<CopyObjectResult/>', { status: 200 })
      }
      objects.set(key, { body: String(init?.body ?? ''), etag: '"e1"' })
      return new Response(null, { status: 200 })
    }
    if (method === 'DELETE') {
      objects.delete(key)
      return new Response(null, { status: 204 })
    }
    const found = objects.get(key)
    if (!found) return new Response(null, { status: 404 })
    return new Response(method === 'HEAD' ? null : found.body, {
      status: 200,
      headers: { 'content-length': String(found.body.length), 'content-type': 'image/png', etag: found.etag },
    })
  }) as typeof fetch
})
afterEach(() => { global.fetch = realFetch })

describe('normalizeKeyPrefix', () => {
  it.each([
    ['qa', 'qa/'], ['qa/', 'qa/'], ['/qa//', 'qa/'], ['  qa  ', 'qa/'], ['qa/images', 'qa/images/'], ['a.b_c-d/e', 'a.b_c-d/e/'],
    ['', ''], ['/', ''], ['///', ''], [undefined, ''],
  ])('%j is %j', (raw, expected) => expect(normalizeKeyPrefix(raw)).toBe(expected))

  it.each(['..', '../qa', 'qa/..', 'qa/../other', '.', './qa', 'qa/./x', '.hidden', 'a..b', 'qa\\x', 'qa%2e%2e', 'q a', 'qa?x', 'é', 'a'.repeat(64)])(
    'refuses %j',
    (raw) => expect(normalizeKeyPrefix(raw)).toBeNull()
  )
})

describe('configuration', () => {
  it('without the new variables the config is what it was', () => {
    const parsed = parseS3Config(env(BASE))
    expect(parsed).toEqual({
      config: {
        endpoint: 'https://s3.example.org', region: 'us-east-1', bucket: 'shared', accessKeyId: 'AKIDSECRETVALUE1',
        secretAccessKey: 'very-secret-value-2', publicUrl: 'https://cdn.example.org/shared', forcePathStyle: true,
      },
    })
  })

  it('reads the prefix, the private flag and the lifetime', () => {
    expect(parseS3Config(env({ ...BASE, STORAGE_S3_KEY_PREFIX: '/qa//', STORAGE_S3_PRIVATE: 'true', STORAGE_S3_SIGNED_URL_TTL: '600' }))).toMatchObject({
      config: { keyPrefix: 'qa/', private: true, signedUrlTtlSeconds: 600 },
    })
  })

  it('blank or slash-only prefix is no prefix, and false is not private', () => {
    for (const prefix of ['', '  ', '///']) {
      expect((parseS3Config(env({ ...BASE, STORAGE_S3_KEY_PREFIX: prefix, STORAGE_S3_PRIVATE: 'false' })) as { config: object }).config).not.toHaveProperty('keyPrefix')
    }
    expect((parseS3Config(env({ ...BASE, STORAGE_S3_PRIVATE: 'false' })) as { config: object }).config).not.toHaveProperty('private')
  })

  it.each([
    ['STORAGE_S3_KEY_PREFIX', '../x'],
    ['STORAGE_S3_PRIVATE', 'yes'],
    ['STORAGE_S3_SIGNED_URL_TTL', '10'],
    ['STORAGE_S3_SIGNED_URL_TTL', '9999999'],
    ['STORAGE_S3_SIGNED_URL_TTL', '1h'],
  ])('%s=%j is refused by name, never by value', (name, value) => {
    const selection = selectStorageDriver(env({ ...BASE, STORAGE_S3_PRIVATE: 'true', [name]: value }))
    expect(selection.driver).toBeNull()
    if (selection.driver) return
    expect(selection.details).toEqual({ invalid: [name] })
    expect(selection.message).not.toContain(value === '../x' ? '../x' : 'AKID')
  })

  it('a private bucket needs no public URL, but refuses an http: endpoint on another host', () => {
    const { S3_PUBLIC_URL: _unused, ...withoutPublicUrl } = BASE
    expect(parseS3Config(env({ ...withoutPublicUrl, STORAGE_S3_PRIVATE: 'true' }))).toHaveProperty('config')
    expect(parseS3Config(env(withoutPublicUrl))).toMatchObject({ variables: ['S3_PUBLIC_URL'] })
    expect(parseS3Config(env({ ...BASE, STORAGE_S3_PRIVATE: 'true', S3_ENDPOINT: 'http://minio.internal:9000' }))).toMatchObject({ variables: ['S3_ENDPOINT'] })
    expect(parseS3Config(env({ ...BASE, STORAGE_S3_PRIVATE: 'true', S3_ENDPOINT: 'http://localhost:9000' }))).toHaveProperty('config')
  })
})

describe('key prefix', () => {
  const qa = () => driver({ STORAGE_S3_KEY_PREFIX: 'qa' })

  it('is added to put, the public URL, presign, stat, read, promote (key and copy source) and discard', async () => {
    const s3 = qa()
    expect(await s3.put(NAME, PNG, 'image/png')).toBe(`https://cdn.example.org/shared/qa/uploads/${NAME}`)
    expect(calls[0]).toMatchObject({ method: 'PUT', url: `https://s3.example.org/shared/qa/uploads/${NAME}` })

    const upload = await s3.direct.presignUpload(NAME, 'image/png', 12)
    expect(new URL(upload.url).pathname).toBe(`/shared/qa/pending/${NAME}`)

    objects.set(`qa/pending/${NAME}`, { body: 'pending-bytes', etag: '"p1"' })
    expect(await s3.direct.stat(NAME)).toMatchObject({ size: 13, etag: '"p1"' })
    expect((await s3.direct.readStart(NAME, 4)).length).toBe(4)
    await s3.direct.promote(NAME, 'image/png', '"p1"')
    expect(objects.get(`qa/uploads/${NAME}`)?.body).toBe('pending-bytes')
    expect(calls.at(-1)).toMatchObject({ method: 'PUT', url: `https://s3.example.org/shared/qa/uploads/${NAME}` })
    await s3.direct.discard(NAME)
    expect(objects.has(`qa/pending/${NAME}`)).toBe(false)
    expect(s3.direct.getPublicUrl(NAME)).toBe(`https://cdn.example.org/shared/qa/uploads/${NAME}`)
    // Nothing reached the bucket outside the prefix
    expect(calls.every((c) => new URL(c.url).pathname.startsWith('/shared/qa/'))).toBe(true)
  })

  it('the copy source carries the prefix', async () => {
    const seen: string[] = []
    const inner = global.fetch
    global.fetch = (async (input: unknown, init?: RequestInit) => {
      seen.push(new Headers(init?.headers).get('x-amz-copy-source') ?? '')
      return inner(input as string, init)
    }) as typeof fetch
    objects.set(`qa/pending/${NAME}`, { body: 'x', etag: '"p1"' })
    await qa().direct.promote(NAME, 'image/png', '"p1"')
    expect(seen).toContain(`/shared/qa/pending/${NAME}`)
  })

  it('two environments in one bucket neither read nor overwrite nor delete each other', async () => {
    const a = driver({ STORAGE_S3_KEY_PREFIX: 'qa' })
    const b = driver({ STORAGE_S3_KEY_PREFIX: 'staging' })
    const urlA = await a.put(NAME, PNG, 'image/png')
    const urlB = await b.put(NAME, Buffer.from('other-env'), 'image/png')
    expect([...objects.keys()].sort()).toEqual([`qa/uploads/${NAME}`, `staging/uploads/${NAME}`])
    expect(urlA).not.toBe(urlB)

    // Deleting the other environment's URL is a no-op: no request leaves
    const before = calls.length
    await a.delete(urlB)
    expect(calls).toHaveLength(before)
    expect(objects.get(`staging/uploads/${NAME}`)?.body).toBe('other-env')

    await a.delete(urlA)
    expect([...objects.keys()]).toEqual([`staging/uploads/${NAME}`])
  })

  it('a pending object of another environment is not seen', async () => {
    objects.set(`staging/pending/${NAME}`, { body: 'x', etag: '"s"' })
    expect(await driver({ STORAGE_S3_KEY_PREFIX: 'qa' }).direct.stat(NAME)).toBeNull()
  })

  it('compares by segment: qa does not own qa2, nor a nested qa/qa', async () => {
    const s3 = qa()
    const before = calls.length
    for (const foreign of [
      `https://cdn.example.org/shared/qa2/uploads/${NAME}`,
      `https://cdn.example.org/shared/q/uploads/${NAME}`,
      `https://cdn.example.org/shared/qa/qa/uploads/${NAME}`,
      `https://cdn.example.org/shared/uploads/${NAME}`,
      `https://cdn.example.org/shared/qa/uploads/../uploads/${NAME}`,
      `https://cdn.example.org/shared/qa/uploads/sub/${NAME}`,
      `https://cdn.example.org/shared/qa/uploads/${NAME}/..`,
    ]) await s3.delete(foreign)
    expect(calls).toHaveLength(before)
  })

  it('without a prefix, a URL under a prefix is not recognized, and keys are the old ones', async () => {
    const s3 = driver()
    expect(await s3.put(NAME, PNG, 'image/png')).toBe(`https://cdn.example.org/shared/uploads/${NAME}`)
    const before = calls.length
    await s3.delete(`https://cdn.example.org/shared/qa/uploads/${NAME}`)
    expect(calls).toHaveLength(before)
    expect([...objects.keys()]).toEqual([`uploads/${NAME}`])
  })

  it('qa, qa/ and /qa// give the same keys', async () => {
    for (const raw of ['qa', 'qa/', '/qa//']) {
      objects.clear()
      await driver({ STORAGE_S3_KEY_PREFIX: raw }).put(NAME, PNG, 'image/png')
      expect([...objects.keys()]).toEqual([`qa/uploads/${NAME}`])
    }
  })
})

describe('private bucket', () => {
  const priv = (vars: Record<string, string | undefined> = {}) => driver({ STORAGE_S3_PRIVATE: 'true', ...vars })

  it('stores the canonical object URL, never a signature, and signs on read', async () => {
    const s3 = priv({ STORAGE_S3_KEY_PREFIX: 'qa' })
    const url = await s3.put(NAME, PNG, 'image/png')
    expect(url).toBe(`https://s3.example.org/shared/qa/uploads/${NAME}`)
    expect(new URL(url).search).toBe('')
    expect(s3.direct.getPublicUrl(NAME)).toBe(url)

    const signed = new URL((await s3.signedReadUrl(url))!)
    expect(`${signed.origin}${signed.pathname}`).toBe(url)
    expect(signed.searchParams.get('X-Amz-Algorithm')).toBe('AWS4-HMAC-SHA256')
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('3600')
    expect(signed.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/)
    expect(signed.searchParams.get('X-Amz-SignedHeaders')).toBe('host')
    expect(signed.toString()).not.toContain('very-secret-value-2')
  })

  it('the lifetime is configurable and the validity left is between half and all of it', async () => {
    const s3 = priv({ STORAGE_S3_SIGNED_URL_TTL: '600' })
    const signed = new URL((await s3.signedReadUrl(`https://s3.example.org/shared/uploads/${NAME}`))!)
    expect(signed.searchParams.get('X-Amz-Expires')).toBe('600')
    const d = signed.searchParams.get('X-Amz-Date')!
    const signedAt = Date.UTC(+d.slice(0, 4), +d.slice(4, 6) - 1, +d.slice(6, 8), +d.slice(9, 11), +d.slice(11, 13), +d.slice(13, 15))
    const left = signedAt + 600_000 - Date.now()
    expect(left).toBeGreaterThan(300_000 - 1000)
    expect(left).toBeLessThanOrEqual(600_000)
  })

  it('repeats the same URL inside a window, so the browser can cache it', async () => {
    const s3 = priv()
    const url = `https://s3.example.org/shared/uploads/${NAME}`
    const [one, two] = [await s3.signedReadUrl(url), await s3.signedReadUrl(url)]
    expect(one).toBe(two)
  })

  it('lets every other URL through untouched', async () => {
    const s3 = priv({ STORAGE_S3_KEY_PREFIX: 'qa' })
    for (const foreign of [
      'https://elsewhere.example.org/photo.png',
      `https://s3.example.org/other-bucket/qa/uploads/${NAME}`, // another bucket on the same host
      `https://s3.example.org/shared/staging/uploads/${NAME}`, // another environment
      `https://s3.example.org/shared/qa2/uploads/${NAME}`,
      `https://s3.example.org/shared/uploads/${NAME}`, // no prefix
      `https://s3.example.org/shared/qa/pending/${NAME}`, // not a stored upload
      `https://s3.example.org/shared/qa/uploads/${NAME}?X-Amz-Signature=abc`,
      `https://s3.example.org/shared/qa/uploads/${NAME}#x`,
      `http://s3.example.org/shared/qa/uploads/${NAME}`, // another scheme
      `https://s3.example.org:8443/shared/qa/uploads/${NAME}`, // another port
      `https://s3.example.org.evil.test/shared/qa/uploads/${NAME}`,
      `https://user:pw@s3.example.org/shared/qa/uploads/${NAME}`,
      `https://s3.example.org/shared/qa/uploads/../uploads/${NAME}`,
      `https://s3.example.org/shared/qa/uploads/%2e%2e/uploads/${NAME}`,
      `https://s3.example.org/shared/qa/uploads/sub/${NAME}`,
      `https://s3.example.org/shared/qa/uploads/not-a-generated-name.png`,
      '/uploads/temp/x.png', 'not a url', '',
    ]) expect(await s3.signedReadUrl(foreign)).toBeNull()
  })

  it('without the option nothing is signed and URLs are the public ones', async () => {
    const s3 = driver()
    expect(await s3.signedReadUrl(`https://s3.example.org/shared/uploads/${NAME}`)).toBeNull()
    expect(await s3.signedReadUrl(`https://cdn.example.org/shared/uploads/${NAME}`)).toBeNull()
  })

  it('virtual-hosted buckets compare the bucket host', async () => {
    const s3 = priv({ S3_FORCE_PATH_STYLE: 'false', S3_ENDPOINT: 'https://s3.eu-west-1.amazonaws.com' })
    const own = `https://shared.s3.eu-west-1.amazonaws.com/uploads/${NAME}`
    expect(await s3.put(NAME, PNG, 'image/png')).toBe(own)
    expect(await s3.signedReadUrl(own)).toContain('X-Amz-Signature=')
    expect(await s3.signedReadUrl(`https://other.s3.eu-west-1.amazonaws.com/uploads/${NAME}`)).toBeNull()
  })

  it('deletes by the canonical URL, and only this environment\'s', async () => {
    const s3 = priv({ STORAGE_S3_KEY_PREFIX: 'qa' })
    const url = await s3.put(NAME, PNG, 'image/png')
    objects.set(`staging/uploads/${OTHER}`, { body: 'x', etag: '"s"' })
    await s3.delete(`https://s3.example.org/shared/staging/uploads/${OTHER}`)
    expect(objects.has(`staging/uploads/${OTHER}`)).toBe(true)
    await s3.delete(url)
    expect(objects.has(`qa/uploads/${NAME}`)).toBe(false)
  })

  it('the signed URL and the secret never reach the logs', async () => {
    const logged: string[] = []
    const spies = (['log', 'warn', 'error'] as const).map((level) => {
      const original = console[level]
      console[level] = (...args: unknown[]) => { logged.push(args.map(String).join(' ')) }
      return () => { console[level] = original }
    })
    try {
      const s3 = priv()
      await s3.signedReadUrl(`https://s3.example.org/shared/uploads/${NAME}`)
      await s3.put(NAME, PNG, 'image/png')
    } finally { spies.forEach((restore) => restore()) }
    expect(logged.join('\n')).not.toMatch(/X-Amz-Signature|very-secret-value-2/)
  })
})

describe('display URLs', () => {
  const PRIVATE_ENV = { ...BASE, STORAGE_S3_PRIVATE: 'true', STORAGE_S3_KEY_PREFIX: 'qa' }
  const own = `https://s3.example.org/shared/qa/uploads/${NAME}`

  it('adds displayUrl for own objects and leaves url canonical; other rows are returned as they are', async () => {
    const rows = [{ id: '1', url: own }, { id: '2', url: 'https://elsewhere.example.org/x.png' }]
    const out = await withDisplayUrls(rows, env(PRIVATE_ENV))
    expect(out[0].url).toBe(own)
    expect(out[0].displayUrl).toContain('X-Amz-Signature=')
    expect(out[1]).toEqual(rows[1])
    expect(rows[0]).toEqual({ id: '1', url: own }) // the input is not mutated
  })

  it('returns the rows unchanged without the private option', async () => {
    const rows = [{ id: '1', url: `https://cdn.example.org/shared/uploads/${NAME}` }]
    expect(await withDisplayUrls(rows, env(BASE))).toEqual(rows)
    expect(await withDisplayUrls(rows, env({ STORAGE_DRIVER: 'local', UPLOADS_DIR: '/tmp/x' }))).toBe(rows)
  })

  it('signStoredMediaUrl signs an own URL and passes anything else through', async () => {
    expect(await signStoredMediaUrl(own, env(PRIVATE_ENV))).toContain('X-Amz-Signature=')
    expect(await signStoredMediaUrl('https://elsewhere.example.org/x.png', env(PRIVATE_ENV))).toBe('https://elsewhere.example.org/x.png')
    expect(await signStoredMediaUrl(own, env(BASE))).toBe(own)
  })
})
