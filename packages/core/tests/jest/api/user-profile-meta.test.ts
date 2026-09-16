/**
 * PATCH /api/user/profile (apps/dev) saves a preference group without erasing
 * the keys it does not carry (#194).
 *
 * The theme toggle sends `{ meta: { uiPreferences: { theme } } }` and the
 * sidebar sends `{ meta: { uiPreferences: { sidebarCollapsed } } }`: each
 * request carries one key of a group that holds both. Writing the group as it
 * arrives drops the other key, so saving the theme reset the sidebar and the
 * sidebar reset the theme.
 *
 * The route runs with the real MetaService; only the database, the rate limiter
 * and the session are mocked. The database mock applies to its stored value
 * what the query it receives asks for, so the assertions are about what the
 * user gets back. It does that by evaluating the expression the upsert assigns
 * to "metaValue" against the stored and the incoming value: CASE, jsonb `||`,
 * jsonb_typeof(), COALESCE(), comparisons, IS [NOT] NULL, AND/OR/NOT and
 * `::jsonb` casts, with Postgres's rules for each. Anything else in that
 * expression makes it throw rather than guess, so an equivalent rewrite lands
 * on the same answer, a different clause lands on its own, and a clause the
 * double cannot read fails the test instead of passing it.
 *
 * apps/dev/app is the source of the app/ a project is generated with
 * (packages/core/templates/app, written at pack time), so this covers the
 * route the template ships.
 */
import { NextRequest } from 'next/server'

const mockMutateWithRLS = jest.fn()
const mockGetSession = jest.fn()

jest.mock('@/core/lib/db', () => ({
  queryOneWithRLS: jest.fn(),
  queryOne: jest.fn(),
  queryWithRLS: jest.fn(),
  mutateWithRLS: (...args: unknown[]) => mockMutateWithRLS(...args),
}))
jest.mock('@/core/lib/api/rate-limit', () => ({
  withRateLimitTier: (handler: unknown) => handler,
}))
jest.mock('@/core/lib/auth', () => ({
  auth: { api: { getSession: (...args: unknown[]) => mockGetSession(...args) } },
}))
jest.mock('next/headers', () => ({
  headers: async () => new Headers(),
}))

import { PATCH } from '@/app/api/user/profile/route'

const USER_ID = 'test-user-123'

/** What `users_metas` holds, keyed by meta key. */
let stored: Record<string, Record<string, unknown>>

/** SQL NULL, which is not jsonb's `null`. */
const SQL_NULL = Symbol('SQL NULL')

type Json = null | boolean | number | string | Json[] | { [key: string]: Json }
/** A value with the type Postgres gives it; a literal's type is `unknown` until context decides. */
type Value = { type: 'jsonb' | 'text' | 'bool' | 'unknown'; value: Json | typeof SQL_NULL }

type Token = { kind: 'word' | 'quoted' | 'string' | 'number' | 'param' | 'op'; text: string }

function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  const pattern = /\s+|--[^\n]*|"((?:[^"]|"")*)"|'((?:[^']|'')*)'|(\d+(?:\.\d+)?)|(\$\d+)|([A-Za-z_][A-Za-z0-9_$]*)|(\|\||::|<>|!=|<=|>=|[=<>(),.;*+\-/\[\]])/y
  let position = 0
  while (position < sql.length) {
    pattern.lastIndex = position
    const match = pattern.exec(sql)
    if (!match) throw new Error(`the database double cannot read the SQL at: ${sql.slice(position, position + 30)}`)
    position = pattern.lastIndex
    const [, quoted, string, number, param, word, op] = match
    if (quoted !== undefined) tokens.push({ kind: 'quoted', text: quoted.replace(/""/g, '"') })
    else if (string !== undefined) tokens.push({ kind: 'string', text: string.replace(/''/g, "'") })
    else if (number !== undefined) tokens.push({ kind: 'number', text: number })
    else if (param !== undefined) tokens.push({ kind: 'param', text: param })
    else if (word !== undefined) tokens.push({ kind: 'word', text: word })
    else if (op !== undefined) tokens.push({ kind: 'op', text: op })
  }
  return tokens
}

type Expression =
  | { node: 'literal'; value: Value }
  | { node: 'column'; table?: string; column: string }
  | { node: 'call'; name: string; args: Expression[] }
  | { node: 'cast'; operand: Expression; to: string }
  | { node: 'concat' | 'and' | 'or'; left: Expression; right: Expression }
  | { node: 'compare'; operator: '=' | '<>'; left: Expression; right: Expression }
  | { node: 'not'; operand: Expression }
  | { node: 'isNull'; operand: Expression; negated: boolean }
  | { node: 'case'; operand?: Expression; branches: [Expression, Expression][]; otherwise?: Expression }

const RESERVED = new Set(['case', 'when', 'then', 'else', 'end', 'and', 'or', 'not', 'is', 'null', 'true', 'false', 'where', 'returning'])

/** Reads SQL expressions from a token list, the way Postgres groups them: OR, AND, NOT, comparison, ||, ::. */
class ExpressionReader {
  constructor(private tokens: Token[], public position = 0) {}

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.position + offset]
  }

  /** An unquoted word folds to lower case in Postgres; a quoted one keeps its case. */
  private name(token: Token | undefined): string | undefined {
    if (!token) return undefined
    if (token.kind === 'quoted') return token.text
    return token.kind === 'word' ? token.text.toLowerCase() : undefined
  }

  isKeyword(word: string, offset = 0): boolean {
    const token = this.peek(offset)
    return token?.kind === 'word' && token.text.toLowerCase() === word
  }

  isOp(op: string, offset = 0): boolean {
    const token = this.peek(offset)
    return token?.kind === 'op' && token.text === op
  }

  expectKeyword(word: string) {
    if (!this.isKeyword(word)) throw new Error(`the database double expected ${word.toUpperCase()} at ${this.peek()?.text ?? 'the end'}`)
    this.position++
  }

  expectOp(op: string) {
    if (!this.isOp(op)) throw new Error(`the database double expected "${op}" at ${this.peek()?.text ?? 'the end'}`)
    this.position++
  }

  identifier(): string {
    const token = this.peek()
    const name = this.name(token)
    if (!name || (token!.kind === 'word' && RESERVED.has(name))) {
      throw new Error(`the database double expected a name at ${token?.text ?? 'the end'}`)
    }
    this.position++
    return name
  }

  expression(): Expression {
    let left = this.and()
    while (this.isKeyword('or')) {
      this.position++
      left = { node: 'or', left, right: this.and() }
    }
    return left
  }

  private and(): Expression {
    let left = this.not()
    while (this.isKeyword('and')) {
      this.position++
      left = { node: 'and', left, right: this.not() }
    }
    return left
  }

  private not(): Expression {
    if (this.isKeyword('not')) {
      this.position++
      return { node: 'not', operand: this.not() }
    }
    return this.comparison()
  }

  private comparison(): Expression {
    const left = this.concat()
    if (this.isKeyword('is')) {
      this.position++
      const negated = this.isKeyword('not')
      if (negated) this.position++
      this.expectKeyword('null')
      return { node: 'isNull', operand: left, negated }
    }
    for (const operator of ['=', '<>', '!='] as const) {
      if (this.isOp(operator)) {
        this.position++
        return { node: 'compare', operator: operator === '=' ? '=' : '<>', left, right: this.concat() }
      }
    }
    return left
  }

  private concat(): Expression {
    let left = this.cast()
    while (this.isOp('||')) {
      this.position++
      left = { node: 'concat', left, right: this.cast() }
    }
    return left
  }

  private cast(): Expression {
    let operand = this.primary()
    while (this.isOp('::')) {
      this.position++
      operand = { node: 'cast', operand, to: this.identifier() }
    }
    return operand
  }

  private primary(): Expression {
    const token = this.peek()
    if (!token) throw new Error('the database double reached the end of the SQL inside an expression')

    if (this.isOp('(')) {
      this.position++
      const inner = this.expression()
      this.expectOp(')')
      return inner
    }
    if (token.kind === 'string') {
      this.position++
      return { node: 'literal', value: { type: 'unknown', value: token.text } }
    }
    if (this.isKeyword('null')) {
      this.position++
      return { node: 'literal', value: { type: 'unknown', value: SQL_NULL } }
    }
    if (this.isKeyword('true') || this.isKeyword('false')) {
      this.position++
      return { node: 'literal', value: { type: 'bool', value: token.text.toLowerCase() === 'true' } }
    }
    if (this.isKeyword('case')) return this.caseExpression()

    const first = this.identifier()
    if (this.isOp('(')) {
      this.position++
      const args: Expression[] = []
      if (!this.isOp(')')) {
        do {
          if (args.length > 0) this.position++
          args.push(this.expression())
        } while (this.isOp(','))
      }
      this.expectOp(')')
      return { node: 'call', name: first, args }
    }
    if (this.isOp('.')) {
      this.position++
      return { node: 'column', table: first, column: this.identifier() }
    }
    return { node: 'column', column: first }
  }

  private caseExpression(): Expression {
    this.expectKeyword('case')
    const operand = this.isKeyword('when') ? undefined : this.expression()
    const branches: [Expression, Expression][] = []
    while (this.isKeyword('when')) {
      this.position++
      const condition = this.expression()
      this.expectKeyword('then')
      branches.push([condition, this.expression()])
    }
    if (branches.length === 0) throw new Error('the database double read a CASE with no WHEN')
    let otherwise: Expression | undefined
    if (this.isKeyword('else')) {
      this.position++
      otherwise = this.expression()
    }
    this.expectKeyword('end')
    return { node: 'case', operand, branches, otherwise }
  }
}

const TABLE = 'users_metas'
const COLUMN = 'metaValue'

/** A value read as jsonb: a jsonb stays, an untyped literal is parsed the way `::jsonb` would. */
function asJsonb(value: Value): Value {
  if (value.type === 'jsonb' || value.value === SQL_NULL) return { type: 'jsonb', value: value.value }
  if (value.type === 'unknown' || value.type === 'text') return { type: 'jsonb', value: JSON.parse(value.value as string) }
  throw new Error(`the database double cannot read a ${value.type} as jsonb`)
}

function asBool(value: Value): boolean | typeof SQL_NULL {
  if (value.value === SQL_NULL) return SQL_NULL
  if (value.type !== 'bool') throw new Error(`the database double expected a boolean, not a ${value.type}`)
  return value.value as boolean
}

function evaluate(expression: Expression, row: { stored: Json; incoming: Json }): Value {
  switch (expression.node) {
    case 'literal':
      return expression.value
    case 'column': {
      if (expression.column !== COLUMN) throw new Error(`the database double does not know the column ${expression.column}`)
      // Unqualified, a column in ON CONFLICT DO UPDATE is the row already stored
      if (expression.table === undefined || expression.table === TABLE) return { type: 'jsonb', value: row.stored }
      if (expression.table === 'excluded') return { type: 'jsonb', value: row.incoming }
      throw new Error(`the database double does not know the table ${expression.table}`)
    }
    case 'cast': {
      const operand = evaluate(expression.operand, row)
      if (expression.to === 'jsonb') return asJsonb(operand)
      throw new Error(`the database double does not understand a cast to ${expression.to}`)
    }
    case 'call': {
      const args = expression.args.map(arg => evaluate(arg, row))
      if (expression.name === 'jsonb_typeof' && args.length === 1) {
        const [value] = args.map(asJsonb)
        if (value.value === SQL_NULL) return { type: 'text', value: SQL_NULL }
        const json = value.value
        const type = json === null ? 'null' : Array.isArray(json) ? 'array' : typeof json === 'object' ? 'object' : typeof json
        return { type: 'text', value: type }
      }
      if (expression.name === 'coalesce' && args.length > 0) {
        const typed = args.some(arg => arg.type === 'jsonb') ? args.map(asJsonb) : args
        return typed.find(arg => arg.value !== SQL_NULL) ?? typed[typed.length - 1]
      }
      throw new Error(`the database double does not understand ${expression.name}()`)
    }
    case 'concat': {
      const [left, right] = [evaluate(expression.left, row), evaluate(expression.right, row)].map(asJsonb)
      if (left.value === SQL_NULL || right.value === SQL_NULL) return { type: 'jsonb', value: SQL_NULL }
      const [l, r] = [left.value, right.value]
      const isObject = (json: Json) => json !== null && typeof json === 'object' && !Array.isArray(json)
      // Two objects merge with the right-hand keys winning; anything else concatenates as arrays
      if (isObject(l) && isObject(r)) return { type: 'jsonb', value: { ...(l as object), ...(r as object) } as Json }
      const toArray = (json: Json) => (Array.isArray(json) ? json : [json])
      return { type: 'jsonb', value: [...toArray(l), ...toArray(r)] }
    }
    case 'compare': {
      const left = evaluate(expression.left, row)
      const right = evaluate(expression.right, row)
      if (left.value === SQL_NULL || right.value === SQL_NULL) return { type: 'bool', value: SQL_NULL }
      const asJson = left.type === 'jsonb' || right.type === 'jsonb'
      const equal = asJson
        ? JSON.stringify(asJsonb(left).value) === JSON.stringify(asJsonb(right).value)
        : left.value === right.value
      return { type: 'bool', value: expression.operator === '=' ? equal : !equal }
    }
    case 'isNull': {
      const isNull = evaluate(expression.operand, row).value === SQL_NULL
      return { type: 'bool', value: expression.negated ? !isNull : isNull }
    }
    case 'not': {
      const operand = asBool(evaluate(expression.operand, row))
      return { type: 'bool', value: operand === SQL_NULL ? SQL_NULL : !operand }
    }
    case 'and':
    case 'or': {
      const left = asBool(evaluate(expression.left, row))
      const right = asBool(evaluate(expression.right, row))
      const decisive = expression.node === 'and' ? false : true
      if (left === decisive || right === decisive) return { type: 'bool', value: decisive }
      if (left === SQL_NULL || right === SQL_NULL) return { type: 'bool', value: SQL_NULL }
      return { type: 'bool', value: !decisive }
    }
    case 'case': {
      const operand = expression.operand && evaluate(expression.operand, row)
      for (const [when, then] of expression.branches) {
        const matched = operand
          ? asBool(evaluate({ node: 'compare', operator: '=', left: { node: 'literal', value: operand }, right: when }, row))
          : asBool(evaluate(when, row))
        if (matched === true) return evaluate(then, row)
      }
      return expression.otherwise ? evaluate(expression.otherwise, row) : { type: 'unknown', value: SQL_NULL }
    }
  }
}

/**
 * What the upsert's ON CONFLICT clause leaves in "metaValue" when a row is
 * already stored: the clause's assignment evaluated against both values, the
 * stored value untouched when the clause does not assign the column, or a
 * thrown error when the clause says something the double cannot evaluate.
 */
function valueAfterConflict(query: string, row: { stored: Json; incoming: Json }): Json {
  const tokens = tokenize(query)
  const start = tokens.findIndex(
    (token, index) =>
      token.kind === 'word' && token.text.toLowerCase() === 'do' &&
      tokens[index + 1]?.text.toLowerCase() === 'update' && tokens[index + 2]?.text.toLowerCase() === 'set'
  )
  if (start === -1) throw new Error('the database double found no ON CONFLICT DO UPDATE SET in the upsert')

  const reader = new ExpressionReader(tokens, start + 3)
  let assigned: Expression | undefined
  let first = true
  do {
    if (!first) reader.expectOp(',')
    first = false
    const column = reader.identifier()
    reader.expectOp('=')
    const expression = reader.expression()
    if (column === COLUMN) assigned = expression
  } while (reader.isOp(','))
  if (reader.position < tokens.length && !reader.isKeyword('where') && !reader.isKeyword('returning') && !reader.isOp(';')) {
    throw new Error(`the database double cannot read the SQL after the assignments, at ${tokens[reader.position].text}`)
  }

  if (!assigned) return row.stored
  const result = asJsonb(evaluate(assigned, row))
  return result.value === SQL_NULL ? null : (result.value as Json)
}

/**
 * The write as Postgres runs it: the meta upsert does to the stored value what
 * its ON CONFLICT clause says, and the profile UPDATE answers with the row.
 */
function applyWrite(query: string, params: unknown[]) {
  if (/UPDATE "users"/.test(query)) return { rows: [{ id: USER_ID }], rowCount: 1 }

  const [, metaKey, jsonString] = params as [string, string, string]
  const incoming = JSON.parse(jsonString) as Record<string, unknown>
  const current = stored[metaKey]

  stored[metaKey] = current
    ? (valueAfterConflict(query, { stored: current as Json, incoming: incoming as Json }) as Record<string, unknown>)
    : incoming

  return { rows: [], rowCount: 1 }
}

function patchProfile(body: unknown) {
  return PATCH(new NextRequest('http://localhost:3000/api/user/profile', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }))
}

beforeEach(() => {
  stored = { uiPreferences: { theme: 'light', sidebarCollapsed: true } }
  mockMutateWithRLS.mockReset().mockImplementation((query: string, params: unknown[]) => applyWrite(query, params))
  mockGetSession.mockReset().mockResolvedValue({ user: { id: USER_ID } })
})

describe('PATCH /api/user/profile — preference groups', () => {
  test('saving the theme keeps the sidebar state', async () => {
    const response = await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test('saving the sidebar state keeps the theme', async () => {
    const response = await patchProfile({ meta: { uiPreferences: { sidebarCollapsed: false } } })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'light', sidebarCollapsed: false })
  })

  test('a profile update that also carries meta keeps the rest of the group', async () => {
    const response = await patchProfile({
      firstName: 'Ada',
      lastName: 'Lovelace',
      country: 'AR',
      timezone: 'America/Argentina/Buenos_Aires',
      language: 'en',
      meta: { uiPreferences: { theme: 'dark' } },
    })

    expect(response.status).toBe(200)
    expect(stored.uiPreferences).toEqual({ theme: 'dark', sidebarCollapsed: true })
    // The profile UPDATE and the meta write, in that order
    expect(mockMutateWithRLS.mock.calls[0][0]).toMatch(/UPDATE "users"/)
    expect(mockMutateWithRLS.mock.calls).toHaveLength(2)
  })

  test('writes the group for the signed-in user under their own RLS context', async () => {
    await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    const [, params, rlsUserId] = mockMutateWithRLS.mock.calls[0]
    expect(params[0]).toBe(USER_ID)
    expect(params[1]).toBe('uiPreferences')
    expect(rlsUserId).toBe(USER_ID)
  })

  test('leaves the groups the request does not carry alone', async () => {
    stored.notificationsPreferences = { pushEnabled: true }

    await patchProfile({ meta: { uiPreferences: { theme: 'dark' } } })

    expect(stored.notificationsPreferences).toEqual({ pushEnabled: true })
  })
})

/**
 * The double above stands in for Postgres, so it has to answer the way Postgres
 * would: by what the clause does, not by how it is spelled. Rewriting the same
 * merge — different whitespace, the operands the other way round, the table
 * name written without its quotes — must not turn a merge into a replace, or
 * the tests above would go green on a route that had stopped merging.
 */
describe('the database double reads the conflict clause, not its wording', () => {
  const MERGE = `
    INSERT INTO "users_metas" ("userId", "metaKey", "metaValue")
    VALUES ($1, $2, $3)
    ON CONFLICT ("userId", "metaKey")
    DO UPDATE SET
      "metaValue" = CASE
        WHEN jsonb_typeof("users_metas"."metaValue") = 'object' AND jsonb_typeof(EXCLUDED."metaValue") = 'object'
        THEN "users_metas"."metaValue" || EXCLUDED."metaValue"
        ELSE EXCLUDED."metaValue"
      END,
      "updatedAt" = CURRENT_TIMESTAMP
  `

  const write = (query: string) => {
    stored = { uiPreferences: { theme: 'light', sidebarCollapsed: true } }
    applyWrite(query, [USER_ID, 'uiPreferences', JSON.stringify({ theme: 'dark' })])
    return stored.uiPreferences
  }

  test('the merge the route writes keeps the key the request does not carry', () => {
    expect(write(MERGE)).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test.each([
    ['broken across lines', MERGE.replace(/\|\|/g, '\n          ||')],
    ['squeezed onto one line', MERGE.replace(/\s+/g, ' ')],
    ['the table name unquoted', MERGE.replace(/"users_metas"\./g, 'users_metas.')],
  ])('a merge %s still merges', (_label, query) => {
    expect(write(query)).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test('with the stored value winning, the key the request carries does not', () => {
    const storedWins = MERGE.replace(
      'THEN "users_metas"."metaValue" || EXCLUDED."metaValue"',
      'THEN EXCLUDED."metaValue" || "users_metas"."metaValue"'
    )

    expect(write(storedWins)).toEqual({ theme: 'light', sidebarCollapsed: true })
  })

  test('a clause that only writes the incoming value replaces the group', () => {
    const replace = MERGE.replace(/"metaValue" = CASE[\s\S]*?END,/, '"metaValue" = EXCLUDED."metaValue",')

    expect(write(replace)).toEqual({ theme: 'dark' })
  })

  test('a clause that reads the stored column but still writes the incoming value replaces the group', () => {
    // Mentions the stored column and has no `||`: what it does is a replace
    const caseReplace = MERGE.replace(
      /"metaValue" = CASE[\s\S]*?END,/,
      '"metaValue" = CASE WHEN "users_metas"."metaValue" IS NULL THEN EXCLUDED."metaValue" ELSE EXCLUDED."metaValue" END,'
    )

    expect(write(caseReplace)).toEqual({ theme: 'dark' })
  })

  test('a merge guarded by a condition the stored value does not meet replaces the group', () => {
    const arraysOnly = MERGE.replace("= 'object' AND", "= 'array' AND")

    expect(write(arraysOnly)).toEqual({ theme: 'dark' })
  })

  test.each([
    ['with COALESCE around the stored value', '"metaValue" = COALESCE("users_metas"."metaValue", \'{}\'::jsonb) || EXCLUDED."metaValue",'],
    ['with the stored column unqualified', '"metaValue" = "metaValue" || EXCLUDED."metaValue",'],
  ])('a merge written %s still merges', (_label, assignment) => {
    expect(write(MERGE.replace(/"metaValue" = CASE[\s\S]*?END,/, assignment))).toEqual({ theme: 'dark', sidebarCollapsed: true })
  })

  test('a clause the double cannot evaluate fails the test instead of passing it', () => {
    const jsonbSet = MERGE.replace(
      /"metaValue" = CASE[\s\S]*?END,/,
      '"metaValue" = jsonb_set("users_metas"."metaValue", \'{theme}\', EXCLUDED."metaValue"),'
    )

    expect(() => write(jsonbSet)).toThrow(/the database double does not understand jsonb_set\(\)/)
  })
})
