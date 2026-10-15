/**
 * Runs the requests of CHILD_ROUTES_STEPS through core's real child-entity route modules (real authentication, team
 * context, permissions and database access, no mocks) and prints one `RESULT <json>` line per step. Started by
 * child-routes-access.test.ts under tsx with this folder's tsconfig.
 */
import { NextRequest } from 'next/server'

type Step = { method: 'GET' | 'POST' | 'PUT' | 'DELETE'; path: string; key?: string; team?: string; body?: unknown }

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const listRoute = await import(new URL('routes/api/v1/[entity]/[id]/child/[childType]/route.ts', CORE_SRC).href)
const itemRoute = await import(new URL('routes/api/v1/[entity]/[id]/child/[childType]/[childId]/route.ts', CORE_SRC).href)

async function run(step: Step) {
  // /api/v1/<entity>/<id>/child/<childType>[/<childId>]
  const [, , , entity, id, , childType, childId] = step.path.split('/')
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (step.key) headers.authorization = `Bearer ${step.key}`
  if (step.team) headers['x-team-id'] = step.team
  const request = new NextRequest(`http://localhost${step.path}`, {
    method: step.method,
    headers,
    body: step.body === undefined ? undefined : JSON.stringify(step.body),
  })
  const handler = (childId ? itemRoute : listRoute)[step.method]
  const response: Response = await handler(request, { params: Promise.resolve({ entity, id, childType, childId }) })
  const text = await response.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { status: response.status, body }
}

for (const step of JSON.parse(process.env.CHILD_ROUTES_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ method: step.method, path: step.path, ...(await run(step)) })}`)
}
process.exit(0)
