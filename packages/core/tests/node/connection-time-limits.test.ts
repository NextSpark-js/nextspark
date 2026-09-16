/**
 * A connection's time limits hold whatever its connection string says (#193).
 * pg reads the string's parameters over the options passed next to it, so the
 * time-limit parameters are taken out of the string, found the way pg finds
 * them, and everything else in it is left as written.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import pg from 'pg'
import { withoutTimeLimitParameters } from '../../scripts/db/connection-time-limits.mjs'

/** The statement_timeout pg sends for a connection string given next to a limit of 500 ms. */
function statementTimeoutPgReads(connectionString: string) {
  const client = new pg.Client({ connectionString, statement_timeout: 500 }) as pg.Client & {
    connectionParameters: { statement_timeout: unknown }
  }
  return client.connectionParameters.statement_timeout
}

const BASE = 'postgresql://dbuser:p%40ss@db.example.com:5432/nextspark'

test('the time-limit parameters are taken out, and the rest of the URL is kept as written', () => {
  assert.deepEqual(withoutTimeLimitParameters(`${BASE}?sslmode=disable&statement_timeout=0&query_timeout=&application_name=a%20b`), {
    connectionString: `${BASE}?sslmode=disable&application_name=a%20b`,
    ignored: ['statement_timeout', 'query_timeout'],
  })
  assert.deepEqual(withoutTimeLimitParameters(`${BASE}?query_timeout=5000`), { connectionString: `${BASE}?`, ignored: ['query_timeout'] })
})

test('a connection string that is only a query still names the host pg resolves it against', () => {
  const host = (connectionString: string) => (new pg.Client({ connectionString }) as pg.Client & { host: string }).host
  const { connectionString } = withoutTimeLimitParameters('?statement_timeout=0')

  assert.equal(host('?statement_timeout=0'), 'base')
  assert.equal(host(connectionString), 'base')
})

test('a URL without them is returned as it is', () => {
  for (const url of [
    BASE,
    `${BASE}?sslmode=disable`,
    `${BASE}?options=-c%20statement_timeout%3D0`,
    `${BASE}?lock_timeout=0#statement_timeout=0`,
    // a Unix socket with a database, which pg reads no parameters from
    '/var/run/postgresql nextspark?statement_timeout=0',
  ]) {
    assert.deepEqual(withoutTimeLimitParameters(url), { connectionString: url, ignored: [] }, url)
    assert.equal(statementTimeoutPgReads(url), 500, url)
  }
})

test('a parameter pg would read is found however it is written', () => {
  const shapes = {
    'percent-encoded name': `${BASE}?statement%5Ftimeout=0`,
    'written twice': `${BASE}?statement_timeout=0&sslmode=disable&statement_timeout=`,
    'with a tab inside the name': `${BASE}?statement_\ttimeout=0`,
    'before a fragment': `${BASE}?statement_timeout=0#top`,
    'on a socket URL': 'socket:/var/run/postgresql?db=nextspark&statement_timeout=0',
  }
  for (const [shape, url] of Object.entries(shapes)) {
    assert.notEqual(statementTimeoutPgReads(url), 500, shape)
    const { connectionString, ignored } = withoutTimeLimitParameters(url)
    assert.deepEqual(ignored, ['statement_timeout'], shape)
    assert.equal(statementTimeoutPgReads(connectionString), 500, shape)
  }
  assert.equal(withoutTimeLimitParameters(shapes['written twice']).connectionString, `${BASE}?sslmode=disable`)
  assert.equal(withoutTimeLimitParameters(shapes['before a fragment']).connectionString, `${BASE}?#top`)
})
