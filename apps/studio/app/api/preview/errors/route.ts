/**
 * Preview Errors API
 *
 * GET /api/preview/errors?slug=xxx
 *
 * Returns current compilation/TypeScript errors from the preview dev server.
 * Polled by the frontend every 3s to surface errors in the UI.
 */

import { getPreviewErrors } from '@/lib/project-manager'

export const runtime = 'nodejs'

export async function GET(request: Request) {
  const slug = new URL(request.url).searchParams.get('slug')
  if (!slug) {
    return Response.json({ errors: [], count: 0 })
  }

  const errors = getPreviewErrors(slug)
  return Response.json({ errors, count: errors.length })
}
