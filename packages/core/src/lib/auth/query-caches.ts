/**
 * The query caches of the page, for the sign-in flows to empty.
 *
 * Cached queries (teams, entity lists, the subscription) belong to whoever was signed in. The provider that owns a cache
 * (QueryProvider) registers it here, and `useAuthActions` empties every registered cache when someone signs in. It
 * lives apart from the provider so that `useAuth` does not import React Query: a page that has no data provider,
 * like the public and login pages with `providers.scope: 'groups'`, ships none of the library.
 */
const caches = new Set<() => void>()
let epoch = 0

/**
 * How many times the caches were emptied. A cache whose provider can be hidden without being unmounted (Cache Components
 * keeps visited routes in `<Activity mode="hidden">`, which drops their effects and so their registration) compares it with
 * the value it saw last and empties itself when it moved, so it cannot show what the previous user left.
 */
export function getQueryCacheEpoch() {
  return epoch
}

/** Registers a cache's `clear` and returns the function that removes it (an effect cleanup). */
export function registerQueryCache(clear: () => void): () => void {
  caches.add(clear)
  return () => {
    caches.delete(clear)
  }
}

/** Empties every registered cache: what the previous user left in them must not reach the next one. */
export function clearQueryCaches() {
  epoch++
  caches.forEach(clear => clear())
}
