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
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { GLOBAL_OBJECTS, ROLES_SQL, DATABASES_SQL, MAINTENANCE_DATABASE, inspectCluster, rolesNamedIn } from '../../scripts/db/cluster-changes.mjs'
import { inspectTarget, inspectMaintenanceDatabase } from '../../scripts/db/inspect-server.mjs'
import { findTheme, migrationFiles } from '../../scripts/db/theme-location.mjs'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const REPO_ROOT = path.resolve(CORE, '../..')

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

test('the databases query counts a database that refuses connections or is marked as a template', () => {
  // `datallowconn = false` hides a database from a connection, and
  // `datistemplate` only lets it be copied: neither takes it out of the
  // cluster, and both still share every role this run alters.
  assert.doesNotMatch(DATABASES_SQL, /datallowconn/)
  assert.doesNotMatch(DATABASES_SQL, /datistemplate/)
})

test('a database a user marked as a template is another database on the server', () => {
  const cluster = inspectCluster({
    roles: [],
    databases: [{ name: 'postgres' }, { name: 'template0' }, { name: 'template1' }, { name: 'nextspark_blueprint' }],
  })

  assert.equal(cluster.disposable, false)
  assert.deepEqual(cluster.otherDatabases, ['nextspark_blueprint'])
  assert.match(cluster.reasons[0], /other databases share this server: nextspark_blueprint$/)
})

test('the templates every server has say nothing about it being in use', () => {
  const cluster = inspectCluster({ roles: [], databases: [{ name: 'postgres' }, { name: 'template0' }, { name: 'template1' }] })

  assert.equal(cluster.disposable, true)
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
 * Every migration a run can apply, wherever it sits: core's own, and in each
 * theme and plugin the top-level `migrations/` together with the ones under
 * `entities/*` (children included) and `settings/*`, which run-migrations.mjs
 * executes as well — plus the starter theme core ships to generated projects,
 * under packages/core/templates/contents. A role created by any of them lands
 * in the same cluster, so the output has to name it.
 */
function migrationsIn(root: string): string[] {
  return ['packages/core', 'themes', 'plugins'].flatMap(tree => migrationFiles(path.join(root, tree)))
}

test('every role any migration creates, alters or grants to is named in the output', () => {
  const files = migrationsIn(REPO_ROOT)
  const named = new Map<string, string>()
  for (const file of files) {
    for (const role of rolesNamedIn(fs.readFileSync(file, 'utf8'))) {
      if (!named.has(role)) named.set(role, path.relative(REPO_ROOT, file))
    }
  }

  const announced = new Set(GLOBAL_OBJECTS.map(object => object.role))
  const unannounced = [...named].filter(([role]) => !announced.has(role)).map(([role, file]) => `${role} (${file})`)

  assert.deepEqual(unannounced.sort(), [])
  assert.ok(named.size > 0, 'no role statement was found in the migrations')
})

test('the guard reads the entity migrations and the shipped starter, not only each top-level migrations/', () => {
  const dirs = new Set(migrationsIn(REPO_ROOT).map(file => path.relative(REPO_ROOT, path.dirname(file))))

  for (const dir of [
    'packages/core/migrations',
    'themes/blog/migrations',
    'themes/blog/entities/posts/migrations',
    'themes/crm/entities/contacts/migrations',
    'plugins/langchain/migrations',
    'plugins/ai/entities/ai-history/migrations',
    'packages/core/templates/contents/themes/starter/entities/pages/migrations',
  ]) {
    assert.ok(dirs.has(dir), `${dir} is not read`)
  }
})

test('migrations are found at any depth under a migrations directory, and nowhere else', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-theme-migrations-'))
  const write = (file: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), 'SELECT 1;')
  }
  const expected = [
    'packages/core/migrations/001_core.sql',
    'packages/core/templates/contents/themes/starter/entities/pages/migrations/001_pages.sql',
    'themes/shop/migrations/001_theme.sql',
    'themes/shop/entities/orders/migrations/001_orders.sql',
    'themes/shop/entities/orders/children/lines/migrations/001_lines.sql',
    'themes/shop/settings/billing/migrations/001_billing.sql',
    'plugins/crm-sync/entities/syncs/migrations/001_syncs.sql',
  ]
  try {
    for (const file of expected) write(file)
    write('themes/shop/docs/example.sql')
    write('themes/shop/migrations/README.md')
    write('plugins/crm-sync/node_modules/some-lib/migrations/001_vendor.sql')

    assert.deepEqual(migrationsIn(root).map(file => path.relative(root, file)).sort(), [...expected].sort())
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

const WORKFLOW = path.join(REPO_ROOT, '.github/workflows/theme-migrations.yml')

function workflowThemes(): string[] {
  const matrix = fs.readFileSync(WORKFLOW, 'utf8').match(/^\s*theme:\s*\[([^\]]+)\]/m)
  assert.ok(matrix, 'the workflow has no theme matrix')
  return matrix![1].split(',').map(theme => theme.trim())
}

test('every theme the workflow verifies is a theme with migrations, and starter is the one core ships', () => {
  const themes = workflowThemes()
  assert.ok(themes.includes('starter'))

  for (const theme of themes) {
    const located = findTheme(REPO_ROOT, theme)
    assert.equal(located.error, undefined, `${theme}: ${located.error}`)
    assert.ok(located.migrations.length > 0, `${theme} has no migrations`)
  }

  const starter = findTheme(REPO_ROOT, 'starter')
  assert.equal(path.relative(REPO_ROOT, starter.themeDir), 'packages/core/templates/contents/themes/starter')
  assert.equal(path.relative(REPO_ROOT, starter.projectDir), 'packages/core/templates')
  assert.ok(starter.migrations.some((file: string) => file.includes('/entities/')))
})

test('the workflow runs when a migration of any theme it verifies changes', () => {
  const globs = [...fs.readFileSync(WORKFLOW, 'utf8').matchAll(/^\s*-\s*'([^']+)'\s*$/gm)].map(([, glob]) => glob)
  const matchers = globs.map(glob => new RegExp(`^${glob.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*\*/g, '\0').replace(/\*/g, '[^/]*').replace(/\0/g, '.*')}$`))

  // The shipped starter is named on its own, so the check does not rest on the lookup it covers.
  const starter = migrationFiles(path.join(REPO_ROOT, 'packages/core/templates/contents/themes/starter'))
  assert.ok(starter.length > 0)
  const untriggered = [...workflowThemes().flatMap(theme => findTheme(REPO_ROOT, theme).migrations ?? []), ...starter]
    .map((file: string) => path.relative(REPO_ROOT, fs.realpathSync(file)))
    .filter((file: string) => !matchers.some(matcher => matcher.test(file)))

  assert.deepEqual([...new Set(untriggered)], [])
})

test('a directory named like a theme is not one without a theme config, nor one without migrations', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'verify-theme-location-'))
  const write = (file: string) => {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    fs.writeFileSync(path.join(root, file), '')
  }
  try {
    // what themes/starter is in the repo: tests, no theme
    write('apps/dev/contents/themes/starter/tests/jest/starter.test.ts')
    write('packages/core/templates/contents/themes/starter/config/theme.config.ts')
    write('packages/core/templates/contents/themes/starter/entities/pages/migrations/001_pages.sql')
    write('apps/dev/contents/themes/bare/config/theme.config.ts')
    write('apps/dev/contents/themes/twice/config/theme.config.ts')
    write('apps/dev/contents/themes/twice/migrations/001.sql')
    write('packages/core/templates/contents/themes/twice/config/theme.config.ts')
    write('packages/core/templates/contents/themes/twice/migrations/001.sql')

    assert.equal(path.relative(root, findTheme(root, 'starter').projectDir), 'packages/core/templates')
    assert.match(findTheme(root, 'bare').error, /theme "bare" at apps\/dev\/contents\/themes\/bare has no migrations/)
    assert.match(findTheme(root, 'twice').error, /"twice" is a theme in more than one place/)
    assert.match(findTheme(root, 'missing').error, /no theme "missing": none of .* has a theme config/)
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
})

test('db:verify-theme refuses a name that is not a theme before it connects to anything', () => {
  const run = spawnSync(process.execPath, [path.join(CORE, 'scripts/db/verify-theme-migrations.mjs'), 'no-such-theme'], {
    env: { ...process.env, VERIFY_THEME_DATABASE_URL: 'postgresql://nobody@127.0.0.1:1/nextspark_verify?sslmode=disable' },
    encoding: 'utf8',
    timeout: 10000,
  })

  assert.equal(run.status, 1)
  assert.match(run.stderr, /no theme "no-such-theme"/)
  assert.doesNotMatch(run.stdout, /Verifying/)
})

/**
 * A server that completes the handshake and then never answers: the shape of a
 * query waiting on a lock another session holds, or of a connection that died
 * once it was up. Only the startup exchange of the wire protocol is spoken.
 */
async function silentServer(t: { after: (fn: () => void) => void }) {
  const sockets = new Set<net.Socket>()
  const server = net.createServer(socket => {
    sockets.add(socket)
    let started = false
    socket.on('data', chunk => {
      if (started) return
      // SSLRequest: length 8, code 80877103
      if (chunk.length === 8 && chunk.readInt32BE(4) === 80877103) return void socket.write('N')
      started = true
      const authenticationOk = Buffer.from([0x52, 0, 0, 0, 8, 0, 0, 0, 0])
      const readyForQuery = Buffer.from([0x5a, 0, 0, 0, 5, 0x49])
      socket.write(Buffer.concat([authenticationOk, readyForQuery]))
    })
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  t.after(() => {
    for (const socket of sockets) socket.destroy()
    server.close()
  })
  const { port } = server.address() as net.AddressInfo
  return `postgresql://dbuser@127.0.0.1:${port}/nextspark_verify?sslmode=disable`
}

const SHORT_TIMEOUTS = { connectMs: 2000, statementMs: 200, queryMs: 400 }

test('a target that stops answering after the handshake is given up on, not waited for', { timeout: 10000 }, async t => {
  const url = await silentServer(t)
  const started = Date.now()

  await assert.rejects(inspectTarget(url, SHORT_TIMEOUTS), /timeout/i)
  assert.ok(Date.now() - started < 3000, `took ${Date.now() - started} ms`)
})

test('a maintenance database that stops answering is unreachable, not empty', { timeout: 10000 }, async t => {
  const url = await silentServer(t)

  const maintenance = await inspectMaintenanceDatabase(url, SHORT_TIMEOUTS)

  assert.equal(maintenance.unreachable, true)
  assert.match(maintenance.reason, /timeout/i)
  assert.equal(inspectCluster({ roles: [], databases: [], maintenance }).disposable, false)
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
