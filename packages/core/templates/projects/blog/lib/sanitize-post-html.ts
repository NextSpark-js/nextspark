import DOMPurify from 'dompurify'

/**
 * A post body is HTML written by anyone who can create a post, a team member
 * and not only an owner, so every place that turns it back into DOM sanitises
 * it first: the public page, the editor and the editor's preview.
 *
 * DOMPurify needs a DOM. Where there is none (a server render pass) this
 * returns '' rather than the raw string, failing closed.
 */
export function sanitizePostHtml(html: string | null | undefined): string {
  if (!html) return ''
  if (!DOMPurify.isSupported) return ''
  return DOMPurify.sanitize(html)
}

/**
 * Whether sanitising changes the markup beyond what parsing it already does.
 *
 * Parsing alone rewrites markup that is not unsafe: the browser's editing
 * commands leave a list inside a <p>, and the parser moves it out. So the
 * original and the sanitised result are both parsed and compared as trees; any
 * difference is something the sanitiser took out or altered. It does not read
 * DOMPurify.removed, which DOMPurify documents as unfit for security decisions
 * and which misses changes such as an attribute it rewrites.
 *
 * Both are parsed as a fragment, the way the editable area receives a paste. A
 * document parse moves a leading <script> or <base> into a <head> that a
 * comparison of bodies never sees. A template's content is inert, so nothing in
 * the unsanitised markup runs or loads while it is inspected. Where there is no
 * DOM the answer is true, sending callers down the sanitising path.
 */
export function postHtmlHasUnsafeMarkup(html: string | null | undefined): boolean {
  if (!html) return false
  if (!DOMPurify.isSupported || typeof document === 'undefined') return true
  return !sameMarkup(parseFragment(html), parseFragment(DOMPurify.sanitize(html)))
}

function parseFragment(markup: string): DocumentFragment {
  const template = document.createElement('template')
  template.innerHTML = markup
  return template.content
}

/** Equal trees, including what each <template> holds: isEqualNode does not look inside one. */
function sameMarkup(a: DocumentFragment, b: DocumentFragment): boolean {
  if (!a.isEqualNode(b)) return false
  const templatesA = Array.from(a.querySelectorAll('template'))
  const templatesB = Array.from(b.querySelectorAll('template'))
  return templatesA.length === templatesB.length
    && templatesA.every((template, i) => sameMarkup(template.content, templatesB[i].content))
}
