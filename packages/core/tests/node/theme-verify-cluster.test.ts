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
import { GLOBAL_OBJECTS, ROLES_SQL, DATABASES_SQL, MAINTENANCE_DATABASE, inspectCluster, rolesNamedIn } from '../../scripts/db/cluster-changes.mjs'

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
    maintenance: { objects: [{ kind: 'relation', name: 'public.users' }, { kind: 'relation', name: 'public.orders' }] },
  })

  assert.equal(cluster.disposable, false)
  assert.match(cluster.reasons[0], new RegExp(`the ${MAINTENANCE_DATABASE} database holds objects of its own, for example public.users`))
})

test('a maintenance database that will not answer is refused, not read as empty', () => {
  const cluster = inspectCluster({
    roles: [],
    databases: [{ name: 'postgres' }],
    maintenance: { unreachable: true, reason: 'permission denied for database "postgres"' },
  })

  assert.equal(cluster.disposable, false)
  assert.match(cluster.reasons[0], new RegExp(`the ${MAINTENANCE_DATABASE} database could not be read`))
  assert.match(cluster.reasons[0], /permission denied for database "postgres"/)
})

test('a maintenance database that answers with nothing leaves the server disposable', () => {
  const cluster = inspectCluster({ roles: [], databases: [{ name: 'postgres' }], maintenance: { objects: [] } })

  assert.equal(cluster.disposable, true)
})

test('the databases query counts a database that refuses connections', () => {
  // `datallowconn = false` hides a database from a connection, not from the
  // cluster: it still shares every role this run alters.
  assert.doesNotMatch(DATABASES_SQL, /datallowconn/)
  assert.match(DATABASES_SQL, /NOT datistemplate/)
})

test('the connecting user, which 022 grants nextspark_app, is named in the output', () => {
  const announced = GLOBAL_OBJECTS.find(object => object.role === 'current_user')

  assert.ok(announced, 'the connecting user is not announced')
  assert.match(announced!.change, /granted nextspark_app/)
})

test('the connecting user is announced but never looked for among existing roles', () => {
  // `current_user` is whoever runs this; a server that happens to have a role
  // of that name is not evidence of anything.
  const cluster = inspectCluster({ roles: [], databases: [{ name: 'postgres' }] })

  assert.equal(cluster.disposable, true)
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

/**
 * Every directory of migrations a run can apply: core's, the ones a generated
 * project starts from, and each theme's and plugin's. A role created by any of
 * them lands in the same cluster, so the output has to name it.
 */
function migrationDirs(): string[] {
  const repoRoot = path.resolve(CORE, '../..')
  const dirs = [path.join(CORE, 'migrations'), path.join(CORE, 'templates', 'migrations')]
  for (const group of ['themes', 'plugins']) {
    const groupDir = path.join(repoRoot, group)
    if (!fs.existsSync(groupDir)) continue
    for (const entry of fs.readdirSync(groupDir, { withFileTypes: true })) {
      const dir = path.join(groupDir, entry.name, 'migrations')
      if (entry.isDirectory() && fs.existsSync(dir)) dirs.push(dir)
    }
  }
  return dirs.filter(dir => fs.existsSync(dir))
}

test('every role any migration creates, alters or grants to is named in the output', () => {
  const dirs = migrationDirs()
  const named = new Map<string, string>()
  for (const dir of dirs) {
    for (const file of fs.readdirSync(dir).filter(name => name.endsWith('.sql'))) {
      const sql = fs.readFileSync(path.join(dir, file), 'utf8')
      for (const role of rolesNamedIn(sql)) if (!named.has(role)) named.set(role, path.join(dir, file))
    }
  }

  const announced = new Set(GLOBAL_OBJECTS.map(object => object.role))
  const unannounced = [...named].filter(([role]) => !announced.has(role)).map(([role, file]) => `${role} (${file})`)

  assert.deepEqual(unannounced.sort(), [])
  assert.ok(named.size > 0, 'no role statement was found in the migrations')
  assert.ok(dirs.length > 2, 'the scan reads only core, not the themes and plugins that also migrate')
})

test('a grant names the role it is granted to, whichever kind of grant it is', () => {
  // The shapes a future migration is most likely to use, and the ones a scan
  // that only reads the granted role misses: both name `future_reader`.
  assert.deepEqual([...rolesNamedIn('GRANT authenticated TO future_reader;')].sort(), ['authenticated', 'future_reader'])
  assert.deepEqual([...rolesNamedIn('GRANT SELECT ON ALL TABLES IN SCHEMA public TO future_reader;')], ['future_reader'])
  assert.deepEqual([...rolesNamedIn('REVOKE INSERT ON public.posts FROM future_reader;')], ['future_reader'])
  assert.deepEqual(
    [...rolesNamedIn('GRANT USAGE ON SCHEMA public TO reader, writer;')].sort(),
    ['reader', 'writer']
  )
  assert.deepEqual([...rolesNamedIn('GRANT authenticated TO future_reader WITH ADMIN OPTION;')].sort(), [
    'authenticated',
    'future_reader',
  ])
})

test('the roles the migrations themselves use are named, and prose about them is not', () => {
  assert.deepEqual([...rolesNamedIn('CREATE ROLE nextspark_app NOLOGIN NOINHERIT;')], ['nextspark_app'])
  assert.deepEqual([...rolesNamedIn('DROP ROLE IF EXISTS legacy_reader;')], ['legacy_reader'])
  // 022 grants through format(), so the statement lives in a string literal
  assert.deepEqual(
    [...rolesNamedIn("EXECUTE format('GRANT nextspark_app TO %I', current_user);")].sort(),
    ['current_user', 'nextspark_app']
  )
  // ...while a RAISE message that quotes a grant is talking about one
  assert.deepEqual([...rolesNamedIn("RAISE NOTICE 'GRANT admin TO auditor skipped: %', SQLERRM;")], [])
  assert.deepEqual([...rolesNamedIn('-- GRANT admin TO auditor\nSELECT 1;')], [])
})
