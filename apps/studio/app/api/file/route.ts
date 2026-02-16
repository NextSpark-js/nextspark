/**
 * File Content API
 *
 * GET /api/file?slug=my-project&path=src/app/page.tsx
 * Returns the content of a single file from a generated project.
 */

import { readProjectFile, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'
import { requireSession } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')
  const filePath = searchParams.get('path')

  if (!slug || !filePath) {
    return Response.json({ error: 'slug and path are required' }, { status: 400 })
  }

  if (!existsSync(getProjectPath(slug))) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  try {
    const content = await readProjectFile(slug, filePath)
    return Response.json({ content, path: filePath })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to read file'
    return Response.json({ error: message }, { status: 400 })
  }
}
