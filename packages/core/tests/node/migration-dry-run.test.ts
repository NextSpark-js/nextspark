/**
 * db:migrate --dry-run and --expect-database / --expect-host against a real PostgreSQL (#429). A dry run connects,
 * names the target and lists the pending migrations in the order a real run applies them, and writes nothing: every
 * table and row of the database is the same afterwards, ledgers included. An expectation that does not hold stops the
 * run before the first statement.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renameSync } from 'node:fs'
import { logging, migrationProjects } from '../support/migration-project'

const { project, skip } = migrationProjects('migration-dry-run-pg')

/** The migration file names a dry run lists, in its order. */
const listed = (out: string) => [...out.matchAll(/^ +\d+\. \[([^\]]+)\] (\S+)/gm)].map(match => `${match[1]}: ${match[2]}`)
/** The names a real run prints as it runs them, in its order: `🔄 Running f...` for core, `🔄 f...` below. */
const ran = (out: string) => [...out.matchAll(/🔄 (?:Running )?(\S+?)\.\.\./g)].map(match => match[1]).filter(name => name.endsWith('.sql'))

test('a dry run on an empty database lists every migration in run order and creates nothing', { skip, timeout: 120000 }, async () => {
  const p = await project({ 'migrations/002_project.sql': logging('project_log', '002'), 'entities/widgets/migrations/002_widgets.sql': logging('widget_log', '002') })
  try {
    const before = await p.snapshot()
    assert.deepEqual(before.tables, [])
    const dry = p.migrate('--dry-run')
    assert.equal(dry.status, 0, dry.out)
    assert.match(dry.out, new RegExp(`Dry run against host 127\\.0\\.0\\.1, database ${p.database}: nothing will be written`))
    assert.deepEqual(listed(dry.out), [
      'core: 001_core.sql',
      'project fixture: 001_project.sql',
      'project fixture: 002_project.sql',
      'entity widgets, project fixture: 001_widgets.sql',
      'entity widgets, project fixture: 002_widgets.sql',
    ])
    assert.match(dry.out, /Nothing was written/)
    assert.deepEqual(await p.snapshot(), before, 'no table, ledger or row was created')
  } finally {
    await p.end()
  }
})

test('a dry run lists exactly what the real run then applies, and writes nothing to a migrated database', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    assert.equal(p.migrate().status, 0)
    // an older ledger: no hash column, a row with no hash. A real run would write both; a dry run must not.
    await p.client.query('ALTER TABLE "_migrations" DROP COLUMN content_hash')
    await p.client.query('UPDATE "_entity_migrations" SET content_hash = NULL')
    p.write('packages/core/migrations/002_core.sql', logging('core_log', '002'))
    p.write('migrations/002_project.sql', logging('project_log', '002'))
    p.write('entities/widgets/migrations/002_widgets.sql', logging('widget_log', '002'))
    p.write('entities/gadgets/migrations/001_gadgets.sql', logging('gadget_log', '001'))

    const before = await p.snapshot()
    const dry = p.migrate('--dry-run')
    assert.equal(dry.status, 0, dry.out)
    const pending = listed(dry.out)
    assert.deepEqual(pending.map(item => item.split(': ')[1]), ['002_core.sql', '002_project.sql', '001_gadgets.sql', '002_widgets.sql'])
    assert.deepEqual(await p.snapshot(), before, 'the ledgers, the missing column and the rows with no hash are as they were')

    const real = p.migrate()
    assert.equal(real.status, 0, real.out)
    assert.deepEqual(ran(real.out), pending.map(item => item.split(': ')[1]), 'the real run applies the same files in the same order')
    assert.deepEqual(listed(p.migrate('--dry-run').out), [])
    assert.match(p.migrate('--dry-run').out, /Nothing is pending/)
  } finally {
    await p.end()
  }
})

test('a dry run lists sample data only when the run would apply it (db:seed)', { skip, timeout: 120000 }, async () => {
  const p = await project({ 'migrations/090_sample_data.sql': logging('project_log', 'sample') })
  try {
    const without = p.migrate('--dry-run')
    assert.equal(without.status, 0, without.out)
    assert.ok(!without.out.includes('090_sample_data.sql'), without.out)
    const seed = p.migrate('--dry-run', '--sample-data')
    assert.equal(seed.status, 0, seed.out)
    assert.deepEqual(listed(seed.out).at(-1), 'project fixture: 090_sample_data.sql')
    assert.match(seed.out, /090_sample_data\.sql \(sample data\)/)
    assert.deepEqual((await p.snapshot()).tables, [])
  } finally {
    await p.end()
  }
})

test('a dry run reports an applied migration that was renamed, as a real run would, and still writes nothing', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    assert.equal(p.migrate().status, 0)
    renameSync(`${p.root}/migrations/001_project.sql`, `${p.root}/migrations/000_project_renamed.sql`)
    const before = await p.snapshot()
    const dry = p.migrate('--dry-run')
    assert.equal(dry.status, 1, dry.out)
    assert.match(dry.out, /UPDATE "_content_migrations" SET filename = /)
    assert.deepEqual(await p.snapshot(), before)
  } finally {
    await p.end()
  }
})

test('--expect-database and --expect-host stop a run whose target differs, before the first statement', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    for (const args of [['--expect-database', 'other_db'], ['--expect-host', 'db.example.com'], ['--expect-database', p.database, '--expect-host', 'db.example.com']]) {
      const stopped = p.migrate(...args)
      assert.equal(stopped.status, 1, `${args.join(' ')}: ${stopped.out}`)
      assert.match(stopped.out, new RegExp(`${args[0]} .*the connection points at .*\\(expected `))
      assert.match(stopped.out, /Nothing was run/)
      assert.doesNotMatch(stopped.out, /Connected to database|Migrating host/)
      assert.deepEqual((await p.snapshot()).tables, [], 'nothing ran and nothing was created')
    }
    // the dry run refuses too
    assert.equal(p.migrate('--dry-run', '--expect-database', 'other_db').status, 1)

    const matching = p.migrate('--expect-database', p.database, `--expect-host=127.0.0.1`)
    assert.equal(matching.status, 0, matching.out)
    assert.match(matching.out, new RegExp(`Migrating host 127\\.0\\.0\\.1, database ${p.database} \\(the expected target\\)`))
    assert.deepEqual(await p.log('core_log'), ['001'])
  } finally {
    await p.end()
  }
})
