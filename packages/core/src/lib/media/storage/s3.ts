import type { DirectUploads, PresignedUpload, StorageDriver } from './index'
import { isInlineType } from '../file-signature'
import { PendingObjectChangedError } from './errors'
import { assertObjectName, isObjectName, PRESIGN_EXPIRES_SECONDS } from './names'

/**
 * aws4fetch is an optional peer of @nextsparkjs/core: only projects that set
 * STORAGE_DRIVER=s3 install it. The import is lazy and its specifier is fixed;
 * the ignore comments keep webpack and Turbopack from resolving it at build
 * time, so a project without aws4fetch still builds. It is resolved by Node at
 * runtime, from the project's own node_modules.
 */
let aws4fetch: Promise<typeof import('aws4fetch')> | undefined
function loadAws4fetch(): Promise<typeof import('aws4fetch')> {
  aws4fetch ??= import(/* webpackIgnore: true */ /* turbopackIgnore: true */ 'aws4fetch').catch((error) => {
    // A failed load must not be cached: installing the package and retrying should work.
    aws4fetch = undefined
    const code = (error as { code?: string }).code
    if (
      (code === 'MODULE_NOT_FOUND' || code === 'ERR_MODULE_NOT_FOUND') &&
      /['"]aws4fetch['"]/.test((error as Error).message)
    ) {
      throw new Error(
        'STORAGE_DRIVER=s3 needs the aws4fetch package, which is not installed or not included in the deployment. ' +
          'Run `pnpm add aws4fetch`; with output: \'standalone\' see docs/21-media-library/05-configuration.md.'
      )
    }
    throw error
  })
  return aws4fetch
}

export interface S3Config {
  endpoint: string
  region: string
  bucket: string
  accessKeyId: string
  secretAccessKey: string
  publicUrl: string
  forcePathStyle: boolean
  /** Folder every key lives under, normalized to `a/b/`; absent when keys are used as they are. */
  keyPrefix?: string
  /** Private bucket: stored URLs are the unsigned object URLs and reads are signed. */
  private?: boolean
  /** Lifetime of a signed read URL, seconds (private mode). */
  signedUrlTtlSeconds?: number
}

export const DEFAULT_SIGNED_URL_TTL_SECONDS = 3600
const MIN_SIGNED_URL_TTL_SECONDS = 60
const MAX_SIGNED_URL_TTL_SECONDS = 604_800 // SigV4 allows presigned URLs up to 7 days

/**
 * `qa`, `qa/` and `/qa//` are the same prefix, `qa/`; blank or only slashes means none (''); null is malformed.
 * Segments are plain names, so a prefix can neither climb out of its folder (`..`, `.`) nor be
 * mistaken for another one: `qa/` never matches `qa2/` because comparison always includes the slash.
 */
export function normalizeKeyPrefix(raw: string | undefined): string | null {
  const segments = (raw ?? '').split('/').map((s) => s.trim()).filter(Boolean)
  if (!segments.length) return ''
  if (!segments.every((s) => /^[A-Za-z0-9][A-Za-z0-9._-]{0,62}$/.test(s) && !s.includes('..'))) return null
  const prefix = segments.join('/') + '/'
  return prefix.length <= 200 ? prefix : null
}

/** An http(s) origin, optionally with a path; no credentials, query or fragment. Trailing slashes dropped. */
function parseBaseUrl(value: string, allowPath: boolean): string | null {
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    if (url.username || url.password || url.search || url.hash) return null
    if (!allowPath && url.pathname !== '/') return null
    return url.toString().replace(/\/+$/, '')
  } catch {
    return null
  }
}

/** An http: endpoint on another host: signed, but the files travel unencrypted. */
function isClearEndpoint(endpoint: string): boolean {
  const { protocol, hostname } = new URL(endpoint)
  return protocol === 'http:' && !['localhost', '127.0.0.1', '[::1]'].includes(hostname) && !hostname.startsWith('127.')
}

/** Reads the S3_* variables. Problems name variables, never values. */
export function parseS3Config(env: NodeJS.ProcessEnv):
  | { config: S3Config }
  | { problems: string[]; variables: string[] } {
  const problems: string[] = []
  const variables: string[] = []
  const value = (name: string) => env[name]?.trim() || undefined
  const problem = (name: string, what: string) => {
    problems.push(`${name} is ${what}`)
    variables.push(name)
  }
  const required = (name: string, valid: (v: string) => boolean) => {
    const v = value(name)
    if (!v) problem(name, 'missing')
    else if (!valid(v)) problem(name, 'malformed')
    return v ?? ''
  }

  const endpoint = required('S3_ENDPOINT', (v) => parseBaseUrl(v, false) !== null)
  const region = required('S3_REGION', (v) => /^[a-z0-9-]{1,32}$/.test(v))
  const bucket = required('S3_BUCKET', (v) => /^[A-Za-z0-9][A-Za-z0-9.-]{1,61}[A-Za-z0-9]$/.test(v))
  const accessKeyId = required('S3_ACCESS_KEY_ID', (v) => !/\s/.test(v))
  const secretAccessKey = required('S3_SECRET_ACCESS_KEY', (v) => !/\s/.test(v))
  const privateRaw = value('STORAGE_S3_PRIVATE')
  if (privateRaw !== undefined && privateRaw !== 'true' && privateRaw !== 'false') problem('STORAGE_S3_PRIVATE', 'malformed (use true or false)')
  const isPrivate = privateRaw === 'true'
  // A private bucket has no public URL: stored URLs are the object URLs, so S3_PUBLIC_URL is not needed
  const publicUrl = isPrivate && !value('S3_PUBLIC_URL') ? '' : required('S3_PUBLIC_URL', (v) => parseBaseUrl(v, true) !== null)
  const pathStyle = value('S3_FORCE_PATH_STYLE')
  if (pathStyle !== undefined && pathStyle !== 'true' && pathStyle !== 'false') problem('S3_FORCE_PATH_STYLE', 'malformed (use true or false)')
  const keyPrefix = normalizeKeyPrefix(env.STORAGE_S3_KEY_PREFIX)
  if (keyPrefix === null) problem('STORAGE_S3_KEY_PREFIX', 'malformed (use plain folder names such as qa or qa/images)')
  const ttlRaw = value('STORAGE_S3_SIGNED_URL_TTL')
  const ttl = ttlRaw === undefined ? undefined : /^\d{1,7}$/.test(ttlRaw) ? Number(ttlRaw) : NaN
  if (ttl !== undefined && !(ttl >= MIN_SIGNED_URL_TTL_SECONDS && ttl <= MAX_SIGNED_URL_TTL_SECONDS)) {
    problem('STORAGE_S3_SIGNED_URL_TTL', `malformed (seconds, ${MIN_SIGNED_URL_TTL_SECONDS} to ${MAX_SIGNED_URL_TTL_SECONDS})`)
  }
  // Signed reads over plain http to another host would put the signature on the wire
  if (isPrivate && endpoint && parseBaseUrl(endpoint, false) !== null && isClearEndpoint(parseBaseUrl(endpoint, false)!)) {
    problem('S3_ENDPOINT', 'malformed for a private bucket (use an https: endpoint)')
  }

  if (problems.length) return { problems, variables }
  return {
    config: {
      endpoint: parseBaseUrl(endpoint, false)!,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicUrl: publicUrl ? parseBaseUrl(publicUrl, true)! : '',
      forcePathStyle: pathStyle === 'true',
      ...(keyPrefix && { keyPrefix }),
      ...(isPrivate && { private: true }),
      ...(isPrivate && ttl !== undefined && { signedUrlTtlSeconds: ttl }),
    },
  }
}

const UPLOADS = 'uploads/'
const PENDING = 'pending/'
const REQUEST_TIMEOUT_MS = 30_000

/**
 * Any S3-compatible service, signed with SigV4 by aws4fetch. Objects live under
 * `uploads/`; presigned uploads land under `pending/` until confirmed. No ACL is
 * ever sent: what is public is decided by the bucket, and URLs come from S3_PUBLIC_URL.
 */
export class S3StorageDriver implements StorageDriver {
  readonly name = 's3' as const
  readonly direct: DirectUploads

  constructor(private readonly config: S3Config) {
    this.direct = {
      presignUpload: (name, contentType, size) => this.presignUpload(name, contentType, size),
      stat: (name) => this.stat(this.key(PENDING, name)),
      readStart: (name, bytes) => this.readStart(this.key(PENDING, name), bytes),
      promote: (name, contentType, etag) => this.promote(name, contentType, etag),
      discard: (name) => this.deleteKey(this.key(PENDING, name)),
      getPublicUrl: (name) => this.publicUrl(name),
    }
  }

  private objectUrl(key: string): URL {
    const endpoint = new URL(this.config.endpoint)
    if (this.config.forcePathStyle) return new URL(`${this.config.endpoint}/${this.config.bucket}/${key}`)
    return new URL(`${endpoint.protocol}//${this.config.bucket}.${endpoint.host}/${key}`)
  }

  /** An http: endpoint on another host: signed, but the files travel unencrypted. */
  sendsInClear(): boolean {
    return isClearEndpoint(this.config.endpoint)
  }

  /** The bucket key of an object: the environment's prefix, the folder and the server-generated name. */
  private key(folder: typeof UPLOADS | typeof PENDING, name: string): string {
    assertObjectName(name)
    return (this.config.keyPrefix ?? '') + folder + name
  }

  /** The URL stored in the media row: the CDN/public URL, or in a private bucket the object URL itself (never signed). */
  private publicUrl(name: string): string {
    const key = this.key(UPLOADS, name)
    return this.config.private ? this.objectUrl(key).toString() : `${this.config.publicUrl}/${key}`
  }

  /** The name of an object this driver stored under its own prefix and bucket, from the URL it returned; else null. */
  private ownName(url: string): string | null {
    const folder = (this.config.keyPrefix ?? '') + UPLOADS
    if (!this.config.private) {
      const prefix = `${this.config.publicUrl}/${folder}`
      if (!url.startsWith(prefix)) return null
      const name = url.slice(prefix.length)
      return isObjectName(name) ? name : null
    }
    // Names carry neither dots-segments nor escapes: refuse what the URL parser would have to normalize
    if (/\.\.|%/.test(url)) return null
    let parsed: URL
    try {
      parsed = new URL(url)
    } catch {
      return null
    }
    const own = this.objectUrl(folder)
    // Same scheme, host and port as this bucket, no credentials, query or fragment; the path is compared by whole segments
    if (parsed.origin !== own.origin || parsed.username || parsed.password || parsed.search || parsed.hash) return null
    if (!parsed.pathname.startsWith(own.pathname)) return null
    const name = parsed.pathname.slice(own.pathname.length)
    return isObjectName(name) ? name : null
  }

  /**
   * Private mode: a short-lived signed GET URL for a URL of this bucket (and this environment's prefix);
   * null for anything else, which the caller leaves untouched. Never stored, never logged.
   * The signing time is rounded down to half the lifetime, so the same URL repeats for a while
   * (browsers can cache it) and always has at least half its lifetime left.
   */
  async signedReadUrl(url: string): Promise<string | null> {
    if (!this.config.private) return null
    const name = this.ownName(url)
    if (!name) return null
    const ttl = this.config.signedUrlTtlSeconds ?? DEFAULT_SIGNED_URL_TTL_SECONDS
    const window = Math.floor(ttl / 2)
    const at = new Date(Math.floor(Date.now() / 1000 / window) * window * 1000)
    const target = this.objectUrl(this.key(UPLOADS, name))
    target.searchParams.set('X-Amz-Expires', String(ttl))
    const signed = await this.signer('GET', target, {}, true, at.toISOString().replace(/[:-]|\.\d{3}/g, ''))
    return signed.url.toString()
  }

  private async signer(method: string, url: URL, headers: Record<string, string>, query = false, datetime?: string) {
    const { AwsV4Signer } = await loadAws4fetch()
    return new AwsV4Signer({
      method,
      url: url.toString(),
      headers,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      service: 's3',
      region: this.config.region,
      ...(datetime && { datetime }),
      // Presigned URLs also sign Content-Type and Content-Length, which aws4fetch leaves out by default
      ...(query && { signQuery: true, allHeaders: true }),
    }).sign()
  }

  private async request(method: string, key: string, headers: Record<string, string> = {}, body?: Buffer): Promise<Response> {
    const signed = await this.signer(method, this.objectUrl(key), headers)
    return fetch(signed.url, {
      method,
      headers: signed.headers,
      body: body as BodyInit | undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  }

  private static async fail(operation: string, response: Response): Promise<never> {
    // The S3 error code (AccessDenied, NoSuchBucket...) helps; the body carries nothing secret but is not echoed whole
    const code = /<Code>([A-Za-z]{1,64})<\/Code>/.exec(await response.text().catch(() => ''))?.[1]
    throw new Error(`S3 ${operation} failed with status ${response.status}${code ? ` (${code})` : ''}`)
  }

  async put(name: string, body: Buffer, contentType: string): Promise<string> {
    assertObjectName(name)
    const response = await this.request('PUT', this.key(UPLOADS, name), storedHeaders(contentType), body)
    if (!response.ok) await S3StorageDriver.fail('PUT', response)
    return this.publicUrl(name)
  }

  async delete(url: string): Promise<void> {
    const name = this.ownName(url)
    if (name) await this.deleteKey(this.key(UPLOADS, name))
  }

  private async deleteKey(key: string): Promise<void> {
    const response = await this.request('DELETE', key)
    if (!response.ok && response.status !== 404) await S3StorageDriver.fail('DELETE', response)
  }

  private async presignUpload(name: string, contentType: string, size: number): Promise<PresignedUpload> {
    assertObjectName(name)
    const url = this.objectUrl(this.key(PENDING, name))
    url.searchParams.set('X-Amz-Expires', String(PRESIGN_EXPIRES_SECONDS))
    const signed = await this.signer('PUT', url, { 'content-type': contentType, 'content-length': String(size) }, true)
    return {
      url: signed.url.toString(),
      method: 'PUT',
      // The browser sets Content-Length from the body; the signature only accepts the declared size
      headers: { 'Content-Type': contentType },
      expiresAt: new Date(Date.now() + PRESIGN_EXPIRES_SECONDS * 1000),
    }
  }

  private async stat(key: string): Promise<{ size: number; contentType: string | null; etag: string | null } | null> {
    const response = await this.request('HEAD', key)
    if (response.status === 404) return null
    if (!response.ok) await S3StorageDriver.fail('HEAD', response)
    return {
      size: Number(response.headers.get('content-length') ?? NaN),
      contentType: response.headers.get('content-type'),
      etag: response.headers.get('etag'),
    }
  }

  private async readStart(key: string, bytes: number): Promise<Uint8Array> {
    const response = await this.request('GET', key, { range: `bytes=0-${bytes - 1}` })
    if (!response.ok) await S3StorageDriver.fail('GET', response)
    // A service that ignores Range sends the whole object: stop reading once there is enough
    const out = new Uint8Array(bytes)
    let length = 0
    const reader = response.body!.getReader()
    while (length < bytes) {
      const { done, value } = await reader.read()
      if (done) break
      const take = Math.min(value.length, bytes - length)
      out.set(value.subarray(0, take), length)
      length += take
    }
    await reader.cancel().catch(() => {})
    return out.subarray(0, length)
  }

  private async promote(name: string, contentType: string, etag: string | null): Promise<void> {
    assertObjectName(name)
    const target = this.key(UPLOADS, name)
    const response = await this.request('PUT', target, {
      'x-amz-copy-source': `/${this.config.bucket}/${this.key(PENDING, name)}`,
      // Only the bytes that were checked: a PUT to the still-valid presigned URL in between fails the copy
      ...(etag && { 'x-amz-copy-source-if-match': etag }),
      // Drop whatever metadata the client sent with its PUT (Content-Disposition, Cache-Control, x-amz-meta-*...)
      'x-amz-metadata-directive': 'REPLACE',
      ...storedHeaders(contentType),
    })
    if (response.status === 412) throw new PendingObjectChangedError()
    // CopyObject can answer 200 with an error document; reading that answer can fail after the copy happened
    let text: string
    try {
      text = await response.text()
    } catch (error) {
      await this.deleteKey(target).catch(() => {})
      throw error
    }
    if (!response.ok || text.includes('<Error>')) {
      await this.deleteKey(target).catch(() => {})
      const code = /<Code>([A-Za-z]{1,64})<\/Code>/.exec(text)?.[1]
      throw new Error(`S3 COPY failed with status ${response.status}${code ? ` (${code})` : ''}`)
    }
  }
}

/** Metadata of a stored object, all chosen by the server from the verified type. */
function storedHeaders(contentType: string): Record<string, string> {
  return {
    'content-type': contentType,
    'cache-control': 'public, max-age=31536000, immutable',
    ...(!isInlineType(contentType) && { 'content-disposition': 'attachment' }),
  }
}
