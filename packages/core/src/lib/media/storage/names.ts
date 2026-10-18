import { randomUUID } from 'crypto'
import { extensionForMime } from '../file-signature'

/** Seconds a presigned PUT URL stays valid. */
export const PRESIGN_EXPIRES_SECONDS = 300

const OBJECT_NAME = /^[A-Za-z0-9_-]{1,100}\.[a-z0-9]{1,8}$/

/** Server-generated object name: timestamp, 128 random bits, extension of the allow-listed type. */
export function newObjectName(mimeType: string): string {
  return `${Date.now()}_${randomUUID().replace(/-/g, '')}.${extensionForMime(mimeType)}`
}

/** Whether a string is an object name the server could have generated (no separators, no dots but the extension). */
export function isObjectName(name: string): boolean {
  return OBJECT_NAME.test(name)
}

export function assertObjectName(name: string): void {
  if (!isObjectName(name)) throw new Error('Invalid storage object name')
}
