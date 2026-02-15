/**
 * Project Generation API Route (SSE)
 *
 * Runs create-nextspark-app and streams progress back.
 * After generation, triggers the AI chat to configure the project.
 *
 * POST /api/generate
 * Body: { prompt: string }
 * Response: text/event-stream
 */

import { runStudio } from '@nextsparkjs/studio'
import type { StudioEvent } from '@nextsparkjs/studio'
import { generateProject, setCurrentProject, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'

export const runtime = 'nodejs'
export const maxDuration = 300

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'my-project'
}

export async function POST(request: Request) {
  const body = await request.json()
  const { prompt } = body as { prompt?: string }

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return Response.json({ error: 'prompt is required' }, { status: 400 })
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

        // Phase 2: Generate the actual project
        if (!studioResult?.wizardConfig) {
          send({ type: 'error', content: 'No configuration generated' })
          return
        }

        const wc = studioResult.wizardConfig
        const slug = slugify(wc.projectName || wc.projectSlug || 'my-project')

        // Check if project already exists
        if (existsSync(getProjectPath(slug))) {
          send({ type: 'phase', phase: 'exists', content: `Project "${slug}" already exists, skipping generation` })
          setCurrentProject(slug)
          send({
            type: 'project_ready',
            slug,
            content: `Project ready: ${slug}`,
          })
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
