/**
 * #411: the German and Portuguese catalogs are written with their diacritics (für, Zurück, não, Configurações), in the
 * core, in the starter project and in the dev app, not only in the `auth` namespace (#408).
 */
import { describe, test, expect } from '@jest/globals'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.join(__dirname, '../../../../..')

// Where the catalogs live: a messages folder per locale, and the entity messages `<entity>/messages/<locale>.json`
const PLACES: Record<string, { messages: string; entities: string[] }> = {
  core: { messages: 'packages/core/src/messages', entities: ['packages/core/src/entities'] },
  starter: { messages: 'packages/core/templates/projects/starter/messages', entities: ['packages/core/templates/projects/starter/entities'] },
  dev: { messages: 'apps/dev/messages', entities: ['apps/dev/entities'] },
}

function jsonFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    if (name === 'node_modules') return []
    return statSync(full).isDirectory() ? jsonFiles(full) : full.endsWith('.json') ? [full] : []
  })
}

function catalogFiles(place: string, locale: string): string[] {
  const { messages, entities } = PLACES[place]
  const entityMessages = entities.flatMap(dir => jsonFiles(path.join(ROOT, dir))).filter(f => f.endsWith(`${path.sep}messages${path.sep}${locale}.json`))
  return [...jsonFiles(path.join(ROOT, messages, locale)), ...entityMessages]
}

function strings(node: unknown, prefix = ''): Array<[string, string]> {
  if (typeof node === 'string') return [[prefix, node]]
  if (node && typeof node === 'object') return Object.entries(node).flatMap(([key, value]) => strings(value, prefix ? `${prefix}.${key}` : key))
  return []
}

// The words that lose their diacritics when a catalog is written in plain ASCII
const UNACCENTED: Record<string, RegExp> = {
  de: /Bestaetig|pruef|Pruef|fuer\b|ueberpruef|Ueberpruef|Zurueck|zurueck|Druecken|ungueltig|Ungueltig|spaeter|muessen|Mueller|Grossbuch|Oeffnen|laeuft|laueft/,
  pt: /\b(?:nao|Nao|Voce|Ja|ja|opcoes|invalid[oa]s?|Usuario|autenticacao|informacoes|comecar|condicoes|verificacao|necessario|botao|faca|endereco|recuperacao|conexao|maiuscula|minuscula|numero|pagina|Ultimo|Joao)\b/,
}

// A URL slug (`slug-da-pagina`) is ASCII on purpose, so it is not a text to write with diacritics
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)+$/
const unaccentedKeys = (locale: string, entries: Array<[string, string]>) =>
  entries.filter(([, text]) => !SLUG.test(text) && UNACCENTED[locale].test(text)).map(([key]) => key)

describe.each(Object.keys(PLACES))('%s catalogs', place => {
  describe.each(['de', 'pt'])('%s', locale => {
    const files = catalogFiles(place, locale)

    test('are found', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    test.each(files.map(f => [path.relative(ROOT, f), f]))('%s is written with its diacritics', (_name, file) => {
      const entries = strings(JSON.parse(readFileSync(file, 'utf8')))
      expect(unaccentedKeys(locale, entries)).toEqual([])
    })
  })
})

test('the check catches a value written without its diacritics', () => {
  expect(unaccentedKeys('de', [['a', 'Zurueck'], ['b', 'Zurück'], ['c', 'Neue Steuer']])).toEqual(['a'])
  expect(unaccentedKeys('pt', [['a', 'Voce nao pode'], ['b', 'Você não pode'], ['c', 'slug-da-pagina']])).toEqual(['a'])
})
