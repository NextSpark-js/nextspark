/**
 * Base path
 *
 * The app's Next.js `basePath`. Next.js adds it by itself to `<Link>`,
 * `router.push` and `redirect()`, and to nothing else: fetch calls, raw
 * anchors, an `<img src>` or any other asset attribute, the URLs inside markup
 * a page renders as data, URLs a route handler builds from `req.url`, email
 * links, and every URL Better Auth serves or builds (its API routes, the OAuth
 * redirect_uri, its error redirects) need it added here.
 *
 * It reaches the headers a Next.js config writes no more than the rest: the CSP
 * report endpoints are built from the config's own `basePath` constant.
 *
 * Next.js inlines `process.env.__NEXT_ROUTER_BASEPATH` at build time in the
 * client, Node.js and edge bundles (`next/dist/build/define-env.js`), so the
 * expression has to stay written exactly like that.
 */

function basePath(): string {
  // Next.js refuses a basePath that ends in a slash, but the variable can be set
  // without going through its config; `/base/` names the same prefix as `/base`.
  return (process.env.__NEXT_ROUTER_BASEPATH || '').replace(/\/+$/, '')
}

/**
 * Prefixes the base path onto an in-app path written without it
 * (`/dashboard`, never `/base/dashboard`). The path is always prefixed, even
 * when it starts with the same segment as the base path: under
 * `basePath: '/dashboard'`, `/dashboard` is the app's dashboard page and
 * becomes `/dashboard/dashboard`.
 */
export function withBasePath(path: string): string {
  const base = basePath()
  if (!base) return path
  return path === '/' ? base : `${base}${path}`
}

/**
 * The same URL with the base path added, when it is one this app serves and
 * does not already carry it. A URL with a scheme or a protocol-relative one
 * belongs to another origin and is left alone, which is what a link or a
 * request whose target is data — a CTA's link, an uploaded file's URL, an
 * endpoint an explorer was pointed at — needs.
 *
 * Unlike withBasePath(), this takes URLs that are data rather than paths
 * written in the code, and data arrives both ways: an author fills a CTA in
 * by copying what the browser shows, which already has the base path on it.
 * Adding it again would send `/base/contact` to `/base/base/contact`.
 *
 * The base path counts as present only as a whole segment: under `/base`,
 * `/baseline` is a different page and is prefixed like any other.
 */
export function withBasePathIfInApp(url: string): string {
  if (!url.startsWith('/') || url.startsWith('//')) return url
  const base = basePath()
  if (base && carriesBasePath(url, base)) return url
  return withBasePath(url)
}

/**
 * Whether the URL starts with the base path as a whole segment: followed by
 * nothing, by the rest of a path, or by a query or fragment (`/base?x=1`,
 * `/base#pricing`).
 */
function carriesBasePath(url: string, base: string): boolean {
  return url.startsWith(base) && ['', '/', '?', '#'].includes(url.charAt(base.length))
}

/**
 * Sanitised HTML with the base path on the in-app URLs inside it.
 *
 * Markup that reaches a page as data — a post body, a rich-text field — carries
 * its own links and images, and nothing in Next.js prefixes those. The markup
 * is parsed rather than pattern-matched, so a URL written inside a code sample
 * is left as the text it is.
 *
 * Parsing needs a DOM, so this runs in the browser; a server render pass gets
 * the markup back unchanged. `<template>` content is inert, so nothing here
 * loads while the URLs are rewritten.
 *
 * Sanitise first: this trusts the markup it is given and only rewrites URLs.
 */
export function withBasePathInHtml(html: string): string {
  if (!html || !basePath() || typeof document === 'undefined') return html
  const template = document.createElement('template')
  template.innerHTML = html
  for (const element of template.content.querySelectorAll('[href], [src], [poster], [srcset]')) {
    for (const name of ['href', 'src', 'poster']) {
      const value = element.getAttribute(name)
      if (value) element.setAttribute(name, withBasePathIfInApp(value))
    }
    const srcset = element.getAttribute('srcset')
    if (srcset) element.setAttribute('srcset', withBasePathInSrcset(srcset))
  }
  return template.innerHTML
}

/**
 * A srcset with the base path on each of its URLs, and every other character
 * as it was.
 *
 * Candidates are read the way the HTML standard parses a srcset, not split on
 * commas: a URL runs to the next whitespace, so a `data:` URL keeps the commas
 * inside it (`data:image/svg+xml,%3Csvg…`); commas that end that run separate
 * it from the next candidate; and the descriptors after the URL run to the next
 * comma that is not inside parentheses.
 */
export function withBasePathInSrcset(srcset: string): string {
  if (!basePath()) return srcset
  const isSpace = (character: string) => /[\t\n\f\r ]/.test(character)
  let rewritten = ''
  let position = 0

  while (position < srcset.length) {
    const separatorsStart = position
    while (position < srcset.length && (isSpace(srcset[position]) || srcset[position] === ',')) position++
    rewritten += srcset.slice(separatorsStart, position)
    if (position >= srcset.length) break

    const urlStart = position
    while (position < srcset.length && !isSpace(srcset[position])) position++
    const run = srcset.slice(urlStart, position)
    const url = run.replace(/,+$/, '')
    rewritten += withBasePathIfInApp(url) + run.slice(url.length)
    if (url.length < run.length) continue

    const descriptorsStart = position
    let inParentheses = false
    while (position < srcset.length && (inParentheses || srcset[position] !== ',')) {
      if (srcset[position] === '(') inParentheses = true
      else if (srcset[position] === ')') inParentheses = false
      position++
    }
    rewritten += srcset.slice(descriptorsStart, position)
  }

  return rewritten
}

/**
 * The request with the base path in its URL. Next.js hands a route handler
 * the URL without it, while Better Auth matches requests against its own
 * `basePath`, which includes it.
 */
export function withBasePathRequest(request: Request): Request {
  if (!basePath()) return request
  const url = new URL(request.url)
  url.pathname = withBasePath(url.pathname)
  return new Request(url, request)
}
