/**
 * Preview Server API
 *
 * POST /api/preview  { action: 'start', slug: 'my-project' }
 * POST /api/preview  { action: 'stop', slug: 'my-project' }
 *
 * Manages the pnpm dev server for generated projects.
 */

import { startPreview, stopPreview, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const body = await request.json()
  const { action, slug } = body as { action?: string; slug?: string }

  if (!slug || !action) {
    return Response.json({ error: 'action and slug are required' }, { status: 400 })
  }

  if (!existsSync(getProjectPath(slug))) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  if (action === 'start') {
    try {
      const port = await startPreview(slug)
      return Response.json({ port, url: `http://localhost:${port}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start preview'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  if (action === 'stop') {
    stopPreview(slug)
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Invalid action. Use "start" or "stop".' }, { status: 400 })
}
