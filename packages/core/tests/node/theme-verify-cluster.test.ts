/**
 * `db:verify-theme` runs migrations that reach past the database it is given:
 * they create and alter cluster-wide roles, which every database on the same
 * Postgres server shares. An empty database is therefore not enough of a check
 * — a fresh database on a server in use still gets `nextspark_app` altered
 * under the other databases' feet — so the command inspects the cluster,
 * names what it will change there, and refuses a server that is in use unless
 * the person running it says otherwise.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { GLOBAL_OBJECTS, ROLES_SQL, MAINTENANCE_DATABASE, inspectCluster } from '../../scripts/db/cluster-changes.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const FRESH_CLUSTER = { roles: [], databases: [{ name: 'postgres' }] }

test('a cluster with none of the roles and no other database is disposable', () => {
  const cluster = inspectCluster(FRESH_CLUSTER)

  assert.equal(cluster.disposable, true)
  assert.deepEqual(cluster.reasons, [])
})

test('a role the migrations would alter, already there, is reported with its memberships', () => {
  const cluster = inspectCluster({
    roles: [{ name: 'nextspark_app', can_login: false, member_of: ['authenticated'] }],
    databases: [{ name: 'postgres' }],
  })

  assert.equal(cluster.disposable, false)
  assert.match(cluster.reasons[0], /alters roles that are already here: nextspark_app \(member of authenticated\)/)
})

test('the roles 001 only fills in are reported as what they are, not as altered', () => {
  const cluster = inspectCluster({
    roles: [
      { name: 'anon', can_login: false, member_of: [] },
      { name: 'authenticated', can_login: false, member_of: [] },
      { name: 'service_role', can_login: false, member_of: [] },
    ],
    databases: [{ name: 'postgres' }],
  })

  assert.equal(cluster.disposable, false)
  assert.equal(cluster.reasons.length, 1)
  assert.match(cluster.reasons[0], /already exist, so something else set this server up: anon, authenticated, service_role/)
  assert.doesNotMatch(cluster.reasons[0], /alters/)
})

test('a maintenance database with a schema of its own is a server in use', () => {
  const cluster = inspectCluster({
    roles: [],
    databases: [{ name: 'postgres' }],
    maintenanceObjects: [{ kind: 'relation', name: 'public.users' }, { kind: 'relation', name: 'public.orders' }],
  })

  assert.equal(cluster.disposable, false)
  assert.match(cluster.reasons[0], new RegExp(`the ${MAINTENANCE_DATABASE} database holds objects of its own, for example public.users`))
})

test('a login role from a runtime cutover is reported too', () => {
  const cluster = inspectCluster({
    roles: [{ name: 'nextspark_runtime', can_login: true, member_of: ['nextspark_app'] }],
    databases: [{ name: 'postgres' }],
  })

  assert.equal(cluster.disposable, false)
  assert.match(cluster.reasons[0], /nextspark_runtime/)
})

test('memberships arrive as a list whether the driver maps the array or not', () => {
  const cluster = inspectCluster({
    roles: [{ name: 'nextspark_app', can_login: false, member_of: '{authenticated,nextspark_runtime}' }],
    databases: [],
  })

  assert.match(cluster.reasons[0], /nextspark_app \(member of authenticated, nextspark_runtime\)/)
})

test('the roles query asks for every role a runtime cutover may have created', () => {
  assert.match(ROLES_SQL, /nextspark\\_%/)
  assert.match(ROLES_SQL, /'\{\}'::text\[\]/)
  for (const role of ['authenticated', 'anon', 'service_role']) {
    assert.ok(ROLES_SQL.includes(`'${role}'`), `${role} is not looked up`)
  }
})

test('another database on the server is enough, with no role there yet', () => {
  const cluster = inspectCluster({ roles: [], databases: [{ name: 'nextspark_dev' }, { name: 'postgres' }] })

  assert.equal(cluster.disposable, false)
  assert.equal(cluster.reasons.length, 1)
  assert.match(cluster.reasons[0], /nextspark_dev/)
})

test('the databases a server always has, with nothing in them, say nothing about it being in use', () => {
  const cluster = inspectCluster({ roles: [], databases: [{ name: 'postgres' }, { name: 'rdsadmin' }] })

  assert.equal(cluster.disposable, true)
})

test('long lists of databases are cut short, and say how many are left', () => {
  const databases = Array.from({ length: 9 }, (_, index) => ({ name: `nextspark_190_${index}` }))

  const cluster = inspectCluster({ roles: [], databases })

  assert.match(cluster.reasons[0], /and 4 more/)
  assert.equal(cluster.otherDatabases.length, 9)
})

/** SQL with its comments taken out, so prose about roles is not read as a statement. */
function withoutComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--[^\n]*/g, ' ')
}

test('every role the core migrations create or alter is named in the output', () => {
  const dir = path.join(CORE, 'migrations')
  const named = new Set<string>()
  for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.sql'))) {
    const sql = withoutComments(fs.readFileSync(path.join(dir, file), 'utf8'))
    const patterns = [
      /CREATE\s+(?:ROLE|USER|GROUP)\s+"?(\w+)"?/gi,
      /ALTER\s+(?:ROLE|USER|GROUP)\s+"?(\w+)"?/gi,
      /(?:GRANT|REVOKE)\s+"?(\w+)"?\s+(?:TO|FROM)\s+/gi,
      /(?:GRANT|REVOKE)\s+[^;]*?\s(?:TO|FROM)\s+"?(nextspark_\w+|authenticated|anon|service_role)"?/gi,
      /DROP\s+(?:ROLE|USER|GROUP)\s+(?:IF\s+EXISTS\s+)?"?(\w+)"?/gi,
    ]
    for (const pattern of patterns) {
      for (const match of sql.matchAll(pattern)) named.add(match[1])
    }
  }

  const announced = new Set(GLOBAL_OBJECTS.map(object => object.role))
  // `current_user` is whoever runs the migrations, not a role they create
  const created = [...named].filter(role => role !== 'current_user')
  assert.deepEqual(created.sort().filter(role => !announced.has(role)), [])
  assert.ok(named.size > 0, 'no role statement was found in the migrations')
})
