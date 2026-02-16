/**
 * Preview Server API
 *
 * POST /api/preview  { action: 'setup', slug: 'my-project' }
 * POST /api/preview  { action: 'start', slug: 'my-project' }
 * POST /api/preview  { action: 'stop', slug: 'my-project' }
 *
 * Manages database setup and pnpm dev server for generated projects.
 * v2: env isolation + PORT env var (not -p flag)
 */

import { startPreview, stopPreview, setupProjectDatabase, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'
import { requireSession } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

export async function POST(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const body = await request.json()
  const { action, slug, port: requestedPort } = body as { action?: string; slug?: string; port?: number }

  if (!slug || !action) {
    return Response.json({ error: 'action and slug are required' }, { status: 400 })
  }

  if (!existsSync(getProjectPath(slug))) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Set up database for the project (create DB, write .env, run migrations)
  if (action === 'setup') {
    try {
      // Pick a port for the preview so .env has the correct APP_URL
      const port = 5500 + Math.floor(Math.random() * 500)
      const logs: string[] = []
      const result = await setupProjectDatabase(slug, port, (line) => {
        logs.push(line)
      })

      if (!result.ok) {
        return Response.json({ error: result.error, logs }, { status: 500 })
      }

      return Response.json({ ok: true, port, logs })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Database setup failed'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  // Start the dev server (optionally pass port from setup)
  if (action === 'start') {
    try {
      const port = await startPreview(slug, requestedPort || undefined)
      // Use the request host so preview works both locally and on remote VPS
      const requestHost = request.headers.get('host') || 'localhost'
      const hostname = requestHost.split(':')[0]
      return Response.json({ port, url: `http://${hostname}:${port}` })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start preview'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  // Stop the dev server
  if (action === 'stop') {
    stopPreview(slug)
    return Response.json({ ok: true })
  }

  return Response.json({ error: 'Invalid action. Use "setup", "start", or "stop".' }, { status: 400 })
}
