/**
 * Pure helpers shared by the server (public pages) and the browser (block editor canvas) to swap stored
 * media URLs for signed ones inside block props (#361). No imports: safe in both bundles.
 */

const HTTP_URL = /^https?:\/\//

/** Every string of `value`, at any depth, that is an http(s) URL. */
export function collectHttpUrls(value: unknown, found: Set<string> = new Set()): Set<string> {
  if (typeof value === 'string') {
    if (HTTP_URL.test(value)) found.add(value)
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectHttpUrls(item, found))
  } else if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectHttpUrls(item, found))
  }
  return found
}

/** A copy of `value` where each string that is a key of `map` is replaced by its value; the rest is shared as it is. */
export function replaceUrls<T>(value: T, map: Record<string, string>): T {
  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') return Object.hasOwn(map, node) ? map[node] : node
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === 'object') return Object.fromEntries(Object.entries(node).map(([key, item]) => [key, walk(item)]))
    return node
  }
  return walk(value) as T
}
