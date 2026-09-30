/**
 * The SQL type of an entity's columns, read from its migrations (#203 stage 7b).
 *
 * The API returns raw rows, so what a field is on the wire depends on the column: the `pg` driver
 * hands NUMERIC and BIGINT back as strings, INT and FLOAT as numbers (`pgWireKind`,
 * lib/entities/portable/response-shape.ts). An entity config says `type: 'number'` for all of them,
 * so the column type is read from `CREATE TABLE "<slug>"` and `ALTER TABLE "<slug>" ADD/ALTER COLUMN`
 * in the entity's migrations (later files win). A column no migration declares stays unknown.
 *
 * @module core/scripts/build/registry/contracts/read-columns
 */

import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'

const IDENT = '(?:"([^"]+)"|([A-Za-z_][\\w$]*))'
const CONSTRAINT_WORDS = /^(?:constraint|primary|foreign|unique|check|exclude|like)\b/i

/** The text of the balanced parentheses that open at `start` (the index of the `(`), or null. */
function balanced(text, start) {
  let depth = 0
  for (let index = start; index < text.length; index++) {
    if (text[index] === '(') depth++
    else if (text[index] === ')' && --depth === 0) return text.slice(start + 1, index)
  }
  return null
}

/** Split on the commas that are not inside parentheses. */
function splitTopLevel(body) {
  const parts = []
  let depth = 0
  let current = ''
  for (const char of body) {
    if (char === '(') depth++
    if (char === ')') depth--
    if (char === ',' && depth === 0) {
      parts.push(current)
      current = ''
    } else {
      current += char
    }
  }
  if (current.trim()) parts.push(current)
  return parts
}

/** `NUMERIC(5,2) NOT NULL DEFAULT 0` -> `NUMERIC(5,2)`; `DOUBLE PRECISION ...` -> `DOUBLE PRECISION`. */
function typeOf(definition) {
  const match = definition.trim().match(/^((?:double\s+precision|character\s+varying|timestamp(?:\s+with(?:out)?\s+time\s+zone)?|time(?:\s+with(?:out)?\s+time\s+zone)?|[A-Za-z_][\w]*)(?:\s*\([^)]*\))?(?:\[\])?)/i)
  return match ? match[1].replace(/\s+/g, ' ') : null
}

function stripComments(sql) {
  return sql.replace(/--[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
}

/** The declared column types of table `table` in one migration's SQL, as `{ column: type }`. */
export function columnsInSql(sql, table) {
  const text = stripComments(sql)
  const columns = {}
  const tableName = `(?:"?public"?\\.)?"?${table.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?`
  for (const match of text.matchAll(new RegExp(`create\\s+table\\s+(?:if\\s+not\\s+exists\\s+)?${tableName}\\s*\\(`, 'gi'))) {
    const body = balanced(text, match.index + match[0].length - 1)
    if (body === null) continue
    for (const part of splitTopLevel(body)) {
      const trimmed = part.trim()
      if (!trimmed || CONSTRAINT_WORDS.test(trimmed)) continue
      const column = trimmed.match(new RegExp(`^${IDENT}\\s+([\\s\\S]+)$`))
      const type = column ? typeOf(column[3]) : null
      if (column && type) columns[column[1] ?? column[2]] = type
    }
  }
  for (const match of text.matchAll(new RegExp(`alter\\s+table\\s+(?:if\\s+exists\\s+)?(?:only\\s+)?${tableName}\\s+([^;]+);`, 'gi'))) {
    for (const action of splitTopLevel(match[1])) {
      const add = action.trim().match(new RegExp(`^add\\s+column\\s+(?:if\\s+not\\s+exists\\s+)?${IDENT}\\s+([\\s\\S]+)$`, 'i'))
      const alter = action.trim().match(new RegExp(`^alter\\s+column\\s+${IDENT}\\s+(?:set\\s+data\\s+)?type\\s+([\\s\\S]+)$`, 'i'))
      const found = add ?? alter
      const type = found ? typeOf(found[3]) : null
      if (found && type) columns[found[1] ?? found[2]] = type
    }
  }
  return columns
}

/** The column types of `table` across the `.sql` files of these directories (files in name order, later wins). */
export function readColumnTypes(table, directories) {
  const columns = {}
  for (const directory of directories) {
    if (!existsSync(directory)) continue
    for (const name of readdirSync(directory).filter(entry => entry.endsWith('.sql')).sort()) {
      Object.assign(columns, columnsInSql(readFileSync(join(directory, name), 'utf8'), table))
    }
  }
  return columns
}
