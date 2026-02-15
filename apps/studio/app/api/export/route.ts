/**
 * Export API — Download project as ZIP
 *
 * GET /api/export?slug=my-project
 *
 * Streams a ZIP file of the project, excluding
 * node_modules, .next, and sensitive .env files.
 */

import { existsSync } from 'fs'
import archiver from 'archiver'
import { getProjectPath } from '@/lib/project-manager'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }

  const projectPath = getProjectPath(slug)
  if (!existsSync(projectPath)) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Create a readable stream from archiver
  const archive = archiver('zip', { zlib: { level: 6 } })

  // Collect into a buffer (archiver doesn't directly give us a web ReadableStream)
  const chunks: Uint8Array[] = []

  archive.on('data', (chunk: Buffer) => {
    chunks.push(new Uint8Array(chunk))
  })

  const done = new Promise<Uint8Array>((resolve, reject) => {
    archive.on('end', () => {
      const total = chunks.reduce((acc, c) => acc + c.length, 0)
      const result = new Uint8Array(total)
      let offset = 0
      for (const chunk of chunks) {
        result.set(chunk, offset)
        offset += chunk.length
      }
      resolve(result)
    })
    archive.on('error', reject)
  })

  // Add directory with exclusions
  archive.glob('**/*', {
    cwd: projectPath,
    ignore: [
      'node_modules/**',
      '.next/**',
      '.git/**',
      '.turbo/**',
      '.env',
      '.env.local',
    ],
    dot: true,
  })

  archive.finalize()

  const zipBuffer = await done

  return new Response(zipBuffer.buffer as ArrayBuffer, {
    headers: {
      'Content-Type': 'application/zip',
      'Content-Disposition': `attachment; filename="${slug}.zip"`,
      'Content-Length': String(zipBuffer.length),
    },
  })
}
