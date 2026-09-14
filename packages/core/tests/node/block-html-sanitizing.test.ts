/**
 * Rich-text block fields reach the page through dangerouslySetInnerHTML.
 *
 * The markup is the point — the editor writes it deliberately — so the value
 * cannot be escaped, only restricted to tags and attributes that format and
 * nothing else. These check both halves: that scripting is gone, and that what
 * an author actually writes survives.
 *
 * node:test rather than jest: the module reaches htmlparser2, which ships as
 * ESM only, and jest runs CommonJS. `--conditions=react-server` is what makes
 * the `server-only` import resolve to its no-op outside Next.
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
