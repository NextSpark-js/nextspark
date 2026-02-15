/**
 * GitHub API
 *
 * POST /api/github  { action: 'auth-url' }    → Returns OAuth URL
 * POST /api/github  { action: 'status' }       → Returns auth status + user info
 * POST /api/github  { action: 'push', ... }    → Creates repo + pushes project
 * POST /api/github  { action: 'disconnect' }   → Clears GitHub token
 */

import { cookies } from 'next/headers'
import {
  getAuthUrl,
  getUser,
  createRepo,
  pushProject,
  decryptToken,
  isConfigured,
} from '@/lib/github-manager'

export const runtime = 'nodejs'

const COOKIE_NAME = 'gh_token'

async function getToken(): Promise<string | null> {
  const cookieStore = await cookies()
  const encrypted = cookieStore.get(COOKIE_NAME)?.value
  if (!encrypted) return null

  try {
    return decryptToken(encrypted)
  } catch {
    return null
  }
}

export async function POST(request: Request) {
  const body = await request.json()
  const { action } = body as { action?: string }

  if (!action) {
    return Response.json({ error: 'action is required' }, { status: 400 })
  }

  // ── auth-url: Return GitHub OAuth URL ───────────────────────────────────
  if (action === 'auth-url') {
    if (!isConfigured()) {
      return Response.json({
        error: 'GitHub OAuth not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.',
      }, { status: 503 })
    }

    try {
      const url = getAuthUrl()
      return Response.json({ url })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate auth URL'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  // ── status: Check auth status ───────────────────────────────────────────
  if (action === 'status') {
    const configured = isConfigured()
    const token = await getToken()

    if (!token) {
      return Response.json({ authenticated: false, configured })
    }

    try {
      const user = await getUser(token)
      return Response.json({ authenticated: true, configured, user })
    } catch {
      // Token is invalid — clear cookie
      const cookieStore = await cookies()
      cookieStore.delete(COOKIE_NAME)
      return Response.json({ authenticated: false, configured })
    }
  }

  // ── disconnect: Clear token ─────────────────────────────────────────────
  if (action === 'disconnect') {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
    return Response.json({ ok: true })
  }

  // ── push: Create repo + push project ────────────────────────────────────
  if (action === 'push') {
    const { slug, repoName, description, isPrivate, sanitizeEnv, addReadme } = body as {
      slug?: string
      repoName?: string
      description?: string
      isPrivate?: boolean
      sanitizeEnv?: boolean
      addReadme?: boolean
    }

    if (!slug || !repoName) {
      return Response.json({ error: 'slug and repoName are required' }, { status: 400 })
    }

    const token = await getToken()
    if (!token) {
      return Response.json({ error: 'Not authenticated with GitHub' }, { status: 401 })
    }

    try {
      // Create the repo
      const repo = await createRepo(token, {
        name: repoName,
        description,
        isPrivate: isPrivate ?? true,
      })

      // Push the project
      const steps: string[] = []
      await pushProject({
        slug,
        repoFullName: repo.fullName,
        cloneUrl: repo.cloneUrl,
        token,
        sanitizeEnv: sanitizeEnv ?? true,
        addReadme: addReadme ?? true,
        onLog: (step) => steps.push(step),
      })

      return Response.json({
        ok: true,
        repo: {
          url: repo.url,
          cloneUrl: repo.cloneUrl,
          fullName: repo.fullName,
        },
        steps,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Push failed'
      return Response.json({ error: message }, { status: 500 })
    }
  }

  return Response.json({ error: 'Invalid action' }, { status: 400 })
}
