/**
 * Runs the requests of SOCIAL_ADAPTER_STEPS through social-media-publisher's real accounts, assign, publish, connect
 * (POST) and OAuth callback routes (real authentication and database access) and prints one `RESULT <json>` line per
 * step. A step with `adapter: true` runs with the test adapter below registered, as a project registers its own;
 * without it no adapter is registered. `team` is the request's x-team-id (team-a by default). The Graph API is
 * stubbed: no request leaves the process. The adapter prints `RECORDED <json>` for each post the publish route hands
 * it and `SAVED <json>` for each assignment it is asked to save. Started by social-media-adapter.test.ts under tsx
 * with this folder's tsconfig.
 */
import { NextRequest } from 'next/server'

type Step = {
  route: 'accounts' | 'assign' | 'publish' | 'callback' | 'connect'
  query?: string; key: string; adapter?: boolean; body?: unknown; team?: string
}

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const PLUGIN = new URL('../../../../../../plugins/social-media-publisher/', import.meta.url)
const routes = {
  accounts: await import(new URL('api/social/accounts/route.ts', PLUGIN).href),
  assign: await import(new URL('api/social/assign/route.ts', PLUGIN).href),
  publish: await import(new URL('api/social/publish/route.ts', PLUGIN).href),
  callback: await import(new URL('api/social/connect/callback/route.ts', PLUGIN).href),
  connect: await import(new URL('api/social/connect/route.ts', PLUGIN).href),
}
const { SocialPlatformAdapter, registerSocialPlatformAdapter, clearAdapter } = await import(new URL('lib/adapter/index.ts', PLUGIN).href)
const { queryWithRLS } = await import(new URL('lib/db.ts', CORE_SRC).href)

const ENTITY = process.env.SOCIAL_ENTITY_ID!
const ASSIGNMENT = process.env.SOCIAL_ASSIGNMENT_ID!
// The other user's entity: user B assigns to it
const ENTITY_B = process.env.SOCIAL_ENTITY_B_ID!

// A project's adapter: the entity and its assignment live in the project; the token comes from social_accounts, read
// on the service connection (as a project whose assignment is shared by a team may), so the publish route can hold a
// token whose row another user owns
class TestAdapter extends SocialPlatformAdapter {
  constructor() {
    super({ entitySlug: 'projects', tableName: 'projects_social_platforms', parentIdColumn: 'projectId', permissionCheck: 'team' })
  }
  async checkEntityAccess(userId: string, entityId: string) {
    if (entityId === ENTITY && userId === 'ua') return { hasAccess: true, teamId: 'team-a' }
    if (entityId === ENTITY_B && userId === 'ub') return { hasAccess: true, teamId: 'team-b' }
    return { hasAccess: false, reason: 'Project not found' }
  }
  async getAssignments(entityId: string, userId: string) {
    const rows = await queryWithRLS<{ accessToken: string; tokenExpiresAt: string }>(
      `SELECT "accessToken", "tokenExpiresAt" FROM social_accounts WHERE "platformAccountId" = 'page-1'`, [])
    return rows.map(row => ({
      id: ASSIGNMENT, entityId, platform: 'facebook_page', platformAccountId: 'page-1', username: 'Page One',
      accessToken: row.accessToken, tokenExpiresAt: new Date(row.tokenExpiresAt), isActive: true, accountMetadata: {},
    }))
  }
  async getAssignedPlatformIds() {
    return new Set(['page-1'])
  }
  async getConnectedEntities() {
    return new Map([['page-1', [{ id: ENTITY, name: 'Project One' }]]])
  }
  async saveAssignment(data: unknown, userId: string) {
    console.log(`SAVED ${JSON.stringify({ data, userId })}`)
    return { id: ASSIGNMENT, isNew: true }
  }
  async removeAssignment() {}
  async getAccountById(accountId: string, platform: string) {
    return accountId === ASSIGNMENT
      ? { id: ASSIGNMENT, parentEntityId: ENTITY, platform, platformAccountId: 'page-1', username: 'Page One', isActive: true }
      : null
  }
  async recordPublishedPost(post: unknown, userId: string) {
    console.log(`RECORDED ${JSON.stringify({ post, userId })}`)
  }
}

globalThis.fetch = (async (input: string | URL | Request) => {
  const url = String(input instanceof Request ? input.url : input)
  const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } })
  if (url.includes('/oauth/access_token')) return json({ access_token: 'fresh-token', expires_in: 5184000 })
  if (url.includes('/feed')) return json({ id: 'page-1_post-9' })
  // The Pages of the token: a Page the user has no social_accounts row for
  if (url.includes('/me/accounts')) return json({ data: [{ id: 'page-2', name: 'Page Two', category: 'Brand', access_token: 'graph-page-token', tasks: ['CREATE_CONTENT'] }] })
  return json({ data: [] })
}) as typeof fetch

async function run(step: Step) {
  clearAdapter()
  if (step.adapter) registerSocialPlatformAdapter(new TestAdapter())
  const method = step.route === 'accounts' || step.route === 'callback' ? 'GET' : 'POST'
  const route = step.route === 'callback' ? 'connect/callback' : step.route
  const request = new NextRequest(`http://localhost/api/plugins/social-media-publisher/social/${route}${step.query ?? ''}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${step.key}`, 'x-team-id': step.team ?? 'team-a' },
    body: step.body === undefined ? undefined : JSON.stringify(step.body),
  })
  const response: Response = await routes[step.route][method](request)
  const text = await response.text()
  let body: unknown
  try { body = JSON.parse(text) } catch { body = text }
  return { status: response.status, body }
}

for (const step of JSON.parse(process.env.SOCIAL_ADAPTER_STEPS!) as Step[]) {
  console.log(`RESULT ${JSON.stringify({ route: step.route, ...(await run(step)) })}`)
}
process.exit(0)
