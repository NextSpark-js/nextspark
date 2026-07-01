/**
 * Small localStorage helper for the API Explorer.
 *
 * Persists the Explorer's working state — session/auth config and per-endpoint
 * request drafts — across reloads and endpoint switches. All access is SSR-safe
 * and swallows quota/parse errors.
 */

const PREFIX = 'nextspark:apiExplorer:'

export function loadState<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(PREFIX + key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

export function saveState(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // ignore quota / serialization errors — persistence is best-effort
  }
}

/** localStorage key for a specific endpoint's saved request draft. */
export function draftKey(method: string, path: string): string {
  return `draft:${method}:${path}`
}
