/**
 * A time-limited client acts on the connection string the way the installed pg
 * does (#193), including a version of pg whose client reads options these
 * scripts know nothing about. Such an option is read from what the client is
 * constructed with, never from the string, so a parameter of the same name in
 * the string reaches a time-limited client no more than it reaches one pg builds
 * for the string by itself.
 *
 * pg's Client is replaced before the scripts are loaded, since they take it from
 * pg when they load; each test file runs in a process of its own.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'

/** A client that reads one option more from what it is constructed with, as later versions of pg read scramMaxIterations. */
class NewerClient extends pg.Client {
  optionOnlyThisVersionReads: unknown

  constructor(config?: string | pg.ClientConfig) {
    super(config)
    this.optionOnlyThisVersionReads =
      typeof config === 'object' ? (config as Record<string, unknown>).optionOnlyThisVersionReads ?? 'default' : 'default'
  }
}

;(pg as { Client: typeof pg.Client }).Client = NewerClient

const { timeLimitedClient } = await import('../../scripts/db/connection-time-limits.mjs')

type Built = NewerClient & { connectionParameters: Record<string, unknown> }

test('an option a newer pg reads only from its constructor is not taken from the connection string', () => {
  // Explicit mode keeps this focused on options a newer pg reads. A missing
  // sslmode deliberately returns the scripts' SSL-prefer facade instead.
  const url = 'postgres://u:p@db.example.com/db?sslmode=disable&optionOnlyThisVersionReads=1&statement_timeout=0'
  const reference = new pg.Client({ connectionString: url }) as Built
  const limited = timeLimitedClient(url, { connectMs: 1000, statementMs: 500, queryMs: 700 }) as Built

  assert.ok(reference instanceof NewerClient)
  assert.ok(limited instanceof NewerClient)
  assert.equal(reference.optionOnlyThisVersionReads, 'default')
  assert.equal(limited.optionOnlyThisVersionReads, 'default')
  assert.equal(limited.connectionParameters.statement_timeout, 500)
  assert.equal(limited.connectionParameters.query_timeout, 700)
})
