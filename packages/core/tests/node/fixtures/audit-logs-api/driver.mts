/**
 * Runs the requests of AUDIT_LOGS_STEPS through core's real generic entity routes (/api/v1/audit-logs[/:id]) and
 * social-media-publisher's real disconnect route (real authentication, team context, permissions and database
 * access, no mocks) and prints one `RESULT <json>` line per step. Started by social-audit-logs-api.test.ts under tsx
 * with this folder's tsconfig.
 */
import { NextRequest } from 'next/server'

type Step = { method: 'GET' | 'POST' | 'PATCH' | 'DELETE'; path: string; key?: string; team?: string; body?: unknown }

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const PLUGIN = new URL('../../../../../../plugins/social-media-publisher/', import.meta.url)
const listRoute = await import(new URL('routes/api/v1/[entity]/route.ts', CORE_SRC).href)
const itemRoute = await import(new URL('routes/api/v1/[entity]/[id]/route.ts', CORE_SRC).href)
const disconnectRoute = await import(new URL('api/social/disconnect/route.ts', PLUGIN).href)

async function run(step: Step) {
  const headers: Record<string, string> = { 'content-type': 'application/json', 'user-agent': 'audit-logs-test' }
  if (step.key) headers.authorization = `Bearer ${step.key}`
  if (step.team) headers['x-team-id'] = step.team
  const request = new NextRequest(`http://localhost${step.path}`, {
    method: step.method,
    headers,
    body: step.body === undefined ? undefined : JSON.stringify(step.body),
  })
  let response: Response
  if (step.path.startsWith('/api/plugins/social-media-publisher/social/disconnect')) {
    response = await disconnectRoute[step.method](request)
  } else {
    // /api/v1/<entity>[/<id>]
    const [, , , entity, id] = step.path.split('?')[0].split('/')
    response = await (id ? itemRoute : listRoute)[step.method](request, { params: Promise.resolve({ entity, id }) })
  }
  const text = await response.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { status: response.status, body }
}

for (const step of JSON.parse(process.env.AUDIT_LOGS_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ method: step.method, path: step.path, ...(await run(step)) })}`)
}
process.exit(0)
