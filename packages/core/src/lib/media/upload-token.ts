/**
 * The token a presign hands out and a confirm must bring back. It binds the
 * pending object to the user and team that asked for it, the declared type and
 * size, and a deadline; it is signed with a key derived from the session secret
 * (effectiveSessionSecret: the one the auth library signs with),
 * so a client cannot name an object it was not given.
 */

import { createHmac, timingSafeEqual } from 'crypto'

import { effectiveSessionSecret } from '../auth/readiness'

export interface UploadClaim {
  /** Object name (storage/names.ts) */
  name: string
  userId: string
  teamId: string
  mimeType: string
  size: number
  /** Sanitized original file name, for display */
  filename: string
  /** Deadline, epoch milliseconds */
  expiresAt: number
}

/** How long after the presign a confirm is accepted; the upload itself must start within the presign's 5 minutes. */
export const CONFIRM_WINDOW_SECONDS = 3600

function key(): Buffer {
  const secret = effectiveSessionSecret(process.env)?.value
  if (!secret) throw new Error('No session secret is set: set BETTER_AUTH_SECRET (or BETTER_AUTH_SECRETS, or AUTH_SECRET)')
  return createHmac('sha256', secret).update('nextspark:media-upload-token:v1').digest()
}

const mac = (payload: string) => createHmac('sha256', key()).update(payload).digest()

export function signUploadClaim(claim: UploadClaim): string {
  const payload = Buffer.from(JSON.stringify(claim)).toString('base64url')
  return `${payload}.${mac(payload).toString('base64url')}`
}

/** The claim inside an authentic token (expired or not), or null for anything forged or malformed. */
export function readUploadClaim(token: unknown): UploadClaim | null {
  if (typeof token !== 'string' || token.length > 4096) return null
  const [payload, signature, extra] = token.split('.')
  if (!payload || !signature || extra !== undefined) return null
  const given = Buffer.from(signature, 'base64url')
  const expected = mac(payload)
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null
  try {
    const claim = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as UploadClaim
    const fields: Array<[keyof UploadClaim, string]> = [
      ['name', 'string'], ['userId', 'string'], ['teamId', 'string'], ['mimeType', 'string'],
      ['size', 'number'], ['filename', 'string'], ['expiresAt', 'number'],
    ]
    return fields.every(([field, type]) => typeof claim[field] === type) ? claim : null
  } catch {
    return null
  }
}
