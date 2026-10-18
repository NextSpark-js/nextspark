import { NextRequest } from 'next/server'
import { selectStorageDriver } from '@nextsparkjs/core/lib/media/storage/index'
import { LocalStorageDriver } from '@nextsparkjs/core/lib/media/storage/local'

/**
 * GET /api/v1/media/files/:name
 *
 * Serves a file stored by the local driver (STORAGE_DRIVER=local), public like a
 * Blob or bucket URL. The name must be one the server generates (no separators),
 * so nothing outside UPLOADS_DIR can be reached. Type from the stored extension,
 * `X-Content-Type-Options: nosniff`, single byte ranges. 404 with any other driver.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const selection = selectStorageDriver()
  if (!selection.driver || selection.developmentFallback || !(selection.driver instanceof LocalStorageDriver)) {
    return new Response('Not found', { status: 404 })
  }
  const driver = selection.driver
  const { name } = await params
  try {
    return await driver.serve(name, request.headers.get('range'))
  } catch (error) {
    console.error('[Media Files] Error serving a file:', error)
    return new Response('Failed to read the file', { status: 500 })
  }
}
