/**
 * File Tree API
 *
 * GET /api/files?slug=my-project
 * Returns recursive file tree for a generated project.
 */

import { listProjectFiles, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'
import { requireSession } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }

  if (!existsSync(getProjectPath(slug))) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const files = await listProjectFiles(slug)
  return Response.json({ files })
}
