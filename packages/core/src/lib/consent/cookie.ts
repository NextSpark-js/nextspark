/**
 * The consent cookie: what it holds, how it is read and how it is written. Pure, so the browser store, the server
 * reader and the tests share one definition.
 *
 * The value is the URI-encoded JSON `{"v":"1:analytics+marketing","g":["analytics"],"t":1760000000000}`:
 * `v` is the version (the configured `version` and the offered categories, so changing either asks again),
 * `g` the optional categories granted and `t` when the choice was made.
 */

import type { ConsentConfig, ConsentOptionalCategory } from '../config/types'

export type { ConsentOptionalCategory }

export interface ConsentCategories {
  /** Always on: the app cannot work without it. */
  necessary: true
  analytics: boolean
  marketing: boolean
}

export interface ConsentState {
  categories: ConsentCategories
  /** Whether the visitor has made a choice that is still valid (same version, not expired). */
  hasChosen: boolean
}

export interface ResolvedConsentConfig {
  enabled: boolean
  cookieName: string
  maxAgeDays: number
  version: string
  categories: ConsentOptionalCategory[]
  loaders: NonNullable<ConsentConfig['loaders']>
}

export const CONSENT_EVENT = 'nextspark:consent'
export const CONSENT_OPEN_EVENT = 'nextspark:consent:open'
export const DEFAULT_COOKIE_NAME = 'nextspark_consent'
const MIN_DAYS = 180
const MAX_DAYS = 365
const DAY_MS = 86_400_000
const OPTIONAL: readonly ConsentOptionalCategory[] = ['analytics', 'marketing']

export const DENIED: ConsentCategories = Object.freeze({ necessary: true, analytics: false, marketing: false })
export const GRANTED: ConsentCategories = Object.freeze({ necessary: true, analytics: true, marketing: true })

/** The configuration with its defaults filled in and `maxAgeDays` held to 6 to 12 months. */
export function resolveConsentConfig(config: ConsentConfig | undefined): ResolvedConsentConfig {
  const categories = OPTIONAL.filter((c) => (config?.categories ?? OPTIONAL).includes(c))
  const days = Number.isFinite(config?.maxAgeDays) ? (config?.maxAgeDays as number) : MIN_DAYS
  return {
    enabled: config?.enabled === true,
    cookieName: config?.cookieName || DEFAULT_COOKIE_NAME,
    maxAgeDays: Math.min(MAX_DAYS, Math.max(MIN_DAYS, days)),
    version: `${config?.version ?? 1}:${categories.join('+')}`,
    categories,
    loaders: config?.loaders ?? {},
  }
}

/** Every offered category granted, the rest off. */
export function categoriesFrom(granted: readonly string[], config: ResolvedConsentConfig): ConsentCategories {
  return {
    necessary: true,
    analytics: config.categories.includes('analytics') && granted.includes('analytics'),
    marketing: config.categories.includes('marketing') && granted.includes('marketing'),
  }
}

/** The value of cookie `name` in a `Cookie` header or `document.cookie` string, or undefined. */
export function readCookie(header: string | null | undefined, name: string): string | undefined {
  for (const part of (header ?? '').split(';')) {
    const eq = part.indexOf('=')
    if (eq !== -1 && part.slice(0, eq).trim() === name) return part.slice(eq + 1).trim()
  }
  return undefined
}

const NO_CHOICE: ConsentState = { categories: DENIED, hasChosen: false }

/**
 * The state a cookie value stands for. A missing, malformed, other-version or expired value is "no choice": everything
 * optional off and `hasChosen` false, so the banner asks again.
 */
export function parseConsentCookie(raw: string | undefined, config: ResolvedConsentConfig, now = Date.now()): ConsentState {
  if (!raw) return NO_CHOICE
  try {
    const value = JSON.parse(decodeURIComponent(raw)) as { v?: unknown; g?: unknown; t?: unknown }
    if (value.v !== config.version || !Array.isArray(value.g) || typeof value.t !== 'number') return NO_CHOICE
    if (value.t + config.maxAgeDays * DAY_MS < now) return NO_CHOICE
    return { categories: categoriesFrom(value.g, config), hasChosen: true }
  } catch {
    return NO_CHOICE
  }
}

/** The `document.cookie` assignment that stores `categories`. `secure` is for HTTPS in production. */
export function serializeConsentCookie(
  categories: ConsentCategories,
  config: ResolvedConsentConfig,
  { secure = false, now = Date.now() }: { secure?: boolean; now?: number } = {},
): string {
  const granted = OPTIONAL.filter((c) => categories[c] && config.categories.includes(c))
  const value = encodeURIComponent(JSON.stringify({ v: config.version, g: granted, t: now }))
  return `${config.cookieName}=${value}; Path=/; Max-Age=${config.maxAgeDays * 86_400}; SameSite=Lax${secure ? '; Secure' : ''}`
}
