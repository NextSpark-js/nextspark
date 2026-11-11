/**
 * What the ledgers remember about a migration file (#428): its hash. compareLedger tells an edited file from a
 * renamed one and from a row with no hash yet; the reports name the file and print the statement that fixes the ledger.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
// @ts-expect-error -- plain .mjs module
import { LEDGERS, compareLedger, migrationHash, editedReport, renamedReport, acceptStatements } from '../../scripts/db/migration-ledger.mjs'

const [core, content, entity] = LEDGERS

test('the hash ignores line endings and nothing else', () => {
  assert.equal(migrationHash('SELECT 1;\r\nSELECT 2;\r\n'), migrationHash('SELECT 1;\nSELECT 2;\n'))
  assert.notEqual(migrationHash('SELECT 1;'), migrationHash('SELECT 1; '))
  assert.match(migrationHash('x'), /^[0-9a-f]{64}$/)
})

test('a recorded file with the hash it ran with is neither edited nor renamed', () => {
  const rows = [{ filename: '001_a.sql', content_hash: 'h1' }]
  assert.deepEqual(compareLedger(core, rows, [{ filename: '001_a.sql', hash: 'h1' }]), { edited: [], renamed: [], unhashed: [] })
})

test('a recorded file whose hash changed is edited; a row with no hash is only unhashed', () => {
  const rows = [
    { filename: '001_a.sql', content_hash: 'old' },
    { filename: '002_b.sql', content_hash: null },
  ]
  const files = [{ filename: '001_a.sql', hash: 'new' }, { filename: '002_b.sql', hash: 'anything' }]
  const { edited, renamed, unhashed } = compareLedger(core, rows, files)
  assert.deepEqual(edited.map((item: any) => item.row.filename), ['001_a.sql'])
  assert.deepEqual(unhashed.map((item: any) => item.row.filename), ['002_b.sql'])
  assert.deepEqual(renamed, [])
})

test('a recorded name with no file and an unrecorded file with its hash is a rename, matched once', () => {
  const rows = [{ filename: '001_old.sql', content_hash: 'h' }, { filename: '002_old.sql', content_hash: 'h' }]
  const files = [{ filename: '000_new.sql', hash: 'h' }]
  const { renamed } = compareLedger(core, rows, files)
  assert.equal(renamed.length, 1)
  assert.equal(renamed[0].row.filename, '001_old.sql')
  assert.equal(renamed[0].file.filename, '000_new.sql')
})

test('a rename is found only inside the scope of the record', () => {
  const rows = [{ source_type: 'project', source_name: 'a', filename: '001_x.sql', content_hash: 'h' }]
  const elsewhere = [{ source_type: 'plugin', source_name: 'a', filename: '000_x.sql', hash: 'h' }]
  assert.deepEqual(compareLedger(content, rows, elsewhere).renamed, [])
  const same = [{ source_type: 'project', source_name: 'a', filename: '000_x.sql', hash: 'h' }]
  assert.equal(compareLedger(content, rows, same).renamed.length, 1)
})

test('a recorded file that was deleted, with no file like it, is not reported', () => {
  const rows = [{ entity_name: 'tasks', filename: '001_a.sql', content_hash: 'h' }]
  assert.deepEqual(compareLedger(entity, rows, []), { edited: [], renamed: [], unhashed: [] })
})

test('the edited report names each file and its database, and the statement that accepts them', () => {
  const edited = [
    { ledger: core, row: { filename: '017_x.sql', content_hash: 'a' }, file: { filename: '017_x.sql', hash: 'b' } },
    { ledger: content, row: { source_type: 'project', source_name: "it's", filename: '003_y.sql', content_hash: 'a' }, file: { filename: '003_y.sql', hash: 'b' } },
  ]
  const text = editedReport(edited, 'host db.example.com, database app')
  assert.match(text, /2 migration file\(s\) changed after they were applied to host db\.example\.com, database app/)
  assert.match(text, /- 017_x\.sql \(core\)/)
  assert.match(text, /- 003_y\.sql \(project it's\)/)
  assert.deepEqual(acceptStatements(edited), [
    `UPDATE "_migrations" SET content_hash = NULL WHERE filename IN ('017_x.sql');`,
    `UPDATE "_content_migrations" SET content_hash = NULL WHERE source_type = 'project' AND source_name = 'it''s' AND filename IN ('003_y.sql');`,
  ])
  assert.equal(editedReport([], 'x'), null)
})

test('the renamed report prints the UPDATE that records the new name', () => {
  const renamed = [{ ledger: entity, row: { entity_name: 'tasks', filename: '001_a.sql' }, file: { filename: '000_a.sql' } }]
  const text = renamedReport(renamed, 'host h, database d')
  assert.match(text, /- 001_a\.sql is now 000_a\.sql \(entity tasks\)/)
  assert.match(text, /UPDATE "_entity_migrations" SET filename = '000_a\.sql' WHERE entity_name = 'tasks' AND filename = '001_a\.sql';/)
  assert.equal(renamedReport([], 'x'), null)
})
