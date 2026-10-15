/**
 * Shared assertions for the input-validation suites (S192).
 *
 * A request carrying malformed data must be answered with a 4xx and a stable
 * error code, with no stack trace or internal error text in the body, and
 * without the data layer being asked to write.
 */

/** Text that only appears when internals leak into a response body. */
const INTERNAL_LEAKS = [
  /\n\s+at\s+\S+.*\(?.*:\d+:\d+\)?/,           // a stack frame
  /node_modules/,
  /\bTypeError\b|\bReferenceError\b|\bSyntaxError\b|\bRangeError\b/,
  /Cannot read propert|is not iterable|is not a function|is not defined/,
  /Unexpected token|Unexpected end of JSON|in JSON at position/,
  /invalid input syntax for type|violates (?:not-null|foreign key|check|unique)|relation ".*" does not exist/,
  /\bECONNREFUSED\b|\bpg_catalog\b|\bSELECT\b.+\bFROM\b|\bINSERT INTO\b|\bUPDATE\b.+\bSET\b/,
]

export interface ResponseLike {
  status: number
  body?: unknown
  json?: () => Promise<unknown>
}

/** The JSON body of a handler response, whether it is a plain mock or a (mock) NextResponse. */
export async function bodyOf(response: ResponseLike): Promise<Record<string, unknown>> {
  if (response.body !== undefined && typeof response.body !== 'string') return response.body as Record<string, unknown>
  const parsed = response.json ? await response.json() : response.body
  return (typeof parsed === 'string' ? JSON.parse(parsed) : parsed) as Record<string, unknown>
}

/** 4xx, a non-empty stable `code` (or the exact one asked for), and nothing internal in the body. */
export async function expectCleanRejection(
  response: ResponseLike,
  expected: { status?: number; code?: string | RegExp } = {},
): Promise<Record<string, unknown>> {
  const body = await bodyOf(response)
  const text = JSON.stringify(body)

  expect(response.status).toBeGreaterThanOrEqual(400)
  expect(response.status).toBeLessThan(500)
  if (expected.status !== undefined) expect(response.status).toBe(expected.status)

  const code = body.code ?? (body.error as { code?: unknown } | undefined)?.code
  expect(typeof code).toBe('string')
  expect(String(code)).not.toBe('')
  // the text stays in `error` for clients that read it
  expect(typeof body.error === 'string' || typeof (body.error as { message?: unknown } | undefined)?.message === 'string').toBe(true)
  expect(String(typeof body.error === 'string' ? body.error : (body.error as { message: string }).message)).not.toBe('')
  if (typeof expected.code === 'string') expect(code).toBe(expected.code)
  if (expected.code instanceof RegExp) expect(String(code)).toMatch(expected.code)

  expect(body).not.toHaveProperty('stack')
  for (const leak of INTERNAL_LEAKS) expect(text).not.toMatch(leak)
  return body
}

/** Statements that write, from a recorded `(sql, params)` mock; the audit-log row is not a data write. */
export function writesFrom(mock: jest.Mock): Array<[string, unknown[]]> {
  return (mock.mock.calls as Array<[string, unknown[]]>).filter(
    ([sql]) => /\b(INSERT|UPDATE|DELETE)\b/i.test(String(sql)) && !String(sql).includes('"api_audit_log"'),
  )
}

/** A request whose body is read the way the platform reads it: `json()` rejects when the text is not JSON. */
export type BodyKind =
  | { kind: 'missing' }
  | { kind: 'empty' }
  | { kind: 'not-json'; text: string }
  | { kind: 'json'; value: unknown }

/** What `await request.json()` does for each body kind. */
export function jsonReaderFor(body: BodyKind): () => Promise<unknown> {
  switch (body.kind) {
    case 'missing':
    case 'empty':
      return async () => { throw new SyntaxError('Unexpected end of JSON input') }
    case 'not-json':
      return async () => { throw new SyntaxError(`Unexpected token in JSON at position 0`) }
    case 'json':
      return async () => body.value
  }
}

/** Malformed-body classes every JSON-taking endpoint is run against (an object is the only accepted top level). */
export const MALFORMED_BODIES: Array<[string, BodyKind]> = [
  ['a missing body', { kind: 'missing' }],
  ['an empty body', { kind: 'empty' }],
  ['a body that is not JSON', { kind: 'not-json', text: 'name=Rex&status=active' }],
  ['a JSON array in place of an object', { kind: 'json', value: [{ name: 'Rex' }] }],
  ['a JSON null', { kind: 'json', value: null }],
  ['a JSON string', { kind: 'json', value: 'Rex' }],
  ['a JSON number', { kind: 'json', value: 42 }],
  ['a JSON boolean', { kind: 'json', value: true }],
]
