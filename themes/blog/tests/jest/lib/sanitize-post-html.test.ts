import { postHtmlHasUnsafeMarkup, sanitizePostHtml } from '@/themes/blog/lib/sanitize-post-html'

describe('sanitizePostHtml', () => {
  it('keeps formatting and drops what scripts', () => {
    const out = sanitizePostHtml('<p><strong>bold</strong></p><img src="x" onerror="globalThis.pwned = 1"><script>globalThis.pwned = 1</script>')
    expect(out).toContain('<strong>bold</strong>')
    expect(out).not.toMatch(/onerror|<script/)
  })

  it('returns an empty string for no input', () => {
    expect(sanitizePostHtml('')).toBe('')
    expect(sanitizePostHtml(null)).toBe('')
    expect(sanitizePostHtml(undefined)).toBe('')
  })
})

describe('postHtmlHasUnsafeMarkup', () => {
  it('is true when sanitising removes or alters anything', () => {
    for (const unsafe of [
      '<img src="x" onerror="globalThis.pwned = 1">',
      '<p>x</p><script>globalThis.pwned = 1</script>',
      '<a href="javascript:globalThis.pwned = 1">x</a>',
      '<img title=" x " onerror="globalThis.pwned = 1" src="bad">',
      '<p onclick="globalThis.pwned = 1">x</p>',
      '<a title=" y " href=" javascript:globalThis.pwned = 1">x</a>',
      '<script>globalThis.pwned = 1</script>',
      '<head><base href="https://attacker.test/"></head><p>safe</p>',
      '<template><img src="x" onerror="globalThis.pwned = 1"></template>',
      '<template><template><img src="x" onerror="globalThis.pwned = 1"></template></template>',
    ]) {
      expect(postHtmlHasUnsafeMarkup(unsafe)).toBe(true)
    }
  })

  it('is false for markup the parser only re-nests or re-serialises', () => {
    for (const safe of [
      '<p><ul><li>item</li></ul></p>',
      '<p>plain <em>text</em></p>',
      '  <p>leading whitespace</p>',
      '<p>a&nbsp;b<br></p>',
      '<ol><li>one</li><li><b>two</b></li></ol>',
      '<p style="text-align: center">centred</p>',
    ]) {
      expect(postHtmlHasUnsafeMarkup(safe)).toBe(false)
    }
  })
})
