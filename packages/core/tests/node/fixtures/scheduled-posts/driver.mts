/**
 * Runs the requests of SCHEDULED_POSTS_STEPS through core's real entity route modules (real authentication, team
 * context and database access, no mocks) and prints one `RESULT <json>` line per step. Started by
 * scheduled-posts-public.test.ts under tsx with this folder's tsconfig.
 */
import { NextRequest } from 'next/server'

type Step = { path: string; key?: string; team?: string }

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const listRoute = await import(new URL('routes/api/v1/[entity]/route.ts', CORE_SRC).href)
const itemRoute = await import(new URL('routes/api/v1/[entity]/[id]/route.ts', CORE_SRC).href)

async function run(step: Step) {
  // /api/v1/<entity>[/<id>][?query]
  const url = new URL(`http://localhost${step.path}`)
  const [, , , entity, id] = url.pathname.split('/')
  const headers: Record<string, string> = {}
  if (step.key) headers.authorization = `Bearer ${step.key}`
  if (step.team) headers['x-team-id'] = step.team
  const request = new NextRequest(url, { method: 'GET', headers })
  const response: Response = await (id ? itemRoute : listRoute).GET(request, { params: Promise.resolve({ entity, id }) })
  const text = await response.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { status: response.status, body }
}

for (const step of JSON.parse(process.env.SCHEDULED_POSTS_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ path: step.path, ...(await run(step)) })}`)
}
process.exit(0)
