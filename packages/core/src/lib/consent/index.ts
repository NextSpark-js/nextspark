'use client'

/**
 * The consent API for client code (#272): `useConsent()`, the `nextspark:consent` window event and
 * `openConsentSettings()`. Plugins and project code import it from `@nextsparkjs/core/lib/consent`.
 *
 * With `consent.enabled` off in app.config, nothing is gated: `useConsent()` reports every category as granted and
 * `enabled` false, and `accept`, `reject` and `update` do nothing.
 */

import { useCallback, useSyncExternalStore } from 'react'
import { CONSENT_CONFIG } from '../config/public-config-client'
import {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  DENIED,
  GRANTED,
  categoriesFrom,
  parseConsentCookie,
  readCookie,
  serializeConsentCookie,
  type ConsentCategories,
  type ConsentOptionalCategory,
  type ConsentState,
  type ResolvedConsentConfig,
} from './cookie'

export {
  CONSENT_EVENT,
  CONSENT_OPEN_EVENT,
  parseConsentCookie,
  resolveConsentConfig,
  serializeConsentCookie,
  type ConsentCategories,
  type ConsentOptionalCategory,
  type ConsentState,
} from './cookie'

export interface UseConsent extends ConsentState {
  /** `consent.enabled` in app.config. When false everything is granted and nothing is asked. */
  enabled: boolean
  /** Grant every offered category. */
  accept: () => void
  /** Refuse every optional category. */
  reject: () => void
  /** Set some categories and keep the rest as they are. */
  update: (categories: Partial<Record<ConsentOptionalCategory, boolean>>) => void
}

export type ConsentEventDetail = ConsentState

const NOT_ASKED: ConsentState = { categories: GRANTED, hasChosen: true }
const SERVER_STATE: ConsentState = { categories: DENIED, hasChosen: false }
const listeners = new Set<() => void>()
let cache: { raw: string; config: ResolvedConsentConfig; state: ConsentState } | undefined

function snapshot(config: ResolvedConsentConfig): ConsentState {
  if (!config.enabled) return NOT_ASKED
  const raw = document.cookie
  if (cache?.raw !== raw || cache.config !== config) {
    cache = { raw, config, state: parseConsentCookie(readCookie(raw, config.cookieName), config) }
  }
  return cache.state
}

function write(categories: ConsentCategories, config: ResolvedConsentConfig) {
  if (!config.enabled || typeof document === 'undefined') return
  document.cookie = serializeConsentCookie(categories, config, {
    secure: process.env.NODE_ENV === 'production' && window.location.protocol === 'https:',
  })
  const state = snapshot(config)
  window.dispatchEvent(new CustomEvent<ConsentEventDetail>(CONSENT_EVENT, { detail: state }))
  listeners.forEach((l) => l())
}

/** The current state, outside React. Before the browser is there it is the server state: nothing optional granted. */
export function getConsentState(config: ResolvedConsentConfig = CONSENT_CONFIG): ConsentState {
  return typeof document === 'undefined' ? SERVER_STATE : snapshot(config)
}

/** Reopen the banner's settings, from a "Cookie settings" link of your own or from code. */
export function openConsentSettings() {
  if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(CONSENT_OPEN_EVENT))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => void listeners.delete(listener)
}

/** The consent state and the actions that change it. Re-renders when the choice changes. */
export function useConsent(config: ResolvedConsentConfig = CONSENT_CONFIG): UseConsent {
  const state = useSyncExternalStore(subscribe, () => snapshot(config), () => (config.enabled ? SERVER_STATE : NOT_ASKED))
  const update = useCallback(
    (next: Partial<Record<ConsentOptionalCategory, boolean>>) => {
      const current = snapshot(config).categories
      write({ ...current, ...next, necessary: true }, config)
    },
    [config],
  )
  const accept = useCallback(() => write(categoriesFrom(config.categories, config), config), [config])
  const reject = useCallback(() => write(DENIED, config), [config])
  return { ...state, enabled: config.enabled, accept, reject, update }
}
