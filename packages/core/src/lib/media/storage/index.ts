/**
 * Media storage drivers, selected by STORAGE_DRIVER:
 * - `vercel-blob`: Vercel Blob (BLOB_READ_WRITE_TOKEN);
 * - `s3`: any S3-compatible service (S3_* variables), with direct uploads;
 * - `local`: a directory on the server's disk (UPLOADS_DIR).
 * Unset keeps the old detection: Blob when its token is set, else public/uploads/temp
 * in development and nothing in production.
 *
 * Objects are named by the server (`newObjectName`), never from the client's file
 * name; each driver puts the name under its own prefix.
 */

import { join } from 'path'
import { parseS3Config, S3StorageDriver } from './s3'
import { LocalStorageDriver } from './local'
import { VercelBlobStorageDriver, isVercelBlobToken } from './vercel-blob'

export { newObjectName, isObjectName, PRESIGN_EXPIRES_SECONDS } from './names'

export type StorageDriverName = 'vercel-blob' | 's3' | 'local'

export interface StorageDriver {
  readonly name: StorageDriverName
  /** Stores the bytes under `name` and returns the public URL. */
  put(name: string, body: Buffer, contentType: string): Promise<string>
  /** Removes the object behind a URL this driver returned; any other URL is left alone. */
  delete(url: string): Promise<void>
  /** Uploads that go from the client straight to storage (s3 only). */
  direct?: DirectUploads
}

export interface PresignedUpload {
  url: string
  method: 'PUT'
  /** Headers the client must send unchanged; the signature covers them. */
  headers: Record<string, string>
  expiresAt: Date
}

/**
 * A presigned object waits under a pending prefix until it is confirmed; `promote`
 * moves it to where `getPublicUrl` points.
 */
export interface DirectUploads {
  presignUpload(name: string, contentType: string, size: number): Promise<PresignedUpload>
  /** Size and type of the pending object, null when there is none. */
  stat(name: string): Promise<{ size: number; contentType: string | null } | null>
  /** Up to `bytes` leading bytes of the pending object. */
  readStart(name: string, bytes: number): Promise<Uint8Array>
  promote(name: string): Promise<void>
  /** Deletes the pending object. */
  discard(name: string): Promise<void>
  getPublicUrl(name: string): string
}

export type StorageSelection =
  | { driver: StorageDriver; developmentFallback: boolean }
  | { driver: null; message: string; details: Record<string, unknown> }

const misconfigured = (label: string, problems: string[], variables: string[]): StorageSelection => ({
  driver: null,
  message: `${label} is misconfigured: ${problems.join('; ')}.`,
  details: { invalid: variables },
})

/**
 * The driver the environment selects. Errors name variables, never their values.
 * Cheap to call per request: nothing is loaded or contacted here.
 */
export function selectStorageDriver(env: NodeJS.ProcessEnv = process.env): StorageSelection {
  const choice = env.STORAGE_DRIVER?.trim()
  const production = env.NODE_ENV === 'production'

  switch (choice) {
    case undefined:
    case '':
      if (isVercelBlobToken(env.BLOB_READ_WRITE_TOKEN)) return { driver: new VercelBlobStorageDriver(), developmentFallback: false }
      if (!production) return { driver: developmentFallbackDriver(), developmentFallback: true }
      return {
        driver: null,
        message:
          'Media storage is not configured: set BLOB_READ_WRITE_TOKEN (a Vercel Blob read/write token, starts with "vercel_blob_"), ' +
          'or STORAGE_DRIVER=s3 or STORAGE_DRIVER=local, to upload files in production.',
        details: { missing: 'BLOB_READ_WRITE_TOKEN' },
      }
    case 'vercel-blob':
      if (isVercelBlobToken(env.BLOB_READ_WRITE_TOKEN)) return { driver: new VercelBlobStorageDriver(), developmentFallback: false }
      return misconfigured('Vercel Blob storage', [
        `BLOB_READ_WRITE_TOKEN is ${env.BLOB_READ_WRITE_TOKEN ? 'malformed (it must start with "vercel_blob_")' : 'missing'}`,
      ], ['BLOB_READ_WRITE_TOKEN'])
    case 's3': {
      const parsed = parseS3Config(env)
      if ('problems' in parsed) return misconfigured('S3 storage', parsed.problems, parsed.variables)
      return { driver: new S3StorageDriver(parsed.config), developmentFallback: false }
    }
    case 'local': {
      const dir = env.UPLOADS_DIR?.trim()
      if (!dir) return misconfigured('Local storage', ['UPLOADS_DIR is missing'], ['UPLOADS_DIR'])
      const driver = new LocalStorageDriver(dir)
      warnLocalOnce(driver)
      return { driver, developmentFallback: false }
    }
    default:
      return misconfigured('Media storage', ['STORAGE_DRIVER is malformed (use vercel-blob, s3 or local)'], ['STORAGE_DRIVER'])
  }
}

/**
 * Development without a driver writes to public/uploads/temp, which Next serves as
 * static files. Production never does: Next serves public/ from what it indexed at
 * startup, and a container's disk is gone on redeploy.
 */
export function developmentFallbackDriver(): LocalStorageDriver {
  return new LocalStorageDriver(join(process.cwd(), 'public', 'uploads', 'temp'), '/uploads/temp/')
}

let localWarned = false

/**
 * The local driver's caveats, once per process: at startup through `logStorageAtStartup`,
 * or at the first selection where instrumentation did not run.
 */
function warnLocalOnce(driver: LocalStorageDriver): void {
  if (localWarned) return
  localWarned = true
  console.warn(
    `[storage] STORAGE_DRIVER=local keeps uploads on this server's disk, in ${driver.root}. ` +
      'Mount that directory as a persistent volume, or files are lost on redeploy; ' +
      'files are not shared between instances, so run a single instance or use STORAGE_DRIVER=s3.'
  )
}

/** Logs, once at server start, a misconfigured driver; selecting the local driver logs its caveats. */
export function logStorageAtStartup(env: NodeJS.ProcessEnv = process.env): void {
  if (!env.STORAGE_DRIVER?.trim()) return
  const selection = selectStorageDriver(env)
  if ('message' in selection) {
    console.error(`[storage] ${selection.message} Uploads answer 503 until it is fixed.`)
  }
}
