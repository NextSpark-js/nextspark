import { randomUUID } from 'crypto'
import { extensionForMime } from '../file-signature'

/** Seconds a presigned PUT URL stays valid. */
export const PRESIGN_EXPIRES_SECONDS = 300

// Exactly what newObjectName produces: milliseconds, 32 hex digits, an extension
const OBJECT_NAME = /^\d{10,15}_[0-9a-f]{32}\.[a-z0-9]{1,8}$/
// The development fallback's names before newObjectName: milliseconds and up to 13 base-36 characters
const LEGACY_OBJECT_NAME = /^\d{10,15}_[0-9a-z]{1,13}\.[a-z0-9]{1,8}$/

/** Server-generated object name: timestamp, 128 random bits, extension of the allow-listed type. */
export function newObjectName(mimeType: string): string {
  return `${Date.now()}_${randomUUID().replace(/-/g, '')}.${extensionForMime(mimeType)}`
}

/** Whether a string is an object name the server generates (no separators, no dots but the extension). */
export function isObjectName(name: string): boolean {
  return OBJECT_NAME.test(name)
}

/** Names the development fallback wrote before newObjectName; only its own directory accepts them. */
export function isLegacyObjectName(name: string): boolean {
  return LEGACY_OBJECT_NAME.test(name)
}

export function assertObjectName(name: string): void {
  if (!isObjectName(name)) throw new Error('Invalid storage object name')
}
