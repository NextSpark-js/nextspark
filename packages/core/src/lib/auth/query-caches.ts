/**
 * The query caches of the page, for the sign-in flows to empty.
 *
 * Cached queries (teams, entity lists, the subscription) belong to whoever was signed in. The provider that owns a cache
 * (QueryProvider) registers it here, and `useAuthActions` empties every registered cache when someone signs in. It
 * lives apart from the provider so that `useAuth` does not import React Query: a page that has no data provider,
 * like the public and login pages with `providers.scope: 'groups'`, ships none of the library.
 */
const caches = new Set<() => void>()

/** Registers a cache's `clear` and returns the function that removes it (an effect cleanup). */
export function registerQueryCache(clear: () => void): () => void {
  caches.add(clear)
  return () => {
    caches.delete(clear)
  }
}

/** Empties every registered cache: what the previous user left in them must not reach the next one. */
export function clearQueryCaches() {
  caches.forEach(clear => clear())
}
