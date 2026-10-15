/**
 * S192 — input validation of the media routes:
 *   /api/v1/media (GET), /api/v1/media/[id] (GET, PATCH, DELETE), /api/v1/media/[id]/tags (GET, POST, PUT),
 *   /api/v1/media/check-duplicates (POST), /api/v1/media-tags (POST), /api/v1/media/upload (POST).
 */

import { routeHarness, makeReq, asJson, idParams, describeMalformedBodies, describeRejectedValues, expectCleanRejection, sessionAs, MEMBER, bodyOf } from './__helpers__/route-harness'

const mockCheckPermission = jest.fn()
jest.mock('@/core/lib/permissions/check', () => ({ checkPermission: (...a: unknown[]) => mockCheckPermission(...a) }))
const media = {
  list: jest.fn(), getById: jest.fn(), update: jest.fn(), softDelete: jest.fn(), create: jest.fn(), findDuplicates: jest.fn(),
  getTags: jest.fn(), createTag: jest.fn(), addTag: jest.fn(), setTags: jest.fn(), removeTag: jest.fn(), getMediaTags: jest.fn(),
}
jest.mock('@/core/lib/services/media.service', () => ({ MediaService: new Proxy({}, { get: (_t, name: string) => (media as Record<string, unknown>)[name] }) }))
jest.mock('@/core/lib/config/config-sync', () => ({ MEDIA_CONFIG: undefined }))
jest.mock('@vercel/blob', () => ({ put: jest.fn() }))
jest.mock('fs/promises', () => ({ writeFile: jest.fn(), mkdir: jest.fn() }))

import { GET as listMedia } from '@/app/api/v1/media/route'
import { GET as getMedia, PATCH as patchMedia, DELETE as deleteMedia } from '@/app/api/v1/media/[id]/route'
import { POST as addMediaTag, PUT as setMediaTags } from '@/app/api/v1/media/[id]/tags/route'
import { POST as checkDuplicates } from '@/app/api/v1/media/check-duplicates/route'
import { POST as createMediaTag } from '@/app/api/v1/media-tags/route'
import { POST as upload } from '@/app/api/v1/media/upload/route'

const { mocks } = routeHarness
type Body = Parameters<typeof makeReq>[2]
const MEDIA_ROW = { id: 'media-1', filename: 'a.png', title: null, alt: null, caption: null }
const writesNothing = () => {
  for (const name of ['update', 'softDelete', 'create', 'createTag', 'addTag', 'setTags', 'removeTag'] as const) {
    expect(media[name]).not.toHaveBeenCalled()
  }
}

beforeEach(() => {
  routeHarness.reset()
  Object.values(media).forEach(fn => fn.mockReset())
  mockCheckPermission.mockResolvedValue(true)
  mocks.authenticateRequest.mockResolvedValue(sessionAs(MEMBER))
  media.list.mockResolvedValue({ items: [], total: 0 })
  media.getById.mockResolvedValue(MEDIA_ROW)
  media.update.mockImplementation(async (_id: string, _user: string, data: Record<string, unknown>) => ({ ...MEDIA_ROW, ...data }))
  media.findDuplicates.mockResolvedValue([])
  media.createTag.mockImplementation(async (name: string) => ({ id: 'tag-1', name }))
  media.getTags.mockResolvedValue([])
})

describe('GET /api/v1/media — query parameters', () => {
  const list = (query: string) => listMedia(makeReq('GET', `/api/v1/media${query}`), undefined as never)

  test.each([
    ['a limit of zero', '?limit=0'],
    ['a limit over the maximum', '?limit=101'],
    ['a limit of text', '?limit=many'],
    ['a fractional limit', '?limit=1.5'],
    ['a negative offset', '?offset=-1'],
    ['an offset of text', '?offset=abc'],
    ['an order field that does not exist', '?orderBy=password'],
    ['an order direction that does not exist', '?orderDir=sideways'],
    ['a type that does not exist', '?type=audio'],
  ])('rejects %s with 400 and lists nothing', async (_label, query) => {
    await expectCleanRejection(await list(query), { status: 400 })
    expect(media.list).not.toHaveBeenCalled()
  })

  test.each([
    ['unknown parameters', '?colour=brown'],
    ['repeated parameters (the last is read)', '?limit=5&limit=7'],
    ['empty tag lists', '?tagIds=&tagSlugs='],
    ['a long search string', `?search=${encodeURIComponent('ñ'.repeat(20_000))}`],
  ])('answers %s with a normal 200', async (_label, query) => {
    expect((await list(query)).status).toBe(200)
  })

  test.failing('refuses a tag list with thousands of entries instead of passing it to the query (finding F15)', async () => {
    const tagIds = Array.from({ length: 5000 }, (_, i) => `t${i}`).join(',')
    await expectCleanRejection(await list(`?tagIds=${tagIds}`), { status: 400 })
  })
})

describe('PATCH /api/v1/media/[id]', () => {
  const invoke = (body: Body, id = 'media-1') => patchMedia(makeReq('PATCH', `/api/v1/media/${id}`, body), idParams({ id }))

  describe('bodies', () => {
    // an unreadable body is thrown inside a try whose catch answers 500 with the parser message as the error (finding F8/F12)
    describeMalformedBodies(invoke, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] })
  })

  describe('values', () => {
    describeRejectedValues(invoke, [
      ['a title over 255 characters', { title: 'x'.repeat(256) }],
      ['an alt text over 500 characters', { alt: 'x'.repeat(501) }],
      ['a caption over 1000 characters', { caption: 'x'.repeat(1001) }],
      ['a caption far over 1000 characters', { caption: 'x'.repeat(500_000) }],
      ['a title given a number', { title: 5 }],
      ['a title given an object', { title: { en: 'x' } }],
      ['an alt text given an array', { alt: ['x'] }],
    ])

    test('the limits themselves are accepted', async () => {
      const response = await invoke(asJson({ title: 'x'.repeat(255), alt: 'x'.repeat(500), caption: 'x'.repeat(1000) }))
      expect(response.status).toBe(200)
    })

    test('extra fields are ignored and never passed on', async () => {
      await invoke(asJson({ title: 'ok', url: 'https://elsewhere.example/x.png', teamId: 'other-team', userId: 'someone-else' }))
      const data = media.update.mock.calls[0][2] as Record<string, unknown>
      expect(Object.keys(data)).toEqual(['title'])
    })

    test.each([['accented Latin', 'Ñandú junto al río'], ['CJK', '日本語のタイトル'], ['right-to-left', 'عنوان الصورة'], ['emoji ZWJ', 'Perro 🐕‍🦺']])('stores and returns a %s title unchanged', async (_label, title) => {
      const response = await invoke(asJson({ title }))
      expect(response.status).toBe(200)
      expect(media.update.mock.calls[0][2]).toEqual({ title })
      expect(((await bodyOf(response)).data as { title: string }).title).toBe(title)
    })
  })

  // the 500 body carries the thrown error's message as its error text (finding F12)
  test.failing('the server-error body does not repeat internal error text', async () => {
    media.update.mockRejectedValue(new Error('connection to server at "10.0.0.5", port 5432 failed'))
    const response = await invoke(asJson({ title: 'ok' }))
    expect(JSON.stringify(await bodyOf(response))).not.toContain('10.0.0.5')
  })
})

describe('media ids that match nothing (ids are TEXT, so any shape is just unknown)', () => {
  beforeEach(() => { media.getById.mockResolvedValue(null); media.update.mockResolvedValue(null); media.softDelete.mockResolvedValue(false) })
  const IDS: Array<[string, string]> = [['text', 'not-a-uuid'], ['an over-long string', 'a'.repeat(5000)], ['non-ASCII text', 'foto-日本語']]

  test.each(IDS)('GET %s is answered 404', async (_label, id) => {
    await expectCleanRejection(await getMedia(makeReq('GET', '/api/v1/media/x'), idParams({ id })), { status: 404 })
  })

  test.each(IDS)('PATCH %s is answered 404', async (_label, id) => {
    await expectCleanRejection(await patchMedia(makeReq('PATCH', '/api/v1/media/x', asJson({ title: 'ok' })), idParams({ id })), { status: 404 })
  })

  test.each(IDS)('DELETE %s is answered 404', async (_label, id) => {
    await expectCleanRejection(await deleteMedia(makeReq('DELETE', '/api/v1/media/x'), idParams({ id })), { status: 404 })
  })
})

describe('/api/v1/media/[id]/tags', () => {
  const add = (body: Body) => addMediaTag(makeReq('POST', '/api/v1/media/media-1/tags', body), idParams({ id: 'media-1' }))
  const set = (body: Body) => setMediaTags(makeReq('PUT', '/api/v1/media/media-1/tags', body), idParams({ id: 'media-1' }))

  describe('POST — bodies', () => { describeMalformedBodies(add, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] }) })
  describe('PUT — bodies', () => { describeMalformedBodies(set, { defects: ['a missing body', 'an empty body', 'a body that is not JSON'] }) })

  describe('POST — values', () => {
    describeRejectedValues(add, [
      ['an empty object', {}],
      ['a tag id given a number', { tagId: 5 }],
      ['a tag id that is empty', { tagId: '' }],
      ['a tag id given an array', { tagId: ['t1'] }],
    ])
  })

  describe('PUT — values', () => {
    describeRejectedValues(set, [
      ['an empty object', {}],
      ['tag ids given text', { tagIds: 't1' }],
      ['tag ids given an object', { tagIds: { 0: 't1' } }],
      ['tag ids holding numbers', { tagIds: [1, 2] }],
      ['tag ids holding an empty string', { tagIds: [''] }],
    ])

    test.failing('refuses a list with thousands of tag ids instead of passing it on (finding F15)', async () => {
      const response = await set(asJson({ tagIds: Array.from({ length: 5000 }, (_, i) => `t${i}`) }))
      await expectCleanRejection(response, { status: 400 })
    })
  })
})

describe('POST /api/v1/media/check-duplicates', () => {
  const invoke = (body: Body) => checkDuplicates(makeReq('POST', '/api/v1/media/check-duplicates', body), undefined as never)

  // the body is read as `body.files` before it is checked: unreadable bodies and null are 500 (finding F8)
  describeMalformedBodies(invoke, { defects: ['a missing body', 'an empty body', 'a body that is not JSON', 'a JSON null'] })

  describeRejectedValues(invoke, [
    ['no files', {}],
    ['files given text', { files: 'a.png' }],
    ['files given an object', { files: { filename: 'a.png' } }],
    ['an empty file list', { files: [] }],
  ])

  test.failing.each([
    ['an entry that is null', [null]],
    ['an entry that is text', ['a.png']],
    ['an entry without a file name', [{ fileSize: 10 }]],
    ['a file size given text', [{ filename: 'a.png', fileSize: 'big' }]],
  ])('rejects a file list with %s with 400', async (_label, files) => {
    await expectCleanRejection(await invoke(asJson({ files })), { status: 400 })
    expect(media.findDuplicates).not.toHaveBeenCalled()
  })

  // one query per entry and no maximum on the list (finding F15)
  test.failing('refuses a list of thousands of files instead of running a query for each', async () => {
    await invoke(asJson({ files: Array.from({ length: 5000 }, (_, i) => ({ filename: `f${i}.png`, fileSize: 1 })) }))
    expect(media.findDuplicates.mock.calls.length).toBeLessThanOrEqual(100)
  })
})

describe('POST /api/v1/media-tags', () => {
  const invoke = (body: Body) => createMediaTag(makeReq('POST', '/api/v1/media-tags', body), undefined as never)

  describeMalformedBodies(invoke, { defects: ['a missing body', 'an empty body', 'a body that is not JSON', 'a JSON null'] })

  describeRejectedValues(invoke, [
    ['an empty object', {}],
    ['a name given a number', { name: 5 }],
    ['a name that is empty', { name: '' }],
    ['a name that is only whitespace', { name: '   ' }],
    ['a name given an array', { name: ['a'] }],
  ])

  // no maximum length on a tag name (finding F15)
  test.failing('refuses a tag name far over any sane length', async () => {
    await expectCleanRejection(await invoke(asJson({ name: 'x'.repeat(500_000) })), { status: 400 })
    expect(media.createTag).not.toHaveBeenCalled()
  })

  test.each([['accented Latin', 'Año nuevo'], ['CJK', '日本語'], ['right-to-left', 'وسم'], ['emoji', 'perros 🐕‍🦺']])('stores a %s tag name unchanged', async (_label, name) => {
    const response = await invoke(asJson({ name }))
    expect(response.status).toBe(201)
    expect(media.createTag.mock.calls[0][0]).toBe(name)
  })
})

describe('POST /api/v1/media/upload', () => {
  const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])
  const fileOf = (name: string, type: string, bytes: Uint8Array) => Object.assign(new File([bytes], name, { type }), { arrayBuffer: async () => bytes.buffer })
  const send = (entries: FormDataEntryValue[]) => upload({ ...makeReq('POST', '/api/v1/media/upload'), formData: async () => ({ getAll: () => entries }) } as never)
  const sendUnreadable = () => upload({ ...makeReq('POST', '/api/v1/media/upload'), formData: async () => { throw new TypeError('Content-Type was not one of "multipart/form-data" or "application/x-www-form-urlencoded".') } } as never)

  beforeEach(() => { process.env.BLOB_READ_WRITE_TOKEN = 'vercel_blob_test'; media.create.mockResolvedValue({ id: 'media-9' }) })
  afterAll(() => { delete process.env.BLOB_READ_WRITE_TOKEN })

  test('a request with no files is answered 400 and stores nothing', async () => {
    await expectCleanRejection(await send([]), { status: 400 })
    writesNothing()
  })

  test('fields that are not files are ignored, and the request is answered 400', async () => {
    await expectCleanRejection(await send(['not a file', '42']), { status: 400 })
    writesNothing()
  })

  test.each([
    ['a type that is not allowed', 'page.html', 'text/html'],
    ['an empty type', 'noext', ''],
    ['an executable type', 'run.exe', 'application/x-msdownload'],
  ])('a file with %s is answered 400 and stores nothing', async (_label, name, type) => {
    await expectCleanRejection(await send([fileOf(name, type, PNG)]), { status: 400 })
    writesNothing()
  })

  test('a file whose bytes do not match its declared type is answered 400 and stores nothing', async () => {
    await expectCleanRejection(await send([fileOf('a.png', 'image/png', Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8]))]), { status: 400 })
    writesNothing()
  })

  test('a file over the size limit is answered 400 and stores nothing', async () => {
    const big = Object.assign(new File([PNG], 'big.png', { type: 'image/png' }), { arrayBuffer: async () => PNG.buffer })
    Object.defineProperty(big, 'size', { value: 50 * 1024 * 1024 })
    await expectCleanRejection(await send([big]), { status: 400 })
    writesNothing()
  })

  test('a unicode file name is stored sanitized and never as a path', async () => {
    const response = await send([fileOf('Fotografía 日本語 🐕.png', 'image/png', PNG)])
    expect(response.status).toBe(200)
    const filename = media.create.mock.calls[0][2].filename as string
    expect(filename).not.toMatch(/[\\/]/)
    expect(filename.length).toBeGreaterThan(0)
  })

  // A body that is not multipart makes formData() throw; the catch answers 500 and repeats the parser message (finding F16).
  test.failing('a body that is not multipart is answered 4xx without internal text', async () => {
    await expectCleanRejection(await sendUnreadable(), {})
    writesNothing()
  })

  // A file of zero bytes is skipped without a word and the request answers 200 "uploaded" with a count of 0 (finding F17).
  test.failing('a file of zero bytes is answered 400 instead of 200 with a count of 0', async () => {
    const response = await send([fileOf('empty.png', 'image/png', new Uint8Array())])
    await expectCleanRejection(response, { status: 400 })
  })

  // No maximum number of files per request (finding F15).
  test.failing('refuses hundreds of files in one request', async () => {
    const response = await send(Array.from({ length: 500 }, () => fileOf('a.png', 'image/png', PNG)))
    await expectCleanRejection(response, { status: 400 })
  })
})
