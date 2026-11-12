/**
 * The table the entity registry resolves for an entity (`tableName || slug`, as lib/entities/registry and
 * generic-entity.service do) must be one the plugin's own migrations create. A slug with a hyphen
 * ('audit-logs') names a table the SQL never made ("audit_logs"), so every query on the entity failed (#455).
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

/** The table a config resolves: the literal `tableName`, else the literal `slug`. */
function resolvedTable(source: string): string | undefined {
  return /^\s*tableName:\s*'([^']+)'/m.exec(source)?.[1] ?? /^\s*slug:\s*'([^']+)'/m.exec(source)?.[1]
}

test("the table resolved for each entity of the plugins in plugins/ is created by that plugin's migrations (#455)", () => {
  let checked = 0
  for (const plugin of fs.readdirSync(PLUGINS)) {
    const dir = path.join(PLUGINS, plugin)
    const configs = walk(path.join(dir, 'entities'), file => file.endsWith('.config.ts'))
    const migrations = walk(dir, file => file.endsWith('.sql') && file.includes(`${path.sep}migrations${path.sep}`))
      .map(file => fs.readFileSync(file, 'utf8')).join('\n')
    for (const config of configs) {
      const table = resolvedTable(fs.readFileSync(config, 'utf8'))
      assert.ok(table, `${config} declares a literal slug or tableName`)
      const created = new RegExp(`CREATE TABLE(?: IF NOT EXISTS)?\\s+(?:public\\.)?"?${table}"?\\s*\\(`, 'i')
      assert.match(migrations, created, `${plugin}: ${path.basename(config)} resolves the table "${table}" and no migration of the plugin creates it`)
      checked++
    }
  }
  assert.ok(checked >= 2, 'the plugins of the repo have entity configs')
})
