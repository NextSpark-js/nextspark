/**
 * Session API — Get, Update, Delete
 *
 * GET    /api/sessions/:id  — Load full session state
 * PATCH  /api/sessions/:id  — Update session (auto-save)
 * DELETE /api/sessions/:id  — Delete session
 */

import { queryOne, query } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'

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

type RouteContext = { params: Promise<{ id: string }> }

export async function GET(_request: Request, context: RouteContext) {
  await runMigrations()
  const { id } = await context.params

  const session = await queryOne<SessionRow>(
    'SELECT * FROM sessions WHERE id = $1',
    [id]
  )

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  return Response.json({ session })
}

export async function PATCH(request: Request, context: RouteContext) {
  await runMigrations()
  const { id } = await context.params
  const body = await request.json()

  // Build dynamic SET clause from provided fields
  const allowedFields = ['status', 'project_slug', 'result', 'messages', 'pages', 'error']
  const setClauses: string[] = ['updated_at = NOW()']
  const values: unknown[] = []
  let paramIndex = 1

  for (const field of allowedFields) {
    if (field in body) {
      const dbField = field // already matches column names
      const value = (field === 'result' || field === 'messages' || field === 'pages')
        ? JSON.stringify(body[field])
        : body[field]
      setClauses.push(`${dbField} = $${paramIndex}`)
      values.push(value)
      paramIndex++
    }
  }

  if (values.length === 0) {
    return Response.json({ error: 'No fields to update' }, { status: 400 })
  }

  values.push(id)
  const session = await queryOne<SessionRow>(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
    values
  )

  if (!session) {
    return Response.json({ error: 'Session not found' }, { status: 404 })
  }

  return Response.json({ session })
}

export async function DELETE(_request: Request, context: RouteContext) {
  await runMigrations()
  const { id } = await context.params

  await query('DELETE FROM sessions WHERE id = $1', [id])
  return Response.json({ ok: true })
}
