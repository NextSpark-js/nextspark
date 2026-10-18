'use client'

import { useEffect, useState, type ComponentType } from 'react'

/**
 * What the root layout renders when consent is enabled. The banner and the loaders are a chunk of their own that the
 * browser requests after hydration, so a route's initial JavaScript carries this wrapper and nothing of them (a client
 * component the layout imports is in the entry chunks of every route, enabled or not).
 */
export function LazyConsentManager({ nonce }: { nonce?: string }) {
  const [Manager, setManager] = useState<ComponentType<{ nonce?: string }> | null>(null)
  useEffect(() => {
    let live = true
    import('./ConsentManager').then((m) => live && setManager(() => m.ConsentManager))
    return () => {
      live = false
    }
  }, [])
  return Manager && <Manager nonce={nonce} />
}
