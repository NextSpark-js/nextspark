/**
 * SSE Streaming Chat API Route
 *
 * Receives a user prompt, runs the Studio orchestrator,
 * and streams StudioEvents back as Server-Sent Events.
 *
 * POST /api/chat
 * Body: { prompt: string }
 * Response: text/event-stream
 */

import { runStudio } from '@nextsparkjs/studio'
import type { StudioEvent } from '@nextsparkjs/studio'
import { requireSession } from '@/lib/auth-helpers'
import { checkRateLimit, AI_RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 120

export async function POST(request: Request) {
  let session
  try { session = await requireSession() } catch (r) { return r as Response }

  const rateCheck = checkRateLimit(session.user.id, AI_RATE_LIMITS)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetAt)

  const body = await request.json()
  const { prompt } = body as { prompt?: string }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function sendEvent(event: StudioEvent) {
        const data = JSON.stringify(event)
        controller.enqueue(encoder.encode(`data: ${data}\n\n`))
      }

      try {
        const result = await runStudio(prompt.trim(), sendEvent)

        // Send final result as a special event
        sendEvent({
          type: 'generation_complete',
          content: 'Configuration complete',
          data: result,
        })
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        sendEvent({ type: 'error', content: message })
      } finally {
        controller.close()
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
