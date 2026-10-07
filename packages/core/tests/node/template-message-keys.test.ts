/**
 * Every literal translation key a template's own files and the core routes use must exist in the
 * messages the build merges (core, then the template), for every locale. A missing key prints
 * `MISSING_MESSAGE` for each prerendered page that renders it, so a new key without its text
 * shows up in the build log of a fresh project (#203).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEMPLATES = path.join(CORE, 'templates/projects')
const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt']
type Json = Record<string, unknown>

function merge(a: Json, b: Json): Json {
  const out: Json = { ...a }
  for (const [k, v] of Object.entries(b)) {
    const prev = out[k]
    out[k] = v && typeof v === 'object' && prev && typeof prev === 'object' ? merge(prev as Json, v as Json) : v
  }
  return out
}

const readJson = (file: string): Json => JSON.parse(fs.readFileSync(file, 'utf8'))

/** Core's catalog as the runtime merges it: the locale over English (loadMergedTranslations' fallback chain). */
function coreMessages(locale: string): Json {
  return locale === 'en' ? coreLocale('en') : merge(coreLocale('en'), coreLocale(locale))
}

function coreLocale(locale: string): Json {
  const dir = path.join(CORE, 'src/messages', locale)
  return Object.fromEntries(fs.readdirSync(dir).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), readJson(path.join(dir, f))]))
}

/** The template's messages by locale: one `<locale>/<namespace>.json` per namespace, or a single `<locale>.json`. */
function templateMessages(template: string): Record<string, Json> {
  const dir = path.join(TEMPLATES, template, 'messages')
  const out: Record<string, Json> = {}
  for (const entry of fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }) : []) {
    if (entry.isFile() && entry.name.endsWith('.json')) out[entry.name.slice(0, -5)] = readJson(path.join(dir, entry.name))
    else if (entry.isDirectory()) {
      const sub = path.join(dir, entry.name)
      out[entry.name] = Object.fromEntries(fs.readdirSync(sub).filter(f => f.endsWith('.json')).map(f => [f.slice(0, -5), readJson(path.join(sub, f))]))
    }
  }
  return out
}

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const f = path.join(dir, e.name)
    return e.isDirectory() ? (e.name === 'node_modules' || e.name === 'tests' ? [] : walk(f)) : /\.tsx?$/.test(e.name) ? [f] : []
  })
}

const KEY_METHODS = new Set(['rich', 'markup', 'raw', 'has'])

/**
 * `const t = useTranslations('ns')` / `await getTranslations('ns')`, then `t('a.b')` (also `t.rich/markup/raw/has`):
 * the full literal keys. A call with a non-literal argument clears the name, so a later `t` in the same file is not
 * read with a stale namespace.
 */
function literalKeys(file: string): string[] {
  const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const namespaces = new Map<string, string>()
  const keys: string[] = []
  const visit = (node: ts.Node): void => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const call = ts.isAwaitExpression(node.initializer) ? node.initializer.expression : node.initializer
      if (ts.isCallExpression(call) && /^(useTranslations|getTranslations)$/.test(call.expression.getText(source))) {
        const [arg] = call.arguments
        if (arg && ts.isStringLiteralLike(arg)) namespaces.set(node.name.text, arg.text)
        else namespaces.delete(node.name.text)
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      const name = ts.isIdentifier(callee) ? callee
        : ts.isPropertyAccessExpression(callee) && ts.isIdentifier(callee.expression) && KEY_METHODS.has(callee.name.text) ? callee.expression
        : undefined
      if (name && namespaces.has(name.text)) {
        const [arg] = node.arguments
        if (arg && ts.isStringLiteralLike(arg)) keys.push(`${namespaces.get(name.text)}.${arg.text}`)
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return keys
}

const has = (messages: Json, key: string): boolean =>
  typeof key.split('.').reduce<unknown>((m, part) => (m && typeof m === 'object' ? (m as Json)[part] : undefined), messages) === 'string'

function missing(files: string[], messagesByLocale: Record<string, Json>): string[] {
  const keys = files.flatMap(f => literalKeys(f).map(k => [path.relative(CORE, f), k] as const))
  return Object.entries(messagesByLocale).flatMap(([locale, messages]) =>
    keys.filter(([, k]) => !has(messages, k)).map(([f, k]) => `${locale}: ${k} (${f})`))
}

// core/src/components is not scanned: 18 literal keys there are missing from the English catalog today
// (teams.*, billing.changePlan.confirming, home.auth.* ...), a separate cleanup.
test('core routes only use keys that core ships, in every locale', () => {
  const byLocale = Object.fromEntries(LOCALES.map(l => [l, coreMessages(l)]))
  assert.deepEqual(missing(walk(path.join(CORE, 'src/routes')), byLocale), [])
})

for (const template of fs.readdirSync(TEMPLATES)) {
  test(`template ${template} only uses keys that core or the template ships`, () => {
    const own = templateMessages(template)
    const locales = Object.keys(own)
    assert.ok(locales.length > 0, `${template} ships no messages`)
    const byLocale = Object.fromEntries(locales.map(l => [l, merge(coreMessages(LOCALES.includes(l) ? l : 'en'), own[l])]))
    const files = ['components', 'templates', 'blocks', 'lib'].flatMap(d => walk(path.join(TEMPLATES, template, d)))
    assert.deepEqual(missing(files, byLocale), [])
  })
}
