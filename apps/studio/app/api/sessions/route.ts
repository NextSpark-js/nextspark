/**
 * Sessions API — List & Create
 *
 * GET  /api/sessions          — List recent sessions
 * POST /api/sessions          — Create a new session
 */

import { query, queryOne } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'
import { requireSession } from '@/lib/auth-helpers'

export const runtime = 'nodejs'

interface SessionRow {
  id: string
  prompt: string
  status: string
  project_slug: string | null
  result: unknown
  messages: unknown
  pages: unknown
  error: string | null
  created_at: string
  updated_at: string
}

export async function GET(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }
  await runMigrations()

  const { searchParams } = new URL(request.url)
  const limit = Math.min(parseInt(searchParams.get('limit') || '50', 10), 100)
  const offset = parseInt(searchParams.get('offset') || '0', 10)

  const sessions = await query<SessionRow>(
    `SELECT id, prompt, status, project_slug, result, pages, error, created_at, updated_at
     FROM sessions
     ORDER BY updated_at DESC
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  )

  // Don't send full messages in list — just metadata
  return Response.json({ sessions })
}

export async function POST(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }
  await runMigrations()

  const body = await request.json()
  const { id, prompt } = body as { id: string; prompt: string }

  if (!id || !prompt) {
    return Response.json({ error: 'id and prompt are required' }, { status: 400 })
  }

  const session = await queryOne<SessionRow>(
    `INSERT INTO sessions (id, prompt, status)
     VALUES ($1, $2, 'loading')
     ON CONFLICT (id) DO NOTHING
     RETURNING *`,
    [id, prompt]
  )

  if (!session) {
    // Already exists — return existing
    const existing = await queryOne<SessionRow>(
      'SELECT * FROM sessions WHERE id = $1',
      [id]
    )
    return Response.json({ session: existing })
  }

  return Response.json({ session }, { status: 201 })
}
