/**
 * Project Generation API Route (SSE)
 *
 * Generates projects directly from bundled templates and streams progress.
 * After generation, installs dependencies and builds registries.
 * Persists session state to PostgreSQL throughout.
 *
 * POST /api/generate
 * Body: { prompt: string, sessionId?: string }
 * Response: text/event-stream
 */

import { spawn } from 'child_process'
import path from 'path'
import { symlink, mkdir } from 'fs/promises'
import { runStudio } from '@nextsparkjs/studio'
import type { StudioEvent } from '@nextsparkjs/studio'
import { generateProject, setCurrentProject, getProjectPath } from '@/lib/project-manager'
import { existsSync } from 'fs'
import { query, queryOne } from '@/lib/db'
import { runMigrations } from '@/lib/migrate'
import { requireSession } from '@/lib/auth-helpers'
import { checkRateLimit, AI_RATE_LIMITS, rateLimitResponse } from '@/lib/rate-limit'

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
  let session
  try { session = await requireSession() } catch (r) { return r as Response }

  const rateCheck = checkRateLimit(session.user.id, AI_RATE_LIMITS)
  if (!rateCheck.allowed) return rateLimitResponse(rateCheck.resetAt)

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

        // Step 1: Generate project files directly from templates
        await generateProject(slug, wc, (line: string) => {
          send({ type: 'generate_log', content: line })
        })

        // Step 2: Install dependencies
        send({ type: 'generate_log', content: '[studio] Installing dependencies...' })
        const projectDir = getProjectPath(slug)

        await new Promise<void>((resolve, reject) => {
          const child = spawn('pnpm', ['install'], {
            cwd: projectDir,
            shell: true,
            env: { ...process.env, FORCE_COLOR: '0', CI: 'true', NO_COLOR: '1' },
          })
          child.stdout?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((l: string) => l.trim())
            for (const line of lines) {
              send({ type: 'generate_log', content: `[pnpm] ${line.trim()}` })
            }
          })
          child.stderr?.on('data', (data: Buffer) => {
            const lines = data.toString().split('\n').filter((l: string) => l.trim())
            for (const line of lines) {
              send({ type: 'generate_log', content: `[pnpm] ${line.trim()}` })
            }
          })
          child.on('close', (code) =>
            code === 0 ? resolve() : reject(new Error(`pnpm install failed with exit code ${code}`))
          )
        })

        // Step 3: Build registries
        send({ type: 'generate_log', content: '[studio] Building registries...' })
        const registryScript = path.join(
          projectDir,
          'node_modules/@nextsparkjs/core/scripts/build/registry.mjs'
        )
        if (existsSync(registryScript)) {
          await new Promise<void>((resolve, reject) => {
            const child = spawn('node', [registryScript, '--build'], {
              cwd: projectDir,
              shell: true,
              env: { ...process.env, NEXTSPARK_PROJECT_ROOT: projectDir },
            })
            child.stdout?.on('data', (data: Buffer) => {
              const lines = data.toString().split('\n').filter((l: string) => l.trim())
              for (const line of lines) {
                send({ type: 'generate_log', content: `[registry] ${line.trim()}` })
              }
            })
            child.on('close', (code) =>
              code === 0 ? resolve() : reject(new Error(`Registry build failed with exit code ${code}`))
            )
          })
        }

        // Step 4: Create symlink for @nextsparkjs/registries resolution
        // Webpack alias in next.config.mjs handles this for app code, but imports from within
        // node_modules/@nextsparkjs/core may not resolve through webpack aliases.
        // The symlink ensures Node.js module resolution also finds the registries.
        send({ type: 'generate_log', content: '[studio] Linking registries...' })
        try {
          const registriesTarget = path.join(projectDir, '.nextspark', 'registries')
          const registriesLink = path.join(projectDir, 'node_modules', '@nextsparkjs', 'registries')
          if (existsSync(registriesTarget) && !existsSync(registriesLink)) {
            await mkdir(path.dirname(registriesLink), { recursive: true })
            await symlink(registriesTarget, registriesLink, 'junction')
            send({ type: 'generate_log', content: '[studio] Registries linked successfully' })
          }
        } catch (err) {
          // Non-fatal: webpack alias should still work as fallback
          send({ type: 'generate_log', content: `[studio] Registry linking skipped: ${err instanceof Error ? err.message : String(err)}` })
        }

        send({ type: 'generate_log', content: '[studio] Project ready!' })

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
