import { put, del } from '@vercel/blob'
import type { StorageDriver } from './index'
import { assertObjectName } from './names'

export const isVercelBlobToken = (token: string | undefined): boolean => !!token && token.startsWith('vercel_blob_')

/** Public Blob stores answer on <store>.public.blob.vercel-storage.com. */
const isBlobUrl = (url: string) => {
  try {
    const { protocol, hostname } = new URL(url)
    return protocol === 'https:' && hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

export class VercelBlobStorageDriver implements StorageDriver {
  readonly name = 'vercel-blob' as const

  async put(name: string, body: Buffer, contentType: string): Promise<string> {
    assertObjectName(name)
    const blob = await put(`uploads/temp/${name}`, body, { access: 'public', addRandomSuffix: false, contentType })
    return blob.url
  }

  async delete(url: string): Promise<void> {
    if (isBlobUrl(url)) await del(url)
  }
}
