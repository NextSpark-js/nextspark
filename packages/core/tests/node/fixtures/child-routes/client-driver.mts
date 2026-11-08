/**
 * Runs the runtime of the generated entity clients (createEntityChildClient / createEntityClient) against core's real route
 * modules over real HTTP: a server on an ephemeral port hands each request to the route handlers (real authentication, team
 * context, permissions and database access), and the client reaches it with the real `fetch`. The server adds the API key and the
 * team header that the browser's session and localStorage would carry. Prints one `RESULT <json>` line per step. Started by
 * client-child-routes.test.ts.
 */
import http from 'node:http'
import { NextRequest } from 'next/server'

const CORE_SRC = new URL('../../../../src/', import.meta.url)
const listRoute = await import(new URL('routes/api/v1/[entity]/[id]/child/[childType]/route.ts', CORE_SRC).href)
const itemRoute = await import(new URL('routes/api/v1/[entity]/[id]/child/[childType]/[childId]/route.ts', CORE_SRC).href)
const detailRoute = await import(new URL('routes/api/v1/[entity]/[id]/route.ts', CORE_SRC).href)

const { CLIENT_KEY, CLIENT_TEAM } = process.env as Record<string, string>

const server = http.createServer(async (req, res) => {
  const chunks: Buffer[] = []
  for await (const chunk of req) chunks.push(chunk as Buffer)
  const body = Buffer.concat(chunks)
  // /api/v1/<entity>/<id>[/child/<childType>[/<childId>]]
  const [, , , entity, id, , childType, childId] = (req.url ?? '').split('?')[0].split('/')
  const method = req.method ?? 'GET'
  const route = childType ? (childId ? itemRoute : listRoute) : detailRoute
  const request = new NextRequest(`http://localhost${req.url}`, {
    method,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${CLIENT_KEY}`, 'x-team-id': CLIENT_TEAM },
    body: body.length > 0 ? body : undefined,
  })
  const response: Response = await route[method](request, { params: Promise.resolve({ entity, id, childType, childId }) })
  res.writeHead(response.status, { 'content-type': 'application/json' })
  res.end(await response.text())
})
await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
process.env.NEXT_PUBLIC_APP_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}`

// The client is the browser's: its URLs are relative to the page. The driver plays the page by giving them the origin of its server
const realFetch = globalThis.fetch
globalThis.fetch = ((input: Parameters<typeof fetch>[0], init?: RequestInit) =>
  realFetch(typeof input === 'string' && input.startsWith('/') ? `${process.env.NEXT_PUBLIC_APP_URL}${input}` : input, init)) as typeof fetch

const { createEntityChildClient } = await import(new URL('lib/api/entity-client.ts', CORE_SRC).href)
const notes = createEntityChildClient('customers', 'notes')

const report = async (step: string, run: () => Promise<unknown>) => {
  try {
    console.log(`RESULT ${JSON.stringify({ step, value: await run() })}`)
  } catch (error) {
    console.log(`RESULT ${JSON.stringify({ step, error: (error as Error).message })}`)
  }
}

await report('list', () => notes.list('cust-a'))
let created: { id?: string } = {}
await report('create', async () => (created = await notes.create('cust-a', { body: 'from the client', stars: 4 })))
await report('update', () => notes.update('cust-a', created.id!, { body: 'changed' }))
await report('delete', () => notes.delete('cust-a', created.id!))
await report('delete-again', () => notes.delete('cust-a', created.id!))
await report('other-team', () => notes.list('cust-b'))
// entityApi (the transport of createEntityClient) is the browser's: its relative URLs need a window. What its delete returns is the
// `data` of this answer, which is what EntityDeleteResult declares
await report('delete-parent', async () => (await (await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/v1/customers/cust-a`, { method: 'DELETE' })).json()))
process.exit(0)
