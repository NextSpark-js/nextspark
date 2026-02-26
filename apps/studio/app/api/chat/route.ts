/**
 * Chat API Route (SSE)
 *
 * Handles post-generation iterative chat. Users can modify their
 * project through natural language messages. The AI reads/writes
 * project files and rebuilds registries as needed.
 *
 * POST /api/chat
 * Body: { slug: string, message: string, history?: ChatMessage[], sessionId?: string }
 * Response: text/event-stream
 */

import { runChat } from '@nextsparkjs/studio'
import type { StudioEvent, StudioResult } from '@nextsparkjs/studio'
import { getProjectPath } from '@/lib/project-manager'
import { scanProjectState } from '@/lib/project-scanner'
import { existsSync, readFileSync } from 'fs'
import path from 'path'
import { query, queryOne } from '@/lib/db'
import { requireSession } from '@/lib/auth-helpers'
import { checkRateLimit, AI_RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

interface ChatRequestBody {
  slug: string
  message: string
  history?: Array<{ role: 'user' | 'assistant'; content: string }>
  sessionId?: string
}

export async function POST(request: Request) {
  let session
  try { session = await requireSession() } catch (r) { return r as Response }

  const rateCheck = checkRateLimit(session.user.id, AI_RATE_LIMITS)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetAt)

  const body = (await request.json()) as ChatRequestBody

  if (!body.slug || typeof body.slug !== 'string') {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }
  if (!body.message || typeof body.message !== 'string' || !body.message.trim()) {
    return Response.json({ error: 'message is required' }, { status: 400 })
  }

  const projectDir = getProjectPath(body.slug)
  if (!existsSync(projectDir)) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  // Resolve theme name from .env
  let themeName = body.slug
  try {
    const envContent = readFileSync(path.join(projectDir, '.env'), 'utf-8')
    const themeMatch = envContent.match(/NEXT_PUBLIC_ACTIVE_THEME="?([^"\n]+)"?/)
    if (themeMatch) themeName = themeMatch[1]
  } catch {
    // Use slug as fallback
  }

  // Load studio result from session if available
  let studioResult: StudioResult | undefined
  if (body.sessionId) {
    try {
      const row = await queryOne(
        `SELECT result FROM sessions WHERE id = $1`,
        [body.sessionId]
      )
      if (row?.result) {
        studioResult = typeof row.result === 'string' ? JSON.parse(row.result) : row.result
      }
    } catch {
      // Non-critical — chat works without previous context
    }
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StudioEvent) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Stream may have been closed
        }
      }

      function close() {
        if (closed) return
        closed = true
        try {
          controller.close()
        } catch {
          // Already closed
        }
      }

      try {
        const { response, filesModified } = await runChat(
          body.message.trim(),
          {
            projectDir,
            projectSlug: body.slug,
            themeName,
            studioResult,
            history: body.history,
          },
          (event: StudioEvent) => {
            send(event)
          }
        )

        // Send completion event with list of modified files
        if (filesModified.length > 0) {
          send({
            type: 'files_modified',
            content: `Modified ${filesModified.length} file(s)`,
            filesModified,
          })
        }

        // If entity or config files were modified, re-scan and update session
        if (filesModified.length > 0 && body.sessionId) {
          const hasEntityChanges = filesModified.some(f => f.includes('/entities/'))
          const hasConfigChanges = filesModified.some(f => f.includes('/config/'))

          if (hasEntityChanges || hasConfigChanges) {
            try {
              const updatedResult = await scanProjectState(projectDir, themeName)
              await query(
                `UPDATE sessions SET result = result || $1::jsonb, updated_at = NOW() WHERE id = $2`,
                [JSON.stringify(updatedResult), body.sessionId]
              )
              send({
                type: 'result_updated',
                content: JSON.stringify(updatedResult),
              })
            } catch {
              // Best-effort — chat still works without session sync
            }
          }
        }

        send({
          type: 'chat_complete',
          content: response || 'Done',
        })

        // Update session timestamp if sessionId provided (only if not already updated above)
        if (body.sessionId) {
          try {
            await query(
              `UPDATE sessions SET updated_at = NOW() WHERE id = $1`,
              [body.sessionId]
            )
          } catch {
            // Best-effort
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send({ type: 'error', content: message })
      } finally {
        close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
