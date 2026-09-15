/**
 * Native cookie store cleanup
 *
 * React Native's fetch keeps the cookies a server sets, Better Auth's session
 * cookie among them, in the platform cookie store (NSHTTPCookieStorage on iOS,
 * the CookieManager Android shares with WebViews). Clearing the Bearer token is
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
