import type { DirectUploads, PresignedUpload, StorageDriver } from './index'
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
  const publicUrl = required('S3_PUBLIC_URL', (v) => parseBaseUrl(v, true) !== null)
  const pathStyle = value('S3_FORCE_PATH_STYLE')
  if (pathStyle !== undefined && pathStyle !== 'true' && pathStyle !== 'false') problem('S3_FORCE_PATH_STYLE', 'malformed (use true or false)')

  if (problems.length) return { problems, variables }
  return {
    config: {
      endpoint: parseBaseUrl(endpoint, false)!,
      region,
      bucket,
      accessKeyId,
      secretAccessKey,
      publicUrl: parseBaseUrl(publicUrl, true)!,
      forcePathStyle: pathStyle === 'true',
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
      stat: (name) => this.stat(PENDING + name),
      readStart: (name, bytes) => this.readStart(PENDING + name, bytes),
      promote: (name) => this.promote(name),
      discard: (name) => this.deleteKey(PENDING + name),
      getPublicUrl: (name) => this.publicUrl(name),
    }
  }

  private objectUrl(key: string): URL {
    const endpoint = new URL(this.config.endpoint)
    if (this.config.forcePathStyle) return new URL(`${this.config.endpoint}/${this.config.bucket}/${key}`)
    return new URL(`${endpoint.protocol}//${this.config.bucket}.${endpoint.host}/${key}`)
  }

  private publicUrl(name: string): string {
    assertObjectName(name)
    return `${this.config.publicUrl}/${UPLOADS}${name}`
  }

  private async signer(method: string, url: URL, headers: Record<string, string>, query = false) {
    const { AwsV4Signer } = await loadAws4fetch()
    return new AwsV4Signer({
      method,
      url: url.toString(),
      headers,
      accessKeyId: this.config.accessKeyId,
      secretAccessKey: this.config.secretAccessKey,
      service: 's3',
      region: this.config.region,
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
    const response = await this.request('PUT', UPLOADS + name, { 'content-type': contentType }, body)
    if (!response.ok) await S3StorageDriver.fail('PUT', response)
    return this.publicUrl(name)
  }

  async delete(url: string): Promise<void> {
    const prefix = `${this.config.publicUrl}/${UPLOADS}`
    if (!url.startsWith(prefix)) return
    const name = url.slice(prefix.length)
    if (isObjectName(name)) await this.deleteKey(UPLOADS + name)
  }

  private async deleteKey(key: string): Promise<void> {
    const response = await this.request('DELETE', key)
    if (!response.ok && response.status !== 404) await S3StorageDriver.fail('DELETE', response)
  }

  private async presignUpload(name: string, contentType: string, size: number): Promise<PresignedUpload> {
    assertObjectName(name)
    const url = this.objectUrl(PENDING + name)
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

  private async stat(key: string): Promise<{ size: number; contentType: string | null } | null> {
    const response = await this.request('HEAD', key)
    if (response.status === 404) return null
    if (!response.ok) await S3StorageDriver.fail('HEAD', response)
    return {
      size: Number(response.headers.get('content-length') ?? NaN),
      contentType: response.headers.get('content-type'),
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

  private async promote(name: string): Promise<void> {
    assertObjectName(name)
    const response = await this.request('PUT', UPLOADS + name, {
      'x-amz-copy-source': `/${this.config.bucket}/${PENDING}${name}`,
    })
    // CopyObject can answer 200 with an error document
    const text = await response.text().catch(() => '')
    if (!response.ok || text.includes('<Error>')) {
      const code = /<Code>([A-Za-z]{1,64})<\/Code>/.exec(text)?.[1]
      throw new Error(`S3 COPY failed with status ${response.status}${code ? ` (${code})` : ''}`)
    }
    // A pending copy left behind is removed by the bucket's lifecycle rule
    await this.deleteKey(PENDING + name).catch(() => {})
  }
}
