/**
 * Social Media Publisher Plugin - Adapter Registry
 *
 * This module manages the registration and retrieval of the
 * theme's social platform adapter. The adapter is loaded lazily
 * from the theme when first needed (server-side only).
 *
 * ## Theme Integration Convention
 *
 * Themes must provide an adapter at one of these locations:
 * 1. `contents/themes/{NEXT_PUBLIC_ACTIVE_THEME}/lib/social-media/index.ts`
 *    - Export a `createAdapter()` factory function (recommended)
 *    - Or export default an adapter instance
 *
 * The adapter class must extend `SocialPlatformAdapter` from this plugin.
 */

import type { SocialPlatformAdapter } from './abstract-adapter'

/**
 * The registered adapter instance.
 * Null until a theme registers one or it's lazily loaded.
 */
let registeredAdapter: SocialPlatformAdapter | null = null
let lazyLoadAttempted = false

/**
 * Register the theme's social platform adapter.
 *
 * @param adapter - The theme's adapter implementation
 */
export function registerSocialPlatformAdapter(adapter: SocialPlatformAdapter): void {
  if (registeredAdapter) {
    console.warn(
      '[social-media-publisher] Adapter already registered, overwriting.',
      'Previous:', registeredAdapter.getEntitySlug(),
      'New:', adapter.getEntitySlug()
    )
  }

  registeredAdapter = adapter

  console.log(
    '[social-media-publisher] Adapter registered for entity:',
    adapter.getEntitySlug(),
    '| Table:', adapter.getTableName()
  )
}

/**
 * Try to lazily load the adapter from theme's social-media module.
 *
 * Uses NEXT_PUBLIC_ACTIVE_THEME environment variable to determine
 * which theme to load from. This makes the plugin theme-agnostic.
 *
 * Convention: Theme must export one of:
 * - `createAdapter()` factory function (recommended)
 * - Default export of adapter instance
 * - Named export `SocialPlatformAdapterImpl` class
 */
/**
 * Theme adapter lookup table.
 *
 * Next.js requires static import paths at build time, so we use explicit
 * imports for each known theme. Add your theme here if you need lazy loading.
 *
 * Alternatively, themes can call registerSocialPlatformAdapter() at app startup.
 */
const THEME_ADAPTER_LOADERS: Record<string, () => Promise<{ createAdapter?: () => SocialPlatformAdapter; default?: unknown; SocialPlatformAdapterImpl?: new () => SocialPlatformAdapter }>> = {
  // Add your theme here if you need lazy loading:
  // 'default': () => import('@/themes/default/lib/social-media'),
}

async function tryLazyLoadAdapter(): Promise<void> {
  if (lazyLoadAttempted || registeredAdapter) {
    return
  }

  lazyLoadAttempted = true

  // Get active theme from environment
  const themeName = process.env.NEXT_PUBLIC_ACTIVE_THEME
  if (!themeName) {
    console.log('[social-media-publisher] No NEXT_PUBLIC_ACTIVE_THEME configured - theme must register adapter manually')
    return
  }

  console.log(`[social-media-publisher] Attempting lazy load from theme: ${themeName}`)

  // Check if we have a loader for this theme
  const loader = THEME_ADAPTER_LOADERS[themeName]
  if (!loader) {
    console.log(`[social-media-publisher] No adapter loader configured for theme "${themeName}"`)
    console.log('[social-media-publisher] Add your theme to THEME_ADAPTER_LOADERS or register adapter manually')
    return
  }

  try {
    // Use the explicit loader for this theme
    const themeModule = await loader()

    // Option 1: Factory function (recommended - allows dependency injection)
    if (typeof themeModule.createAdapter === 'function') {
      const adapter = themeModule.createAdapter()
      registerSocialPlatformAdapter(adapter)
      console.log(`[social-media-publisher] Adapter loaded via createAdapter() from theme "${themeName}"`)
      return
    }

    // Option 2: Default export (instance or class)
    if (themeModule.default) {
      // If it's a class, instantiate it
      if (typeof themeModule.default === 'function' && themeModule.default.prototype) {
        const AdapterClass = themeModule.default as new () => SocialPlatformAdapter
        const adapter = new AdapterClass()
        registerSocialPlatformAdapter(adapter)
        console.log(`[social-media-publisher] Adapter loaded via default export class from theme "${themeName}"`)
        return
      }
      // If it's already an instance
      const defaultExport = themeModule.default as Record<string, unknown>
      if (typeof defaultExport.checkEntityAccess === 'function') {
        registerSocialPlatformAdapter(defaultExport as unknown as SocialPlatformAdapter)
        console.log(`[social-media-publisher] Adapter loaded via default export instance from theme "${themeName}"`)
        return
      }
    }

    // Option 3: Named export (legacy support)
    if (themeModule.SocialPlatformAdapterImpl) {
      const adapter = new themeModule.SocialPlatformAdapterImpl()
      registerSocialPlatformAdapter(adapter)
      console.log(`[social-media-publisher] Adapter loaded via SocialPlatformAdapterImpl from theme "${themeName}"`)
      return
    }

    console.log(`[social-media-publisher] Theme "${themeName}" has social-media module but no valid adapter export`)
    console.log('[social-media-publisher] Expected: createAdapter(), default export, or SocialPlatformAdapterImpl')

  } catch (error) {
    // Theme's social-media module failed to load
    console.error(`[social-media-publisher] Failed to load adapter from theme "${themeName}":`, error)
    console.log('[social-media-publisher] Theme must register adapter manually via registerSocialPlatformAdapter()')
  }
}

/**
 * Get the registered adapter.
 * Will attempt lazy loading from theme if not registered.
 *
 * @returns The registered adapter
 * @throws Error if no adapter has been registered or found
 */
export function getSocialPlatformAdapter(): SocialPlatformAdapter {
  if (!registeredAdapter) {
    const themeName = process.env.NEXT_PUBLIC_ACTIVE_THEME || '{your-theme}'
    throw new Error(
      '[social-media-publisher] No adapter registered.\n\n' +
      'The social-media-publisher plugin requires a theme to provide an adapter.\n\n' +
      'To fix this, create a social-media module in your theme:\n\n' +
      `📁 contents/themes/${themeName}/lib/social-media/index.ts\n\n` +
      'Option A - Factory function (recommended):\n' +
      '  export function createAdapter() {\n' +
      '    return new YourSocialPlatformAdapter()\n' +
      '  }\n\n' +
      'Option B - Default export:\n' +
      '  export default new YourSocialPlatformAdapter()\n\n' +
      'Your adapter class must extend SocialPlatformAdapter from this plugin.\n' +
      'See plugin README.md for full implementation guide.'
    )
  }

  return registeredAdapter
}

/**
 * Get the adapter, attempting lazy load first if needed.
 * Use this in API routes instead of getSocialPlatformAdapter() directly.
 */
export async function getAdapter(): Promise<SocialPlatformAdapter> {
  if (!registeredAdapter) {
    await tryLazyLoadAdapter()
  }

  return getSocialPlatformAdapter()
}

/**
 * Check if an adapter has been registered.
 * Useful for conditional logic without throwing.
 *
 * @returns True if an adapter is registered
 */
export function hasAdapter(): boolean {
  return registeredAdapter !== null
}

/**
 * Check if adapter is available, attempting lazy load first.
 */
export async function ensureAdapter(): Promise<boolean> {
  if (!registeredAdapter) {
    await tryLazyLoadAdapter()
  }
  return registeredAdapter !== null
}

/**
 * Clear the registered adapter.
 * Primarily for testing purposes.
 */
export function clearAdapter(): void {
  registeredAdapter = null
  lazyLoadAttempted = false
}

/**
 * Get adapter info for debugging/logging.
 * Returns null if no adapter registered.
 */
export function getAdapterInfo(): { entitySlug: string; tableName: string } | null {
  if (!registeredAdapter) return null

  return {
    entitySlug: registeredAdapter.getEntitySlug(),
    tableName: registeredAdapter.getTableName()
  }
}
