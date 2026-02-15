/**
 * Project Generation API Route (SSE)
 *
 * Runs create-nextspark-app and streams progress back.
 * After generation, triggers the AI chat to configure the project.
 * Persists session state to PostgreSQL throughout.
 *
 * POST /api/generate
 * Body: { prompt: string, sessionId?: string }
 * Response: text/event-stream
 */

import { runStudio } from '@nextsparkjs/studio'
import type { StudioEvent } from '@nextsparkjs/studio'
import { generateProject, setCurrentProject, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'
import { query, queryOne } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'

export const runtime = 'nodejs'
export const maxDuration = 300

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'my-project'
}

async function saveSession(
  sessionId: string,
  data: Record<string, unknown>
): Promise<void> {
  const fields = Object.keys(data)
  if (fields.length === 0) return

  const setClauses = ['updated_at = NOW()']
  const values: unknown[] = []
  let i = 1

  for (const field of fields) {
    const value = (field === 'result' || field === 'messages' || field === 'pages')
      ? JSON.stringify(data[field])
      : data[field]
    setClauses.push(`${field} = $${i}`)
    values.push(value)
    i++
  }

  values.push(sessionId)
  await query(
    `UPDATE sessions SET ${setClauses.join(', ')} WHERE id = $${i}`,
    values
  )
}

export async function POST(request: Request) {
  const body = await request.json()
  const { prompt, sessionId } = body as { prompt?: string; sessionId?: string }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400 })
  }

  // Generate session ID if not provided
  const sid = sessionId || crypto.randomUUID()

  // Ensure migrations are applied
  await runMigrations()

  // Create session row
  await queryOne(
    `INSERT INTO sessions (id, prompt, status)
     VALUES ($1, $2, 'streaming')
     ON CONFLICT (id) DO UPDATE SET status = 'streaming', updated_at = NOW()`,
    [sid, prompt.trim()]
  )

  const encoder = new TextEncoder()
  let closed = false

  // Collect messages for periodic saves
  const collectedMessages: unknown[] = []

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: StudioEvent) {
        if (closed) return
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        } catch {
          // Stream may have been closed by the client
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
        // Send session ID as first event so client can update URL
        send({ type: 'session_init', sessionId: sid })

        // Phase 1: Run AI to analyze and configure
        send({ type: 'phase', phase: 'analyzing', content: 'Analyzing your requirements...' })

        const studioResult = await runStudio(prompt.trim(), (event: StudioEvent) => {
          send(event)
        })

        send({
          type: 'generation_complete',
          content: 'Configuration complete',
          data: studioResult,
        })

        // Save result to session
        const pages = studioResult?.pages || []
        await saveSession(sid, {
          result: studioResult,
          pages,
          status: 'generating',
        })

        // Phase 2: Generate the actual project
        if (!studioResult?.wizardConfig) {
          send({ type: 'error', content: 'No configuration generated' })
          await saveSession(sid, { status: 'error', error: 'No configuration generated' })
          return
        }

        const wc = studioResult.wizardConfig
        const slug = slugify(wc.projectName || wc.projectSlug || 'my-project')

        await saveSession(sid, { project_slug: slug })

        // Check if project already exists
        if (existsSync(getProjectPath(slug))) {
          send({ type: 'phase', phase: 'exists', content: `Project "${slug}" already exists, skipping generation` })
          setCurrentProject(slug)
          send({
            type: 'project_ready',
            slug,
            content: `Project ready: ${slug}`,
          })
          await saveSession(sid, { status: 'complete' })
          return
        }

        send({ type: 'phase', phase: 'generating', content: `Generating project "${slug}"...` })

        await new Promise<void>((resolve, reject) => {
          generateProject(
            slug,
            {
              preset: studioResult.analysis?.preset || 'saas',
              name: wc.projectName || slug,
              description: wc.projectDescription || prompt.trim().slice(0, 100),
            },
            (line: string) => {
              send({ type: 'generate_log', content: line })
            },
            (code: number) => {
              if (code === 0) {
                resolve()
              } else {
                reject(new Error(`Generation failed with exit code ${code}`))
              }
            }
          )
        })

        send({
          type: 'project_ready',
          slug,
          content: `Project "${slug}" generated successfully!`,
        })

        // Final save — complete
        await saveSession(sid, { status: 'complete' })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send({ type: 'error', content: message })
        // Save error state
        try {
          await saveSession(sid, { status: 'error', error: message })
        } catch {
          // Best-effort persistence
        }
      } finally {
        // Save collected messages before closing
        if (collectedMessages.length > 0) {
          try {
            await saveSession(sid, { messages: collectedMessages })
          } catch {
            // Best-effort
          }
        }
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
