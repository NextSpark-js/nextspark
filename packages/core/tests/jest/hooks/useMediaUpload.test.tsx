import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals'
import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { useMediaUpload } from '../../../src/hooks/useMediaUpload'

const image = (name = 'a.png', size = 4) => new File([new Uint8Array(size)], name, { type: 'image/png' })
const MEDIA = { id: 'm1', url: 'https://cdn.example.test/m1.png' }

/** XHR stand-in: records the request and lets the test drive progress, completion and abort. */
class FakeXHR {
  static instances: FakeXHR[] = []
  static status = 200
  upload: { onprogress?: (e: { lengthComputable: boolean; loaded: number }) => void } = {}
  onload?: () => void
  onerror?: () => void
  onabort?: () => void
  status = 0
  method = ''
  url = ''
  headers: Record<string, string> = {}
  body: unknown
  constructor() { FakeXHR.instances.push(this) }
  open(method: string, url: string) { this.method = method; this.url = url }
  setRequestHeader(name: string, value: string) { this.headers[name] = value }
  send(body: unknown) {
    this.body = body
    // finish on the next tick unless the test holds it (FakeXHR.hold)
    if (!FakeXHR.hold) setTimeout(() => this.finish(), 0)
  }
  finish() {
    this.upload.onprogress?.({ lengthComputable: true, loaded: (this.body as File).size })
    this.status = FakeXHR.status
    this.onload?.()
  }
  abort() { this.onabort?.() }
  static hold = false
}

const caps = (over: Record<string, unknown> = {}) => ({
  directUpload: true, storage: 's3', supportedTypes: ['image/png'], maxFileSize: '10MB', ...over,
})

type Route = (url: string, init?: RequestInit) => unknown
let calls: Array<{ url: string; method: string }>

function mockFetch(routes: Record<string, Route>) {
  calls = []
  global.fetch = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    const method = init?.method ?? 'GET'
    calls.push({ url, method })
    const route = routes[`${method} ${url}`]
    if (!route) throw new Error(`unexpected request ${method} ${url}`)
    const out = route(url, init) as { status?: number; body: unknown }
    return Response.json(out.body, { status: out.status ?? 200 })
  }) as never
}

const ok = (data: unknown) => () => ({ body: { success: true, data } })
const fail = (status: number, error: string) => () => ({ status, body: { success: false, error } })

const GET_CAPS = 'GET /api/v1/media/upload'
const PRESIGN = 'POST /api/v1/media/upload/presign'
const CONFIRM = 'POST /api/v1/media/upload/confirm'
const SERVER_UPLOAD = 'POST /api/v1/media/upload'

const presigned = ok({ upload: { url: 'https://bucket.example.test/pending/x', method: 'PUT', headers: { 'Content-Type': 'image/png', 'Content-Length': '4' } }, token: 'tok' })

type Result = ReturnType<typeof setup>
// act() keeps React quiet about the mutation's state updates
const run = async (result: Result, input: unknown) => {
  let out: Awaited<ReturnType<Result['current']['mutateAsync']>> | undefined
  let failure: unknown
  await act(async () => {
    try { out = await result.current.mutateAsync(input as never) } catch (error) { failure = error }
  })
  if (failure) throw failure
  return out!
}

function setup() {
  const client = new QueryClient()
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
  return renderHook(() => useMediaUpload(), { wrapper }).result
}

beforeEach(() => {
  FakeXHR.instances = []
  FakeXHR.status = 200
  FakeXHR.hold = false
  ;(global as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR
})
afterEach(() => { jest.restoreAllMocks() })

describe('useMediaUpload', () => {
  describe('with a driver that takes direct uploads (s3)', () => {
    it('presigns, PUTs to the storage and confirms; the file never goes to /api/v1/media/upload', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: presigned, [CONFIRM]: ok({ media: MEDIA, url: MEDIA.url }) })
      const result = setup()
      const file = image()

      const out = await run(result,[file])

      expect(out.media).toEqual([MEDIA])
      expect(out.urls).toEqual([MEDIA.url])
      expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([GET_CAPS, PRESIGN, CONFIRM])
      expect(calls.some(c => `${c.method} ${c.url}` === SERVER_UPLOAD)).toBe(false)
      expect(FakeXHR.instances).toHaveLength(1)
      expect(FakeXHR.instances[0].url).toBe('https://bucket.example.test/pending/x')
      expect(FakeXHR.instances[0].body).toBe(file)
      // the presigned headers are sent, except those a browser sets itself
      expect(FakeXHR.instances[0].headers).toEqual({ 'Content-Type': 'image/png' })
    })

    it('asks for the capabilities once for several uploads', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: presigned, [CONFIRM]: ok({ media: MEDIA }) })
      const result = setup()
      await run(result,[image()])
      await run(result,[image('b.png')])
      expect(calls.filter(c => `${c.method} ${c.url}` === GET_CAPS)).toHaveLength(1)
    })

    it('reports progress up to 1', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: presigned, [CONFIRM]: ok({ media: MEDIA }) })
      const result = setup()
      const seen: number[] = []

      await run(result,{ files: [image()], onProgress: f => seen.push(f) })

      expect(seen[0]).toBe(0)
      expect(seen[seen.length - 1]).toBe(1)
      expect(seen).toEqual([...seen].sort((a, b) => a - b))
    })

    it('cancels: aborting the signal aborts the PUT, rejects, and never confirms', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: presigned, [CONFIRM]: ok({ media: MEDIA }) })
      FakeXHR.hold = true
      const result = setup()
      const controller = new AbortController()

      // not through act(): the test waits and aborts while the upload is pending
      const upload = result.current.mutateAsync({ files: [image()], signal: controller.signal })
      await new Promise(r => setTimeout(r, 20)) // presign answered, PUT in flight
      expect(FakeXHR.instances).toHaveLength(1)
      controller.abort()

      await expect(upload).rejects.toMatchObject({ name: 'AbortError' })
      expect(calls.some(c => `${c.method} ${c.url}` === CONFIRM)).toBe(false)
    })

    it('a failed PUT is an error and does not confirm (no record)', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: presigned, [CONFIRM]: ok({ media: MEDIA }) })
      FakeXHR.status = 403
      const result = setup()

      await expect(run(result,[image()])).rejects.toThrow('Upload to storage failed with status 403')
      expect(calls.some(c => `${c.method} ${c.url}` === CONFIRM)).toBe(false)
    })

    it('a failed confirm is an error and returns no media', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: presigned, [CONFIRM]: fail(400, 'The uploaded file is not the declared size') })
      const result = setup()

      await expect(run(result,[image()])).rejects.toThrow('The uploaded file is not the declared size')
    })

    it('a refused presign is an error and nothing is sent to the storage', async () => {
      mockFetch({ [GET_CAPS]: ok(caps()), [PRESIGN]: fail(403, 'Permission denied') })
      const result = setup()

      await expect(run(result,[image()])).rejects.toThrow('Permission denied')
      expect(FakeXHR.instances).toHaveLength(0)
    })
  })

  describe('with a driver that does not (local, Vercel Blob)', () => {
    it('posts the file to /api/v1/media/upload and does not presign', async () => {
      mockFetch({
        [GET_CAPS]: ok(caps({ directUpload: false, storage: 'local' })),
        [SERVER_UPLOAD]: ok({ urls: [MEDIA.url], media: [MEDIA], count: 1, storage: 'local' }),
      })
      const result = setup()

      const out = await run(result,[image()])

      expect(out.media).toEqual([MEDIA])
      expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([GET_CAPS, SERVER_UPLOAD])
      expect(FakeXHR.instances).toHaveLength(0)
    })

    it('falls back to the server upload when the capabilities cannot be read', async () => {
      mockFetch({
        [GET_CAPS]: fail(403, 'Permission denied'),
        [SERVER_UPLOAD]: ok({ urls: [MEDIA.url], media: [MEDIA], count: 1, storage: 'local' }),
      })
      const result = setup()

      await run(result,[image()])

      expect(calls.map(c => `${c.method} ${c.url}`)).toEqual([GET_CAPS, SERVER_UPLOAD])
    })
  })

  describe('limits (both paths)', () => {
    it.each([true, false])('rejects a type the server does not accept before sending anything (directUpload: %s)', async (directUpload) => {
      mockFetch({ [GET_CAPS]: ok(caps({ directUpload })) })
      const result = setup()

      await expect(run(result,[new File(['x'], 'a.exe', { type: 'application/x-msdownload' })]))
        .rejects.toThrow('File type application/x-msdownload not allowed.')
      expect(calls).toHaveLength(1)
    })

    it.each([true, false])('rejects a file over the size limit before sending anything (directUpload: %s)', async (directUpload) => {
      mockFetch({ [GET_CAPS]: ok(caps({ directUpload, maxImageSize: '1MB' })) })
      const result = setup()

      await expect(run(result,[image('big.png', 2 * 1024 * 1024)]))
        .rejects.toThrow('File big.png is too large. Maximum size is 1MB.')
      expect(calls).toHaveLength(1)
    })
  })
})
