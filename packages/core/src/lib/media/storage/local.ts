import { createReadStream } from 'fs'
import { mkdir, stat, unlink, writeFile } from 'fs/promises'
import { isAbsolute, join, resolve } from 'path'
import { Readable } from 'stream'
import { mimeForExtension } from '../file-signature'
import type { StorageDriver } from './index'
import { assertObjectName, isObjectName } from './names'

/** Where the files route serves the local driver's objects (routes/api/v1/media/files/[name]). */
export const LOCAL_FILES_URL_PREFIX = '/api/v1/media/files/'

/**
 * Files in one directory on the server's disk. Object names have no separators
 * (`isObjectName`), so every path is `root/<name>` and cannot leave the root.
 */
export class LocalStorageDriver implements StorageDriver {
  readonly name = 'local' as const
  readonly root: string

  /** `dir` is absolute or relative to the project (the server's working directory). */
  constructor(dir: string, private readonly urlPrefix: string = LOCAL_FILES_URL_PREFIX) {
    // A runtime directory, not a build input: keeps Turbopack from tracing the whole project into the output
    this.root = isAbsolute(dir) ? dir : resolve(/* turbopackIgnore: true */ process.cwd(), dir)
  }

  async put(name: string, body: Buffer, _contentType: string): Promise<string> {
    assertObjectName(name)
    await mkdir(this.root, { recursive: true })
    await writeFile(join(this.root, name), body)
    return this.urlPrefix + name
  }

  async delete(url: string): Promise<void> {
    if (!url.startsWith(this.urlPrefix)) return
    const name = url.slice(this.urlPrefix.length)
    if (!isObjectName(name)) return
    await unlink(join(this.root, name)).catch((error: NodeJS.ErrnoException) => {
      if (error.code !== 'ENOENT') throw error
    })
  }

  /**
   * The file as an HTTP response: type from the extension the server gave it,
   * `nosniff`, and a single byte range for video seeking. 404 for any name the
   * server could not have generated.
   */
  async serve(name: string, range: string | null): Promise<Response> {
    if (!isObjectName(name)) return new Response('Not found', { status: 404 })
    const path = join(this.root, name)
    const info = await stat(path).catch(() => null)
    if (!info?.isFile()) return new Response('Not found', { status: 404 })

    const size = info.size
    const contentType = mimeForExtension(name.slice(name.lastIndexOf('.') + 1))
    const headers = new Headers({
      'Content-Type': contentType ?? 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Accept-Ranges': 'bytes',
    })
    if (!contentType) headers.set('Content-Disposition', 'attachment')

    let start = 0
    let end = size - 1
    let status = 200
    // One range only; anything else is ignored and the whole file is sent
    const match = range ? /^bytes=(\d*)-(\d*)$/.exec(range.trim()) : null
    if (match && (match[1] || match[2])) {
      if (match[1]) {
        start = Number(match[1])
        if (match[2]) end = Math.min(Number(match[2]), size - 1)
      } else {
        start = Math.max(0, size - Number(match[2]))
      }
      if (start >= size || start > end) {
        headers.set('Content-Range', `bytes */${size}`)
        return new Response(null, { status: 416, headers })
      }
      status = 206
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
    }
    headers.set('Content-Length', String(size === 0 ? 0 : end - start + 1))

    const body = size === 0 ? null : (Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream)
    return new Response(body, { status, headers })
  }
}
