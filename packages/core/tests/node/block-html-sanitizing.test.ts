/**
 * Rich-text block fields reach the page through dangerouslySetInnerHTML.
 *
 * The markup is the point — the editor writes it deliberately — so the value
 * cannot be escaped, only restricted to tags and attributes that format and
 * nothing else. These check both halves: that scripting is gone, and that what
 * an author actually writes survives.
 *
 * node:test rather than jest: the module reaches htmlparser2, which ships as
 * ESM only, and jest runs CommonJS.
 */
import { describe, test } from 'node:test'
import assert from 'node:assert/strict'

import { sanitizeBlockHtml } from '../../src/lib/blocks/sanitize-html'

/** Nothing in the output may script, navigate on its own, or embed. */
function assertInert(html: string, label: string) {
  for (const forbidden of [
    /<script/i,
    /<iframe/i,
    /<object/i,
    /<embed/i,
    /<form/i,
    /<meta/i,
    /<base/i,
    /\son\w+\s*=/i,
    /javascript:/i,
    /srcdoc/i,
    /url\(/i,
  ]) {
    assert.doesNotMatch(html, forbidden, `${label}: ${forbidden} survived in ${JSON.stringify(html)}`)
  }
}

describe('sanitizeBlockHtml — what must not survive', () => {
  const payloads: [string, string][] = [
    ['inline script', '<script>globalThis.pwned = 1</script>'],
    ['event handler on an image', '<img src=x onerror="globalThis.pwned = 1">'],
    ['event handler on a div', '<div onclick="globalThis.pwned = 1">click</div>'],
    ['javascript: href', '<a href="javascript:globalThis.pwned=1">click</a>'],
    ['JAVASCRIPT: in mixed case', '<a href="JaVaScRiPt:alert(1)">click</a>'],
    ['javascript: padded with whitespace', '<a href=" javascript:alert(1)">click</a>'],
    ['data: href navigating to markup', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
    ['iframe', '<iframe src="https://evil.test"></iframe>'],
    ['iframe with srcdoc', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
    ['object', '<object data="evil.swf"></object>'],
    ['embed', '<embed src="evil.swf">'],
    ['form posting elsewhere', '<form action="https://evil.test"><input name="a"></form>'],
    ['formaction on a button', '<button formaction="javascript:alert(1)">go</button>'],
    ['svg carrying a script', '<svg><script>alert(1)</script></svg>'],
    ['style block', '<style>body{display:none}</style>'],
    ['css url() in an inline style', '<p style="background:url(javascript:alert(1))">x</p>'],
    ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
    ['base tag', '<base href="https://evil.test/">'],
    ['poster on a video', '<video poster="javascript:alert(1)"></video>'],
  ]

  for (const [label, payload] of payloads) {
    test(`strips ${label}`, () => {
      assertInert(sanitizeBlockHtml(payload), label)
    })
  }

  test('a link opening a new tab does not hand over the opener', () => {
    const out = sanitizeBlockHtml('<a href="https://x.test" target="_blank">x</a>')

    assert.match(out, /rel="noopener noreferrer"/)
  })
})

describe('sanitizeBlockHtml — what must survive', () => {
  const kept: [string, string][] = [
    ['paragraphs and emphasis', '<p>Text with <strong>bold</strong> and <em>italics</em></p>'],
    ['headings', '<h1>One</h1><h2>Two</h2><h3>Three</h3>'],
    ['lists', '<ul><li>a</li><li>b</li></ul><ol><li>c</li></ol>'],
    ['a normal link', '<a href="https://example.test/page">link</a>'],
    ['a mailto link', '<a href="mailto:hi@example.test">mail</a>'],
    ['blockquote and code', '<blockquote>quoted</blockquote><pre><code>code()</code></pre>'],
  ]

  for (const [label, markup] of kept) {
    test(`keeps ${label} unchanged`, () => {
      assert.equal(sanitizeBlockHtml(markup), markup)
    })
  }

  test('keeps the classes the editor writes, which carry the formatting', () => {
    assert.match(sanitizeBlockHtml('<p class="text-center text-lg">centred</p>'), /class="text-center text-lg"/)
  })

  test('keeps an image, including a data: source the editor may inline', () => {
    const out = sanitizeBlockHtml('<img src="data:image/png;base64,iVBORw0KGgo=" alt="a">')

    assert.match(out, /<img/)
    assert.match(out, /alt="a"/)
    assert.match(out, /data:image\/png/)
  })

  test('keeps a table', () => {
    const out = sanitizeBlockHtml('<table><tbody><tr><td>d</td></tr></tbody></table>')

    assert.match(out, /<table>/)
    assert.match(out, /<td>d<\/td>/)
  })

  test('keeps an inline style that only formats', () => {
    assert.match(sanitizeBlockHtml('<p style="text-align:center">x</p>'), /text-align/)
  })
})

describe('sanitizeBlockHtml — empty input', () => {
  for (const [label, value] of [
    ['undefined', undefined],
    ['null', null],
    ['empty string', ''],
  ] as [string, string | null | undefined][]) {
    test(`${label} becomes an empty string`, () => {
      assert.equal(sanitizeBlockHtml(value), '')
    })
  }
})

/**
 * A base path reaches this markup through nothing else. Next.js prefixes
 * <Link>, router.push and redirect(); a link or an image inside a stored
 * rich-text value is data, so the prefix is put on here, in the pass that
 * already parses it (#198).
 */
describe('sanitizeBlockHtml — under a base path', () => {
  const ORIGINAL = process.env.__NEXT_ROUTER_BASEPATH
  const underBasePath = (html: string) => {
    process.env.__NEXT_ROUTER_BASEPATH = '/base'
    try {
      return sanitizeBlockHtml(html)
    } finally {
      if (ORIGINAL === undefined) delete process.env.__NEXT_ROUTER_BASEPATH
      else process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL
    }
  }

  for (const [input, expected] of [
    ['<p><a href="/docs">Docs</a></p>', '<p><a href="/base/docs">Docs</a></p>'],
    ['<img src="/uploads/temp/x.png" />', '<img src="/base/uploads/temp/x.png" />'],
    // already carrying it, the way an author copies a link out of the address bar
    ['<a href="/base/docs">Docs</a>', '<a href="/base/docs">Docs</a>'],
    // only starts like the base path, so it is a different page
    ['<a href="/baseline">Baseline</a>', '<a href="/base/baseline">Baseline</a>'],
    ['<a href="https://example.com/docs">Docs</a>', '<a href="https://example.com/docs">Docs</a>'],
    ['<a href="mailto:a@example.com">Mail</a>', '<a href="mailto:a@example.com">Mail</a>'],
  ] as [string, string][]) {
    test(`${input} becomes ${expected}`, () => {
      assert.equal(underBasePath(input), expected)
    })
  }

  test('every candidate of a srcset is prefixed, and its descriptor kept', () => {
    assert.equal(
      underBasePath('<img srcset="/a.png 1x, https://cdn.example/b.png 2x" />'),
      '<img srcset="/base/a.png 1x, https://cdn.example/b.png 2x" />'
    )
  })

  test('a data: candidate in a srcset is refused whole, and leaves no piece of itself behind', () => {
    // sanitize-html checks each srcset candidate against the schemes listed
    // under `srcset`, not under the tag, so `data:` is refused here even though
    // an <img src> may carry it. What must not happen is the URL being cut at
    // its commas and a fragment of it surviving as a relative URL.
    const svg = 'data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270,0,1,1%27%3E%3C/svg%3E'

    assert.equal(underBasePath(`<img srcset="${svg} 1x, /uploads/x.png 2x" />`), '<img srcset="/base/uploads/x.png 2x" />')
  })

  test('a link that opens a new tab still gets rel, and the prefix as well', () => {
    assert.equal(
      underBasePath('<a href="/docs" target="_blank">Docs</a>'),
      '<a href="/base/docs" target="_blank" rel="noopener noreferrer">Docs</a>'
    )
  })

  test('what the sanitiser refuses is still refused', () => {
    assert.equal(underBasePath('<a href="javascript:alert(1)">x</a>'), '<a>x</a>')
    assert.equal(underBasePath('<script>alert(1)</script><p onclick="x()">safe</p>'), '<p>safe</p>')
  })

  test('with no base path the markup comes back as it went in', () => {
    delete process.env.__NEXT_ROUTER_BASEPATH
    assert.equal(sanitizeBlockHtml('<a href="/docs">Docs</a>'), '<a href="/docs">Docs</a>')
    if (ORIGINAL !== undefined) process.env.__NEXT_ROUTER_BASEPATH = ORIGINAL
  })
})
