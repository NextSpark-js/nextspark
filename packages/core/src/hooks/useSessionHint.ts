'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { hasSessionHint, subscribeSessionHint } from '../lib/auth/session-hint'

const signedOutOnServer = () => false

/**
 * Whether this browser is signed in, as the session hint says (see
 * lib/auth/session-hint), following it as it changes: a sign-in or sign-out on
 * the page, or the tab coming back into view. `ready` stays false through the
 * server render and hydration, which cannot read the cookie, so both render the
 * same thing until the effect runs.
 */
export function useSessionHint(): { ready: boolean; signedIn: boolean } {
  const [ready, setReady] = useState(false)
  const signedIn = useSyncExternalStore(subscribeSessionHint, hasSessionHint, signedOutOnServer)

  useEffect(() => {
    setReady(true)
  }, [])

  return { ready, signedIn: ready && signedIn }
}
