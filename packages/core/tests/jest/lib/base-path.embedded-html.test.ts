/**
 * Markup that reaches a page as data carries its own links and images, and
 * Next.js prefixes none of them (#198): a post body holding `<a href="/docs">`
 * or `<img src="/uploads/temp/x.png">` renders those under the origin, so
 * under a base path both 404.
 *
 * withBasePathInHtml() parses the markup rather than matching a pattern, so a
 * URL written inside a code sample stays the text it is. The block sanitiser
 * does the same for rich-text fields while it sanitises; that half is covered
 * in tests/node, where htmlparser2's ESM can be loaded.
 */
import { withBasePathInHtml } from '@/core/lib/base-path'

const ORIGINAL_BASE_PATH = process.env.__NEXT_ROUTER_BASEPATH

beforeEach(() => {
  process.env.__NEXT_ROUTER_BASEPATH = '/base'
})

afterEach(() => {
  if (ORIGINAL_BASE_PATH === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
  else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL_BASE_PATH
})

describe('withBasePathInHtml', () => {
  test.each([
    ['<p><a href="/docs">Docs</a></p>', '<p><a href="/base/docs">Docs</a></p>'],
    ['<img src="/uploads/x.png">', '<img src="/base/uploads/x.png">'],
    ['<video poster="/covers/a.png" src="/clips/a.mp4"></video>', '<video poster="/base/covers/a.png" src="/base/clips/a.mp4"></video>'],
    // already carrying it, the way an author copies a link out of the address bar
    ['<a href="/base/docs">Docs</a>', '<a href="/base/docs">Docs</a>'],
    // only starts like the base path, so it is a different page
    ['<a href="/baseline">Baseline</a>', '<a href="/base/baseline">Baseline</a>'],
    ['<a href="https://example.com/docs">Docs</a>', '<a href="https://example.com/docs">Docs</a>'],
    ['<a href="mailto:a@example.com">Mail</a>', '<a href="mailto:a@example.com">Mail</a>'],
  ])('%s becomes %s', (html, expected) => {
    expect(withBasePathInHtml(html)).toBe(expected)
  })

  test('every candidate of a srcset is prefixed, and its descriptor kept', () => {
    expect(withBasePathInHtml('<img srcset="/a.png 1x, https://cdn.example/b.png 2x">')).toBe(
      '<img srcset="/base/a.png 1x, https://cdn.example/b.png 2x">'
    )
  })

  test('leaves a URL that is only text alone', () => {
    // A page showing markup as an example has to keep it as written
    expect(withBasePathInHtml('<pre><code>&lt;a href="/docs"&gt;</code></pre>')).toBe(
      '<pre><code>&lt;a href="/docs"&gt;</code></pre>'
    )
  })

  test('with no base path the markup comes back as it went in', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    expect(withBasePathInHtml('<a href="/docs">Docs</a>')).toBe('<a href="/docs">Docs</a>')
  })

  test('empty markup stays empty', () => {
    expect(withBasePathInHtml('')).toBe('')
  })
})
