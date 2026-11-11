/**
 * db:migrate against a real PostgreSQL notices a migration file that changed after it was applied (#428): it
 * records a hash with each file, fills it in for the rows of an older ledger, warns on an edit (stopping only with
 * --strict), and stops on a rename with the UPDATE that records the new name. `check-migration-ledger.mjs`, which
 * doctor runs, reads the same without writing.
 *
 * The test starts a throwaway cluster with initdb and pg_ctl on a free port, and is skipped when they are not on the PATH.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import { logging, migrationProjects, CHECK_LEDGER } from '../support/migration-project'

const { project, skip } = migrationProjects('migration-recorded-pg')

const sha = (sql: string) => createHash('sha256').update(sql).digest('hex')

test('a run records the hash of every file it applies, and a second run says nothing', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    const first = p.migrate()
    assert.equal(first.status, 0, first.out)
    assert.deepEqual(await p.rows('SELECT filename, content_hash FROM "_migrations"'), [{ filename: '001_core.sql', content_hash: sha(logging('core_log', '001')) }])
    assert.deepEqual(await p.rows('SELECT filename, content_hash FROM "_content_migrations"'), [{ filename: '001_project.sql', content_hash: sha(logging('project_log', '001')) }])
    assert.deepEqual(await p.rows('SELECT entity_name, filename, content_hash FROM "_entity_migrations"'), [{ entity_name: 'widgets', filename: '001_widgets.sql', content_hash: sha(logging('widget_log', '001')) }])

    const second = p.migrate()
    assert.equal(second.status, 0, second.out)
    assert.doesNotMatch(second.out, /changed after|no longer on disk|content_hash/)
    assert.deepEqual(await p.log('project_log'), ['001'])
  } finally {
    await p.end()
  }
})

test('a ledger with no hash column or no hashes keeps working, and its rows get the hash of the files as they are', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    assert.equal(p.migrate().status, 0)
    await p.client.query('ALTER TABLE "_migrations" DROP COLUMN content_hash')
    await p.client.query('UPDATE "_content_migrations" SET content_hash = NULL')
    const again = p.migrate()
    assert.equal(again.status, 0, again.out)
    assert.doesNotMatch(again.out, /changed after/)
    assert.deepEqual(await p.rows('SELECT filename, content_hash FROM "_migrations"'), [{ filename: '001_core.sql', content_hash: sha(logging('core_log', '001')) }])
    assert.equal((await p.rows('SELECT content_hash FROM "_content_migrations"'))[0].content_hash, sha(logging('project_log', '001')))
    assert.deepEqual(await p.log('core_log'), ['001'], 'nothing ran again')
  } finally {
    await p.end()
  }
})

test('an edited migration warns with its file and database, is not run again, and does not hold back a pending one', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    assert.equal(p.migrate().status, 0)
    p.write('migrations/001_project.sql', `${logging('project_log', '001')} INSERT INTO project_log VALUES ('edited');`)
    p.write('packages/core/migrations/001_core.sql', `${logging('core_log', '001')} -- a comment\n`)
    p.write('migrations/002_project.sql', logging('project_log', '002'))

    const edited = p.migrate()
    assert.equal(edited.status, 0, edited.out)
    assert.match(edited.out, new RegExp(`2 migration file\\(s\\) changed after they were applied to host 127\\.0\\.0\\.1, database ${p.database}`))
    assert.match(edited.out, /- 001_core\.sql \(core\)/)
    assert.match(edited.out, /- 001_project\.sql \(project fixture\)/)
    assert.deepEqual(await p.log('project_log'), ['001', '002'], 'the edit did not run; the pending file did')
    // the warning is the last thing printed too, after the summary
    assert.ok(edited.out.lastIndexOf('changed after') > edited.out.indexOf('All migrations completed successfully'))

    // accepting the file as it is: the UPDATE the warning prints, run as printed
    // (printed twice: where it was found and again at the end)
    const accept = [...new Set([...edited.out.matchAll(/^ +(UPDATE "_content_migrations" SET content_hash = NULL.*;)$/gm)].map(match => match[1]))]
    assert.equal(accept.length, 1)
    await p.client.query(accept[0])
    const accepted = p.migrate()
    assert.equal(accepted.status, 0, accepted.out)
    assert.doesNotMatch(accepted.out, /001_project\.sql \(project/)
    assert.match(accepted.out, /001_core\.sql \(core\)/)
  } finally {
    await p.end()
  }
})

test('--strict stops before anything is applied when an applied migration was edited', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    assert.equal(p.migrate().status, 0)
    p.write('migrations/001_project.sql', `${logging('project_log', '001')} -- edited\n`)
    p.write('migrations/002_project.sql', logging('project_log', '002'))
    const strict = p.migrate('--strict')
    assert.equal(strict.status, 1, strict.out)
    assert.match(strict.out, /001_project\.sql \(project fixture\)/)
    assert.match(strict.out, /--strict: nothing was run/)
    assert.deepEqual(await p.log('project_log'), ['001'], 'the pending file did not run')
    assert.equal(p.migrate().status, 0, 'without --strict the same state only warns')
    assert.deepEqual(await p.log('project_log'), ['001', '002'])
  } finally {
    await p.end()
  }
})

test('a renamed migration stops the run with the UPDATE that records its new name, and that UPDATE fixes it', { skip, timeout: 120000 }, async () => {
  const p = await project({ 'entities/widgets/migrations/002_widgets_more.sql': logging('widget_log', '002') })
  try {
    assert.equal(p.migrate().status, 0)
    fs.renameSync(path.join(p.root, 'entities/widgets/migrations/002_widgets_more.sql'), path.join(p.root, 'entities/widgets/migrations/000_widgets_more.sql'))
    fs.renameSync(path.join(p.root, 'migrations/001_project.sql'), path.join(p.root, 'migrations/000_project.sql'))
    p.write('migrations/002_project.sql', logging('project_log', '002'))

    const renamed = p.migrate()
    assert.equal(renamed.status, 1, renamed.out)
    assert.match(renamed.out, /- 001_project\.sql is now 000_project\.sql \(project fixture\)/)
    assert.match(renamed.out, /- 002_widgets_more\.sql is now 000_widgets_more\.sql \(entity widgets\)/)
    assert.match(renamed.out, /Nothing was run/)
    assert.deepEqual(await p.log('project_log'), ['001'], 'nothing ran')
    assert.deepEqual(await p.log('widget_log'), ['001', '002'])

    const updates = [...renamed.out.matchAll(/^ +(UPDATE .*;)$/gm)].map(match => match[1])
    assert.equal(updates.length, 2)
    for (const update of updates) await p.client.query(update)

    const fixed = p.migrate()
    assert.equal(fixed.status, 0, fixed.out)
    assert.deepEqual(await p.log('project_log'), ['001', '002'], 'only the new file ran')
    assert.deepEqual(await p.log('widget_log'), ['001', '002'], 'the renamed file did not run again')
  } finally {
    await p.end()
  }
})

test('the doctor check reports edits and renames from the ledgers and writes nothing', { skip, timeout: 120000 }, async () => {
  const p = await project()
  try {
    assert.equal(p.migrate().status, 0)
    assert.deepEqual(JSON.parse(p.check().out), { edited: [], accept: [], renamed: [] })

    // a row with no hash yet stays as it is: the check never writes
    await p.client.query('UPDATE "_entity_migrations" SET content_hash = NULL')
    p.write('migrations/001_project.sql', `${logging('project_log', '001')} -- edited\n`)
    fs.renameSync(path.join(p.root, 'packages/core/migrations/001_core.sql'), path.join(p.root, 'packages/core/migrations/000_core.sql'))
    const found = JSON.parse(p.check().out)
    assert.deepEqual(found.edited, [{ file: '001_project.sql', source: 'project fixture' }])
    assert.deepEqual(found.renamed.map((item: any) => [item.from, item.to, item.source]), [['001_core.sql', '000_core.sql', 'core']])
    assert.equal(found.renamed[0].update, `UPDATE "_migrations" SET filename = '000_core.sql' WHERE filename = '001_core.sql';`)
    assert.equal((await p.rows('SELECT content_hash FROM "_entity_migrations"'))[0].content_hash, null)

    const unreachable = spawnSync(process.execPath, [CHECK_LEDGER], { cwd: p.root, env: { ...process.env, DATABASE_URL: 'postgresql://owner:secret@127.0.0.1:1/x' }, encoding: 'utf8', timeout: 60000 })
    assert.equal(unreachable.status, 2)
    assert.doesNotMatch(unreachable.stdout, /secret/)
  } finally {
    await p.end()
  }
})
