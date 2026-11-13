/**
 * Runs the requests of TEAM_MEMBERS_STEPS through core's real member and invitation route modules (real API-key
 * authentication, membership, permissions and database access, no mocks) and prints one `RESULT <json>` line per step.
 * A `CALL` step runs TeamMemberService.remove or updateRole (what the removeMember and updateMemberRole actions call
 * after their checks) as `actor`, on the service connection when `service` is set.
 * Started by team-members-cutover.test.ts under tsx with this folder's tsconfig.
 */
import { NextRequest } from 'next/server'

type Step =
  | { method: 'PATCH' | 'DELETE'; path: string; key: string; body?: unknown }
  | { method: 'CALL'; path: 'remove' | 'updateRole'; args: string[]; service: boolean }

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const memberRoute = await import(new URL('routes/api/v1/teams/[teamId]/members/[memberId]/route.ts', CORE_SRC).href)
const invitationsRoute = await import(new URL('routes/api/v1/teams/[teamId]/invitations/route.ts', CORE_SRC).href)
const { TeamMemberService } = await import(new URL('lib/services/team-member.service.ts', CORE_SRC).href)

async function call(step: Extract<Step, { method: 'CALL' }>) {
  const options = step.service ? { service: true } : undefined
  try {
    await (TeamMemberService[step.path] as (...a: unknown[]) => Promise<unknown>)(...step.args, options)
    return { status: 200, body: {} }
  } catch (error) {
    return { status: 500, body: { error: (error as Error).message } }
  }
}

async function run(step: Step) {
  if (step.method === 'CALL') return call(step)
  // /api/v1/teams/<teamId>/members/<memberId> or /api/v1/teams/<teamId>/invitations?id=<id>
  const url = new URL(`http://localhost${step.path}`)
  const [, , , , teamId, kind, memberId] = url.pathname.split('/')
  const request = new NextRequest(url, {
    method: step.method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${step.key}` },
    body: step.body === undefined ? undefined : JSON.stringify(step.body),
  })
  const handler = (kind === 'members' ? memberRoute : invitationsRoute)[step.method]
  const response: Response = await handler(request, { params: Promise.resolve({ teamId, memberId }) })
  const text = await response.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { status: response.status, body }
}

for (const step of JSON.parse(process.env.TEAM_MEMBERS_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ method: step.method, path: step.path, ...(await run(step)) })}`)
}
process.exit(0)
