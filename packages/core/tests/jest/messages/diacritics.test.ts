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
const UNACCENTED: Record<string, RegExp | undefined> = {
  de: /Bestaetig|pruef|Pruef|fuer\b|ueberpruef|Ueberpruef|Zurueck|zurueck|Druecken|ungueltig|Ungueltig|spaeter|muessen|Mueller|Grossbuch|Oeffnen|laeuft|laueft|Loesch|loesch|Bloeck|verfuegbar|Verfuegbar|Aenderung|aender|koennen|moecht|Uebersicht/,
  // the words that are only a word with the accent, and the few that are a different word without it, told by what follows
  es: new RegExp([
    String.raw`\b[Aa]un (?:no|hay|sin)\b|\bsin \w+ aun\b|\b\w+ aun$|\b[Gg]estiona quien\b`,
    // the nouns in -cion and -sion without the accent, and the question words after the opening mark
    String.raw`\b[A-Za-z]+(?:cion|sion)(?![\p{L}])|¿(?:Como|Que|Donde|Cuando|Cual|Quien)\b`,
    String.raw`\b(?:[Dd]iseno|[Aa]segurate|[Rr]egistrate|[Mm]embresia|[Ss]e guardo|[Ss]e cambio|[Nn]o es valid[oa]|[Yy]a no es valid[oa])\b`,
    // "esta" and "estas" as the verb (está, estás); "como" as the question word (cómo)
    String.raw`\b[Ee]stas? (?=seguro|segura|en\b|activ|disponible|vac[ií]o|deshabilitad|habilitad|configurad|conectad|siendo|usando|pendiente|bloquead|publicad|suspendid|cancelad|expirad|vencid|inactiv|por\b|a punto)`,
    String.raw`\b[Cc]omo (?=funciona|se (?:hace|usa|crea|configura)|puedo|puedes|puede|hacer|crear|configurar|cambiar|obtener|usar|agregar)`,
  ].join('|'), 'u'),
  pt: /\b(?:nao|Nao|Voce|Ja|ja|opcoes|invalid[oa]s?|Usuario|autenticacao|informacoes|comecar|condicoes|verificacao|necessario|botao|faca|endereco|recuperacao|conexao|maiuscula|minuscula|numero|pagina|Ultimo|Joao)\b/,
}

// A URL slug (`slug-da-pagina`) is ASCII on purpose, so it is not a text to write with diacritics
const SLUG = /^[a-z0-9]+(-[a-z0-9]+)+$/

// #413: besides the fixed list above, the words that lose their diacritics are derived from the catalogs themselves:
// every word a catalog writes with one (`Configurações`, `Contraseña`, `Zurück`) gives its plain-ASCII form
// (`configuracoes`, `contrasena`, `zurueck`, `zuruck`), and a value that holds that form as a whole word is a word
// written without its accent. Forms that are also real words without the accent are listed here with the reason.
const AMBIGUOUS: Record<string, Record<string, string>> = {
  es: {
    este: 'esté, but "este" (this) is a word',
    esta: 'está, but "esta" (this) is a word',
    estas: 'estás, but "estas" (these) is a word',
    como: 'cómo, but "como" (as) is a word',
    cuando: 'cuándo, but "cuando" (when) is a word',
    donde: 'dónde, but "donde" (where) is a word',
    super: 'súper, but "super" is a prefix and a word',
    videos: 'vídeos, but "videos" is the accepted spelling',
    // the catalog speaks with "vos" in some texts (ingresá) and with "tú" in others (ingresa): both are real forms
    ingresa: 'ingresá (vos) / ingresa (tú)',
    crea: 'creá (vos) / crea (tú)',
    intenta: 'intentá (vos) / intenta (tú)',
    hace: 'hacé (vos) / hace (tú, él)',
    verifica: 'verificá (vos) / verifica (tú)',
    inicia: 'iniciá (vos) / inicia (tú)',
    revisa: 'revisá (vos) / revisa (tú)',
    mejora: 'mejorá (vos) / mejora (tú, noun)',
    espera: 'esperá (vos) / espera (tú, noun)',
    solicita: 'solicitá (vos) / solicita (tú)',
    busca: 'buscá (vos) / busca (tú)',
    valida: 'validá (vos) / valida (tú)',
    debes: 'debés (vos) / debes (tú)',
    completo: 'completó, but "completo" (complete) is a word',
    quien: 'quién, but "quien" (who, in a statement) is a word; the question form is in the fixed list',
  },
  pt: {
    esta: 'está, but "esta" (this) is a word',
    pais: 'país, but "pais" (parents) is a word',
  },
  de: {
    kurze: 'Kürze, but "kurze" (short) is a word',
  },
}

/** `Zurück` -> [`zuruck`, `zurueck`]; `Configurações` -> [`configuracoes`]; `Contraseña` -> [`contrasena`]. */
const plainForms = (word: string): string[] => {
  const lower = word.toLowerCase()
  const stripped = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ß/g, 'ss')
  const transliterated = lower.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss')
  return [...new Set([stripped, transliterated])].filter(form => form !== lower)
}
const words = (text: string) => text.match(/\p{L}+/gu) ?? []

/** The plain-ASCII forms of the accented words the catalogs of a locale write, without the ambiguous ones. */
function derivedForms(accentedTexts: string[], locale: string): Map<string, string> {
  const forms = new Map<string, string>()
  for (const text of accentedTexts) {
    for (const word of words(text)) {
      if (!/[^\u0000-\u007f]/.test(word) || word.length < 4 || /ó$/.test(word)) continue
      for (const form of plainForms(word)) if (form.length >= 4 && !(form in (AMBIGUOUS[locale] ?? {}))) forms.set(form, word.toLowerCase())
    }
  }
  return forms
}

const unaccentedKeys = (locale: string, entries: Array<[string, string]>, forms: Map<string, string> = new Map()) =>
  entries
    .filter(([, text]) => !SLUG.test(text) && (UNACCENTED[locale]?.test(text) || words(text).some(word => forms.has(word.toLowerCase()))))
    .map(([key]) => key)

const LOCALES_CHECKED = ['de', 'pt', 'es']

// The accented words of each locale come from every catalog of that locale, in the three places
const FORMS = Object.fromEntries(
  LOCALES_CHECKED.map(locale => [
    locale,
    derivedForms(Object.keys(PLACES).flatMap(place => catalogFiles(place, locale)).flatMap(file => strings(JSON.parse(readFileSync(file, 'utf8'))).map(([, text]) => text)), locale),
  ]),
)

describe.each(Object.keys(PLACES))('%s catalogs', place => {
  describe.each(LOCALES_CHECKED)('%s', locale => {
    const files = catalogFiles(place, locale)

    test('are found', () => {
      expect(files.length).toBeGreaterThan(0)
    })

    test.each(files.map(f => [path.relative(ROOT, f), f]))('%s is written with its diacritics', (_name, file) => {
      const entries = strings(JSON.parse(readFileSync(file, 'utf8')))
      expect(unaccentedKeys(locale, entries, FORMS[locale])).toEqual([])
    })
  })
})

test('the check catches a value written without its diacritics', () => {
  expect(unaccentedKeys('de', [['a', 'Zurueck'], ['b', 'Zurück'], ['c', 'Neue Steuer']])).toEqual(['a'])
  expect(unaccentedKeys('pt', [['a', 'Voce nao pode'], ['b', 'Você não pode'], ['c', 'slug-da-pagina']])).toEqual(['a'])
})

test('a word ending in ó gives no plain form to look for (Se cambió, cambio)', () => {
  const forms = derivedForms(['Se cambió', 'Se pagó', 'Se registró', 'Configuración'], 'es')
  expect([...forms.keys()]).toEqual(['configuracion'])
  expect(unaccentedKeys('es', [['a', 'Confirmar cambio'], ['b', 'Se cambió el plan'], ['c', 'Configuracion']], forms)).toEqual(['c'])
})

test('the Spanish list tells a missing accent from a word that is right as it is', () => {
  const flagged = (text: string) => unaccentedKeys('es', [['k', text]]).length === 1
  for (const wrong of ['Se cambio la contraseña', 'Estas seguro de que quieres salir', 'Esta en uso', 'Como funciona', 'Diseno', 'Asegurate de guardar', 'Regístrate', 'Esta invitación ya no es valida', 'Aun no hay bloques', 'Sin miembros aun', '¿Como funciona?', 'Gestiona quien tiene acceso', 'Configuracion del bloque']) {
    if (wrong === 'Regístrate') expect(flagged(wrong)).toBe(false)
    else expect({ wrong, flagged: flagged(wrong) }).toEqual({ wrong, flagged: true })
  }
  for (const right of ['Se cambió la contraseña', 'Confirmar cambio', 'Estás seguro de que quieres salir', 'Esta página no existe', 'Esta acción no se puede deshacer', 'Como administrador', 'Diseño', 'Asegúrate de guardar', 'Esta invitación ya no es válida', 'Aún no hay bloques', 'Contacta a quien te invitó', '¿Cómo funciona?', 'Configuración del bloque']) {
    expect({ right, flagged: flagged(right) }).toEqual({ right, flagged: false })
  }
})

test('the derived forms catch words the fixed lists do not know, and leave the ambiguous ones', () => {
  const pt = derivedForms(['Configurações do perfil', 'Descrição', 'O último dia'], 'pt')
  expect(unaccentedKeys('pt', [['a', 'Configuracoes'], ['b', 'Descricao do item'], ['c', 'Configurações'], ['d', 'Ultimo dia']], pt)).toEqual(['a', 'b', 'd'])
  const es = derivedForms(['Sesión', 'Configuración', 'Descripción'], 'es')
  expect(unaccentedKeys('es', [['a', 'Configuracion del bloque'], ['b', 'Configuración'], ['c', 'Nueva sesion']], es)).toEqual(['a', 'c'])
  const de = derivedForms(['Zurück', 'Größe', 'Übersicht'], 'de')
  expect(unaccentedKeys('de', [['a', 'Zuruck'], ['b', 'Groesse'], ['c', 'Ubersicht'], ['d', 'Übersicht']], de)).toEqual(['a', 'b', 'c'])
})

test('the derived forms reach well beyond the fixed lists', () => {
  expect(FORMS.pt.size).toBeGreaterThan(300)
  expect(FORMS.es.size).toBeGreaterThan(200)
  expect(FORMS.de.size).toBeGreaterThan(400)
})
