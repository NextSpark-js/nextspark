/**
 * Migrations run in the order of the number their file name starts with, then by name (#382): `1001_` runs after
 * `151_`, which text order got wrong. Every migration core ships, the project templates and the dev app carry
 * keep the position text order gave them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareMigrations } from '../../scripts/db/migration-order.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const repository = path.resolve(here, '..', '..', '..', '..')

test('a 1001_ migration runs after a 151_ one, in a list of files and of migration objects', () => {
  const names = ['1001_add_x.sql', '151_create_y.sql', '020_z.sql', '151_a.sql']
  assert.deepEqual([...names].sort(compareMigrations), ['020_z.sql', '151_a.sql', '151_create_y.sql', '1001_add_x.sql'])
  const objects = names.map(filename => ({ filename }))
  assert.deepEqual(objects.sort(compareMigrations).map(m => m.filename), ['020_z.sql', '151_a.sql', '151_create_y.sql', '1001_add_x.sql'])
})

test('migrations with the same number are ordered by name, and files without a number run last', () => {
  assert.deepEqual(
    ['b_late.sql', '999b_x.sql', '999a_x.sql', 'a_late.sql', '0152_a.sql', '151_b.sql'].sort(compareMigrations),
    ['151_b.sql', '0152_a.sql', '999a_x.sql', '999b_x.sql', 'a_late.sql', 'b_late.sql'],
  )
})

test('no core, template or dev app migration changes position against ordering the names as text', () => {
  const found: string[] = []
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (['node_modules', '.git', 'dist', '.next'].includes(entry.name)) continue
      const full = path.join(dir, entry.name)
      if (entry.isDirectory()) walk(full)
      else if (entry.name.endsWith('.sql') && path.basename(dir) === 'migrations') found.push(entry.name)
    }
  }
  for (const dir of ['packages/core/migrations', 'packages/core/templates', 'apps/dev', 'plugins']) {
    if (fs.existsSync(path.join(repository, dir))) walk(path.join(repository, dir))
  }
  const names = [...new Set(found)]
  assert.ok(names.length > 50, `found ${names.length} migration names`)
  assert.deepEqual([...names].sort(compareMigrations), [...names].sort((a, b) => a.localeCompare(b)))
})
