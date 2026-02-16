/**
 * Deploy API Route (SSE)
 *
 * POST /api/deploy — Deploy a project to VPS via PM2 + Caddy
 *   Streams progress: building → starting → routing → done
 *
 * GET /api/deploy?slug=xxx — Check deployment status
 *
 * DELETE /api/deploy?slug=xxx — Teardown deployment
 */

import { DeployManager, type DeployStep } from '@/lib/deploy-manager'
import { getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'
import { requireSession } from '@/lib/auth-helpers'

export const runtime = 'nodejs'
export const maxDuration = 600 // Build can take up to 10 minutes

export async function POST(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const body = await request.json()
  const { slug } = body as { slug?: string }

  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }

  if (!existsSync(getProjectPath(slug))) {
    return Response.json({ error: 'Project not found' }, { status: 404 })
  }

  const encoder = new TextEncoder()
  let closed = false

  const stream = new ReadableStream({
    async start(controller) {
      function send(step: DeployStep, message: string) {
        if (closed) return
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ step, message })}\n\n`)
          )
        } catch {
          // Stream closed
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
        const result = await DeployManager.deploy(slug, send)

        send('done', JSON.stringify({
          url: result.url,
          port: result.port,
        }))
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        send('error', message)
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

export async function GET(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }

  const status = await DeployManager.getStatus(slug)
  return Response.json(status)
}

export async function DELETE(request: Request) {
  try { await requireSession() } catch (r) { return r as Response }

  const { searchParams } = new URL(request.url)
  const slug = searchParams.get('slug')

  if (!slug) {
    return Response.json({ error: 'slug is required' }, { status: 400 })
  }

  try {
    await DeployManager.teardown(slug)
    return Response.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return Response.json({ error: message }, { status: 500 })
  }
}
