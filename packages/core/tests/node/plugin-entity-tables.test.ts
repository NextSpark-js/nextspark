/**
 * The tables of the plugins in plugins/, read from their migrations (#455):
 * - every table a plugin's migrations leave is named `<prefix>_<table>`, the prefix being the first segment of the
 *   plugin's name (`social-media-publisher` -> `social_`, `ai` -> `ai_`), so a plugin cannot take a table name a
 *   project or another plugin uses ("audit_logs" was one);
 * - the table the entity registry resolves for each plugin entity (`tableName || slug`, as lib/entities/registry and
 *   generic-entity.service do) is one of them: a slug with a hyphen ('audit-logs') named a table no SQL created.
 *
 * The tables a plugin leaves are the ones its migrations create, followed through the `ALTER TABLE ... RENAME TO`
 * of later files: an applied migration cannot be edited, so a table is renamed by a new one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const PLUGINS = path.join(REPO, 'plugins')

function walk(dir: string, keep: (file: string) => boolean): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.name === 'node_modules') return []
    const file = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(file, keep) : keep(file) ? [file] : []
  })
}

const IDENT = String.raw`(?:public\.)?"?([A-Za-z_][A-Za-z0-9_]*)"?`

/** The tables a plugin's migrations leave: created, then renamed, file by file in name order (comments dropped). */
function pluginTables(pluginDir: string): Set<string> {
  const files = walk(pluginDir, file => file.endsWith('.sql') && file.includes(`${path.sep}migrations${path.sep}`))
    .sort((a, b) => path.basename(a).localeCompare(path.basename(b)))
  const tables = new Set<string>()
  for (const file of files) {
    const sql = fs.readFileSync(file, 'utf8').replace(/--.*$/gm, '')
    for (const [, name] of sql.matchAll(new RegExp(String.raw`CREATE TABLE(?: IF NOT EXISTS)?\s+${IDENT}\s*\(`, 'gi'))) tables.add(name)
    for (const [, from, to] of sql.matchAll(new RegExp(String.raw`ALTER TABLE(?: IF EXISTS)?\s+${IDENT}\s+RENAME TO\s+${IDENT}`, 'gi'))) {
      if (tables.delete(from)) tables.add(to)
    }
  }
  return tables
}

/** A plugin's table prefix: the first segment of its name (the folder name, as the plugin config's `name`). */
const tablePrefix = (plugin: string) => `${plugin.split('-')[0].replace(/[^a-z0-9]/g, '_')}_`

/** The table a config resolves: the literal `tableName`, else the literal `slug`. */
function resolvedTable(source: string): string | undefined {
  return /^\s*tableName:\s*'([^']+)'/m.exec(source)?.[1] ?? /^\s*slug:\s*'([^']+)'/m.exec(source)?.[1]
}

const plugins = () => fs.readdirSync(PLUGINS, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name)

test('every table the migrations of a plugin in plugins/ leave is prefixed with the first segment of its name (#455)', () => {
  let checked = 0
  for (const plugin of plugins()) {
    for (const table of pluginTables(path.join(PLUGINS, plugin))) {
      assert.ok(table.startsWith(tablePrefix(plugin)), `${plugin}: the table "${table}" is not named ${tablePrefix(plugin)}<table>`)
      checked++
    }
  }
  assert.ok(checked >= 10, `the plugins of the repo create tables (${checked} read)`)
})

test("the table resolved for each entity of the plugins in plugins/ is one that plugin's migrations leave (#455)", () => {
  let checked = 0
  for (const plugin of plugins()) {
    const dir = path.join(PLUGINS, plugin)
    const tables = pluginTables(dir)
    for (const config of walk(path.join(dir, 'entities'), file => file.endsWith('.config.ts'))) {
      const table = resolvedTable(fs.readFileSync(config, 'utf8'))
      assert.ok(table, `${config} declares a literal slug or tableName`)
      assert.ok(tables.has(table), `${plugin}: ${path.basename(config)} resolves the table "${table}" and the plugin's migrations leave ${[...tables].join(', ')}`)
      checked++
    }
  }
  assert.ok(checked >= 2, 'the plugins of the repo have entity configs')
})

test('the tables a plugin leaves follow a rename; the prefix is the first segment of the name (#455)', () => {
  const root = fs.mkdtempSync(path.join(fs.realpathSync(process.env.TMPDIR || '/tmp'), 'plugin-tables-'))
  try {
    fs.mkdirSync(path.join(root, 'migrations'))
    fs.writeFileSync(path.join(root, 'migrations/001_a.sql'), 'CREATE TABLE IF NOT EXISTS "audit_logs" (id TEXT);\nCREATE TABLE public."x_keep" (id TEXT);\n-- CREATE TABLE ignored (id TEXT);')
    fs.writeFileSync(path.join(root, 'migrations/002_b.sql'), 'DO $$ BEGIN ALTER TABLE public."audit_logs" RENAME TO "x_audit_logs"; END $$;')
    assert.deepEqual([...pluginTables(root)].sort(), ['x_audit_logs', 'x_keep'])
  } finally {
    fs.rmSync(root, { recursive: true, force: true })
  }
  assert.equal(tablePrefix('social-media-publisher'), 'social_')
  assert.equal(tablePrefix('ai'), 'ai_')
  assert.equal(tablePrefix('marketplace-payments'), 'marketplace_')
})
