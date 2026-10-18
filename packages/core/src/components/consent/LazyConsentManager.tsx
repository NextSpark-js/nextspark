'use client'

import { useEffect, useState, type ComponentType } from 'react'
import { CONSENT_OPEN_EVENT } from '../../lib/consent/cookie'

/**
 * What the root layout renders when consent is enabled. The banner and the loaders are a chunk of their own that the
 * browser requests after hydration, so a route's initial JavaScript carries this wrapper and nothing of them (a client
 * component the layout imports is in the entry chunks of every route, enabled or not).
 *
 * A "Cookie settings" click before that chunk has loaded is not lost: this wrapper listens for it until the manager
 * is there, and the manager then opens on its settings.
 */
export function LazyConsentManager({ nonce }: { nonce?: string }) {
  const [Manager, setManager] = useState<ComponentType<{ nonce?: string; openOnMount?: boolean }> | null>(null)
  const [openOnMount, setOpenOnMount] = useState(false)
  useEffect(() => {
    const early = () => setOpenOnMount(true)
    window.addEventListener(CONSENT_OPEN_EVENT, early)
    let live = true
    import('./ConsentManager').then((m) => live && setManager(() => m.ConsentManager))
    return () => {
      live = false
      window.removeEventListener(CONSENT_OPEN_EVENT, early)
    }
  }, [])
  return Manager && <Manager nonce={nonce} openOnMount={openOnMount} />
}
