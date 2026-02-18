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
import { symlink, mkdir, readFile, writeFile, readdir } from 'fs/promises'
import { runStudio } from '@nextsparkjs/studio'
import type { StudioEvent } from '@nextsparkjs/studio'
import { generateProject, setCurrentProject, getProjectPath } from '@/lib/project-manager'
import { generateAllPageTemplates, getTemplateFilePath } from '@/lib/page-template-generator'
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
        }, studioResult?.entities)

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

        // Step 2.5: Patch next-intl config stubs
        // next-intl uses self-referencing imports (import from "next-intl/config") which
        // webpack 5 resolves directly via package.json exports field to stub files that throw.
        // Neither resolve.alias nor NormalModuleReplacementPlugin can intercept self-references.
        // Fix: replace the stub files with a re-export of the project's i18n config.
        send({ type: 'generate_log', content: '[studio] Patching next-intl config...' })
        try {
          const nextIntlBase = path.join(projectDir, 'node_modules/next-intl/dist/esm')
          const configRedirect = `export { default } from '@nextsparkjs/core/i18n';\n`
          for (const env of ['production', 'development']) {
            const stubPath = path.join(nextIntlBase, env, 'config.js')
            if (existsSync(stubPath)) {
              await writeFile(stubPath, configRedirect, 'utf-8')
            }
          }
          send({ type: 'generate_log', content: '[studio] next-intl config patched' })
        } catch (err) {
          send({ type: 'generate_log', content: `[studio] next-intl patch warning: ${err instanceof Error ? err.message : String(err)}` })
        }

        // Step 2.6: Patch .ts dynamic imports in @nextsparkjs/core
        // The core package's compiled registry.js has `import(`../../messages/${locale}/index.ts`)`
        // which webpack can't parse as TypeScript in node_modules. Replace .ts → .js.
        send({ type: 'generate_log', content: '[studio] Patching core imports...' })
        try {
          const coreDir = path.join(projectDir, 'node_modules/@nextsparkjs/core')
          const registryFile = path.join(coreDir, 'dist/lib/translations/registry.js')
          if (existsSync(registryFile)) {
            let content = await readFile(registryFile, 'utf-8')
            if (content.includes('/index.ts')) {
              content = content.replace(/\/index\.ts/g, '/index.js')
              await writeFile(registryFile, content, 'utf-8')
              send({ type: 'generate_log', content: '[studio] Core imports patched' })
            }
          }
        } catch (err) {
          send({ type: 'generate_log', content: `[studio] Core patch warning: ${err instanceof Error ? err.message : String(err)}` })
        }

        // Step 2.7: Patch auth-client.js for basePath compatibility
        // Better Auth's withPath() returns baseURL as-is when it has a pathname.
        // When NEXT_PUBLIC_APP_URL is e.g. "http://host/p/5510", auth calls go to
        // /p/5510/sign-in/email instead of /p/5510/api/auth/sign-in/email.
        // Fix: append "/api/auth" to the baseURL so the full auth path is included.
        send({ type: 'generate_log', content: '[studio] Patching auth client...' })
        try {
          const authClientFile = path.join(projectDir, 'node_modules/@nextsparkjs/core/dist/lib/auth-client.js')
          if (existsSync(authClientFile)) {
            let content = await readFile(authClientFile, 'utf-8')
            if (content.includes('process.env.NEXT_PUBLIC_APP_URL')) {
              // Replace: baseURL: process.env.NEXT_PUBLIC_APP_URL || "..."
              // With:    baseURL: (process.env.NEXT_PUBLIC_APP_URL || "...") + "/api/auth"
              content = content.replace(
                /baseURL:\s*(process\.env\.NEXT_PUBLIC_APP_URL\s*\|\|\s*["'][^"']+["'])/,
                'baseURL: ($1) + "/api/auth"'
              )
              await writeFile(authClientFile, content, 'utf-8')
              send({ type: 'generate_log', content: '[studio] Auth client patched for basePath' })
            }
          }
        } catch (err) {
          send({ type: 'generate_log', content: `[studio] Auth client patch warning: ${err instanceof Error ? err.message : String(err)}` })
        }

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

        // Step 5: Generate page templates from AI-defined pages
        const pageDefinitions = studioResult?.pages || []
        if (pageDefinitions.length > 0) {
          send({ type: 'generate_log', content: `[studio] Generating ${pageDefinitions.length} page template(s)...` })
          const themeName = wc.projectSlug || slug
          const templates = generateAllPageTemplates(pageDefinitions)
          for (const [route, templateContent] of templates) {
            const relPath = getTemplateFilePath(route, themeName)
            const absPath = path.join(projectDir, relPath)
            await mkdir(path.dirname(absPath), { recursive: true })
            await writeFile(absPath, templateContent, 'utf-8')
            send({ type: 'generate_log', content: `[studio] Wrote ${relPath}` })
          }
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
