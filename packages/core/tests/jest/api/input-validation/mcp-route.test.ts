/**
 * S192 — input validation of POST /api/mcp (stateless JSON-RPC). Protocol errors are JSON-RPC error objects
 * (stable numeric `error.code`); an unreadable body is an HTTP 400. Nothing malformed may be answered 5xx, and no
 * tool runs for it.
 */

import { routeHarness, makeReq, MEMBER } from './__helpers__/route-harness'
import type { BodyKind } from './__helpers__/clean-rejection'

jest.mock('@/core/lib/entities/queries', () => ({ setEntityRegistry: jest.fn(), getChildEntities: jest.fn(), getEntity: jest.fn() }))
jest.mock('@nextsparkjs/registries/entity-registry', () => ({ ENTITY_REGISTRY: {}, ENTITY_METADATA: {} }), { virtual: true })
jest.mock('@nextsparkjs/registries/mcp-registry', () => ({ MCP_OVERRIDES: {} }), { virtual: true })
jest.mock('@nextsparkjs/registries/api-presets-registry', () => ({ API_PRESETS_REGISTRY: { endpoints: {} } }), { virtual: true })
jest.mock('@/core/lib/mcp/audit', () => ({ auditToolCall: jest.fn() }))
jest.mock('@/core/lib/mcp/executor', () => ({ executeEntityOperation: jest.fn() }))

import { POST } from '@/app/api/mcp/route'
import { executeEntityOperation } from '@/core/lib/mcp/executor'
import { bodyOf } from './__helpers__/clean-rejection'

const { mocks } = routeHarness

/** The route's answer, or 'hang' when it has not answered after `ms` (a malformed envelope is never answered otherwise). */
async function post(body: BodyKind, ms = 1500, headers: Record<string, string> = {}) {
  const request = makeReq('POST', '/api/mcp', body, headers)
  return Promise.race([POST(request as never), new Promise<'hang'>(resolve => setTimeout(() => resolve('hang'), ms))])
}
const raw = (text: string): BodyKind => ({ kind: 'json', value: JSON.parse(text) })

beforeEach(() => {
  routeHarness.reset()
  process.env.MCP_ENABLED = 'true'
  mocks.authenticateRequest.mockResolvedValue({ success: true, type: 'api-key', user: MEMBER, scopes: ['*'], keyId: 'key-1' })
  const { validateApiKey } = jest.requireMock('@/core/lib/api/auth') as { validateApiKey: jest.Mock }
  validateApiKey.mockResolvedValue({ keyId: 'key-1' })
})

afterAll(() => { delete process.env.MCP_ENABLED })

describe('POST /api/mcp — bodies', () => {
  test.each([
    ['a missing body', { kind: 'missing' } as BodyKind],
    ['an empty body', { kind: 'empty' } as BodyKind],
    ['a body that is not JSON', { kind: 'not-json', text: 'method=tools/list' } as BodyKind],
  ])('%s is answered 400 with the JSON-RPC parse error -32700', async (_label, body) => {
    const response = await post(body)
    if (response === 'hang') throw new Error('no answer')
    expect(response.status).toBe(400)
    expect(((await bodyOf(response)) as { error: { code: number } }).error.code).toBe(-32700)
    expect(executeEntityOperation).not.toHaveBeenCalled()
  })

  const WELL_FORMED_REFUSALS: Array<[string, string]> = [
    ['an empty object', '{}'],
    ['an object with no method', '{"jsonrpc":"2.0","id":1}'],
    ['a method that does not exist', '{"jsonrpc":"2.0","id":1,"method":"nothing/here"}'],
    ['a tool call with no name', '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{}}'],
    ['a tool call for a tool that does not exist', '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"nothing_here","arguments":{}}}'],
    ['a tool call with arguments given text', '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"x","arguments":"y"}}'],
    ['an empty batch', '[]'],
  ]

  test.each(WELL_FORMED_REFUSALS)('%s is answered without a server error and runs no tool', async (_label, text) => {
    const response = await post(raw(text))
    if (response === 'hang') throw new Error('no answer')
    expect(response.status).toBeLessThan(500)
    const body = JSON.stringify(response.status === 202 ? {} : await bodyOf(response))
    expect(body).not.toMatch(/\n\s+at\s+\S+.*:\d+:\d+|node_modules|TypeError|ReferenceError/)
    expect(executeEntityOperation).not.toHaveBeenCalled()
  })

  test.each([
    ['a JSON null', 'null'],
    ['a JSON string', '"tools/list"'],
    ['a JSON number', '42'],
    ['a JSON boolean', 'true'],
    ['a batch of numbers', '[1,2,3]'],
    ['a method given a number', '{"jsonrpc":"2.0","id":1,"method":5}'],
    ['params given text', '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":"x"}'],
  ])('%s is answered with a JSON-RPC error, promptly and without a server error', async (_label, text) => {
    const response = await post(raw(text))
    if (response === 'hang') throw new Error('no answer within 1.5 s')
    expect(response.status).toBeLessThan(500)
    const body = (await bodyOf(response)) as { error?: { code: number } } | Array<{ error?: { code: number } }>
    expect((Array.isArray(body) ? body[0] : body).error?.code).toBe(-32600)
    expect(executeEntityOperation).not.toHaveBeenCalled()
  })

  test('an over-long method name is answered without a server error', async () => {
    const response = await post(raw(JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'm'.repeat(1_000_000) })))
    if (response === 'hang') throw new Error('no answer')
    expect(response.status).toBeLessThan(500)
  })

  test('a request without an API key is answered 401 with the JSON-RPC code -32001', async () => {
    mocks.authenticateRequest.mockResolvedValue({ success: false, type: 'none' })
    const response = await post(raw('{}'))
    if (response === 'hang') throw new Error('no answer')
    expect(response.status).toBe(401)
    expect(((await bodyOf(response)) as { error: { code: number } }).error.code).toBe(-32001)
  })

  test('a browser origin that is not allowed is answered 403 before the body is read', async () => {
    const response = await post(raw('{}'), 1500, { origin: 'https://elsewhere.example' })
    if (response === 'hang') throw new Error('no answer')
    expect(response.status).toBe(403)
  })
})
