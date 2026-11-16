/**
 * Social Media Publisher Plugin - Adapter Registry
 *
 * This module manages the registration and retrieval of the
 * project's social platform adapter.
 *
 * ## Project Integration Convention
 *
 * The plugin does not look for the adapter on its own. The project registers it at server startup, from the
 * `register()` of its `src/instrumentation.ts`, next to core's register(): see ADAPTER_GUIDE_URL.
 *
 * The adapter class must extend `SocialPlatformAdapter` from this plugin.
 */

import { NextResponse } from 'next/server'
import type { SocialPlatformAdapter } from './abstract-adapter'

/** The guide that says how a project writes and registers its adapter. */
export const ADAPTER_GUIDE_URL =
  'https://github.com/NextSpark-js/nextspark/blob/main/plugins/social-media-publisher/docs/03-advanced-usage/04-adapter-integration.md'

const NO_ADAPTER_MESSAGE =
  'No social platform adapter is registered. The project registers one with registerSocialPlatformAdapter() ' +
  'from the register() of its src/instrumentation.ts.'

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

  console.log(`[social-media-publisher] ${NO_ADAPTER_MESSAGE} See ${ADAPTER_GUIDE_URL}`)
}

/**
 * Get the registered adapter.
 *
 * @returns The registered adapter
 * @throws Error if no adapter has been registered or found
 */
export function getSocialPlatformAdapter(): SocialPlatformAdapter {
  const adapter = getRegisteredAdapter()
  if (!adapter) {
    throw new Error(`[social-media-publisher] ${NO_ADAPTER_MESSAGE} See ${ADAPTER_GUIDE_URL}`)
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

/**
 * The response of a route that needs the adapter when none is registered: 501, since the project has not provided
 * the part of the feature the plugin cannot (which entity uses an account), with what is missing and the guide.
 */
export function adapterRequiredResponse(): NextResponse {
  return NextResponse.json(
    { error: NO_ADAPTER_MESSAGE, code: 'SOCIAL_ADAPTER_NOT_REGISTERED', guide: ADAPTER_GUIDE_URL },
    { status: 501 }
  )
}
