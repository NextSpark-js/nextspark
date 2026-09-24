/**
 * Social Media Publisher Plugin - Adapter Registry
 *
 * This module manages the registration and retrieval of the
 * project's social platform adapter.
 *
 * ## Project Integration Convention
 *
 * Projects provide an adapter at:
 * 1. `lib/social-media/index.ts`
 *    - Export a `createAdapter()` factory function (recommended)
 *    - Or export default an adapter instance
 *
 * The adapter class must extend `SocialPlatformAdapter` from this plugin.
 */

import type { SocialPlatformAdapter } from './abstract-adapter'

/**
 * Global key for storing the adapter singleton.
 *
 * Uses globalThis instead of module-level variable to survive
 * Next.js module isolation (Turbopack/webpack create separate
 * module instances for instrumentation.ts vs API routes).
 *
 * Pattern: Vercel best practice `advanced-init-once`
 */
const GLOBAL_KEY = Symbol.for('smp.adapter')
const GLOBAL_LAZY_KEY = Symbol.for('smp.adapter.lazyLoaded')
const globalRegistry = globalThis as Record<symbol, unknown>

function getRegisteredAdapter(): SocialPlatformAdapter | null {
  return (globalRegistry[GLOBAL_KEY] as SocialPlatformAdapter | undefined) ?? null
}

function setRegisteredAdapter(adapter: SocialPlatformAdapter | null): void {
  globalRegistry[GLOBAL_KEY] = adapter
}

function isLazyLoadAttempted(): boolean {
  return globalRegistry[GLOBAL_LAZY_KEY] === true
}

function setLazyLoadAttempted(value: boolean): void {
  globalRegistry[GLOBAL_LAZY_KEY] = value
}

/**
 * Register the project's social platform adapter.
 *
 * @param adapter - The theme's adapter implementation
 */
export function registerSocialPlatformAdapter(adapter: SocialPlatformAdapter): void {
  const current = getRegisteredAdapter()
  if (current) {
    console.warn(
      '[social-media-publisher] Adapter already registered, overwriting.',
      'Previous:', current.getEntitySlug(),
      'New:', adapter.getEntitySlug()
    )
  }

  setRegisteredAdapter(adapter)

  console.log(
    '[social-media-publisher] Adapter registered for entity:',
    adapter.getEntitySlug(),
    '| Table:', adapter.getTableName()
  )
}

/**
 * Project adapters are registered explicitly at application startup. Next.js
 * cannot safely construct an arbitrary project import path at runtime.
 */
async function tryLazyLoadAdapter(): Promise<void> {
  if (isLazyLoadAttempted() || getRegisteredAdapter()) {
    return
  }

  setLazyLoadAttempted(true)

  console.log('[social-media-publisher] No adapter registered; register the project adapter at application startup')
}

/**
 * Get the registered adapter.
 * Will attempt lazy loading from theme if not registered.
 *
 * @returns The registered adapter
 * @throws Error if no adapter has been registered or found
 */
export function getSocialPlatformAdapter(): SocialPlatformAdapter {
  const adapter = getRegisteredAdapter()
  if (!adapter) {
    throw new Error(
      '[social-media-publisher] No adapter registered.\n\n' +
      'The social-media-publisher plugin requires the project to provide an adapter.\n\n' +
      'To fix this, create and register a project social-media module:\n\n' +
      '📁 lib/social-media/index.ts\n\n' +
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

  return adapter
}

/**
 * Get the adapter, attempting lazy load first if needed.
 * Use this in API routes instead of getSocialPlatformAdapter() directly.
 */
export async function getAdapter(): Promise<SocialPlatformAdapter> {
  if (!getRegisteredAdapter()) {
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
  return getRegisteredAdapter() !== null
}

/**
 * Check if adapter is available, attempting lazy load first.
 */
export async function ensureAdapter(): Promise<boolean> {
  if (!getRegisteredAdapter()) {
    await tryLazyLoadAdapter()
  }
  return getRegisteredAdapter() !== null
}

/**
 * Clear the registered adapter.
 * Primarily for testing purposes.
 */
export function clearAdapter(): void {
  setRegisteredAdapter(null)
  setLazyLoadAttempted(false)
}

/**
 * Get adapter info for debugging/logging.
 * Returns null if no adapter registered.
 */
export function getAdapterInfo(): { entitySlug: string; tableName: string } | null {
  const adapter = getRegisteredAdapter()
  if (!adapter) return null

  return {
    entitySlug: adapter.getEntitySlug(),
    tableName: adapter.getTableName()
  }
}
