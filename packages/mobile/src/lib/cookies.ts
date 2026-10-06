/**
 * Native cookie store cleanup
 *
 * React Native's fetch keeps the cookies a server sets, Better Auth's session
 * cookie among them, in the platform cookie store (NSHTTPCookieStorage on iOS,
 * the CookieManager Android shares with WebViews). Clearing the stored token is
 * not enough to sign out: requests keep authenticating with that cookie.
 *
 * Emptying the store needs the native module of
 * `@preeternal/react-native-cookie-manager`, an optional peer dependency. Without
 * it (not installed, or Expo Go, which does not ship its native code) this is a
 * no-op that warns once.
 */

import { Platform } from 'react-native'

interface CookieManager {
  clearAll(useWebKit?: boolean): Promise<boolean>
  get(url: string, useWebKit?: boolean): Promise<Record<string, unknown>>
}

const COOKIE_MANAGER_PACKAGE = '@preeternal/react-native-cookie-manager'

let warnedUnavailable = false

function loadCookieManager(): CookieManager | null {
  try {
    // A literal require directly inside `try` is an optional dependency for
    // Metro: the app bundles without the package and the require throws at
    // runtime. It also throws in Expo Go, where the package's JS is present but
    // its TurboModule lookup fails on import.
    const cookieManagerModule = require('@preeternal/react-native-cookie-manager')
    return (cookieManagerModule?.default ?? cookieManagerModule) as CookieManager
  } catch {
    return null
  }
}

/**
 * Remove every cookie from the app's native cookie store.
 * Never throws: sign-out has to finish even when cookies cannot be cleared.
 */
export async function clearNativeCookies(): Promise<void> {
  // On web the browser owns the cookies, and JS cannot remove HttpOnly ones.
  if (Platform.OS === 'web') return

  const cookieManager = loadCookieManager()
  if (!cookieManager) {
    if (!warnedUnavailable) {
      warnedUnavailable = true
      console.warn(
        `[@nextsparkjs/mobile] Native cookies were not cleared on sign-out: ${COOKIE_MANAGER_PACKAGE} is not available. ` +
          'Install it and run a development build (Expo Go does not include its native module).'
      )
    }
    return
  }

  try {
    await cookieManager.clearAll()
  } catch (error) {
    console.warn('[@nextsparkjs/mobile] Failed to clear native cookies on sign-out:', error)
  }
}

/**
 * Whether the native cookie store holds any cookie for `url`.
 *
 * The store is wiped when the app is uninstalled, unlike the Keychain (iOS),
 * so no cookie means no session, whatever SecureStore still remembers.
 * Resolves to `null` when it cannot tell (web, cookie manager unavailable or
 * failing): callers then fall back to asking the server.
 */
export async function hasNativeCookies(url: string): Promise<boolean | null> {
  if (Platform.OS === 'web') return null

  const cookieManager = loadCookieManager()
  if (!cookieManager) return null

  try {
    return Object.keys((await cookieManager.get(url)) ?? {}).length > 0
  } catch (error) {
    console.warn('[@nextsparkjs/mobile] Failed to read native cookies:', error)
    return null
  }
}
