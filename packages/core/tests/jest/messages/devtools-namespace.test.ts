/**
 * #414: the devtools area (components/devtools, routes/devtools) reads every text from the `devtools` namespace. The six
 * catalogs hold the same keys with the same placeholders and valid ICU, every key the area reads exists, and a fixed
 * text written back into the source of the area fails the scan (the scanner lives in ./fixed-text-scanner).
 */
import { describe, test, expect } from '@jest/globals'
import path from 'node:path'
import ts from 'typescript'
import en from '@/core/messages/en/index'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import it_ from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'
import { brokenMessages, fixedTexts, keysRead, lookupKey, parseSource, walkSource, type NotTranslatable } from './fixed-text-scanner'

const LOCALES = { en, es, de, fr, it: it_, pt } as Record<string, Record<string, any>>
const SRC = path.join(__dirname, '../../../src')

function flat(node: unknown, prefix = ''): Record<string, string> {
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>((all, [key, value]) => {
    if (value && typeof value === 'object') return { ...all, ...flat(value, `${prefix}${key}.`) }
    return { ...all, [`${prefix}${key}`]: String(value) }
  }, {})
}

// `{name}` placeholders (not the words of a plural branch) and rich tags
const placeholders = (text: string) =>
  [...text.matchAll(/(?<!\b(?:one|other|few|many|zero|two) )\{(\w+)[,}]|<(\w+)>/g)].map(m => m[1] ?? `<${m[2]}>`).sort()

const ENGLISH = flat(en.devtools)

describe.each(Object.keys(LOCALES))('%s devtools messages', locale => {
  const messages = flat(LOCALES[locale].devtools)

  test('hold every key of the English catalog', () => {
    expect(Object.keys(ENGLISH).filter(key => !(key in messages))).toEqual([])
  })

  test('hold no key the English catalog lacks', () => {
    expect(Object.keys(messages).filter(key => !(key in ENGLISH))).toEqual([])
  })

  test('use the placeholders and tags of the English text', () => {
    for (const [key, text] of Object.entries(messages)) {
      if (key in ENGLISH) expect({ key, found: placeholders(text) }).toEqual({ key, found: placeholders(ENGLISH[key]) })
    }
  })

  test('are valid ICU and quote no placeholder', () => {
    expect(brokenMessages(messages, locale)).toEqual([])
  })

  test('have no empty text', () => {
    expect(Object.entries(messages).filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([])
  })

  if (locale !== 'en') {
    test('translate the long texts', () => {
      const same = Object.entries(messages).filter(([key, text]) => key in ENGLISH && text === ENGLISH[key] && text.length > 40 && !text.startsWith('{count, plural'))
      expect(same.map(([key]) => key)).toEqual([])
    })
  }
})

// --- the area -----------------------------------------------------------------------------------------------------

const AREA = [...walkSource(path.join(SRC, 'components/devtools')), ...walkSource(path.join(SRC, 'routes/devtools'))]
const rel = (file: string) => path.relative(SRC, file)

// What stays as it is, each with its reason: technical values a developer reads as they are on the wire or in the code
const NOT_TRANSLATABLE: NotTranslatable = {
  GET: 'HTTP method, a protocol token',
  POST: 'HTTP method, a protocol token',
  PUT: 'HTTP method, a protocol token',
  PATCH: 'HTTP method, a protocol token',
  DELETE: 'HTTP method, a protocol token',
  OPTIONS: 'HTTP method, a protocol token',
  ms: 'unit symbol of a response time',
  ID: 'the identifier column label is the same in the six languages',
  EN: 'language code of the BDD document the toggle switches to',
  ES: 'language code of the BDD document the toggle switches to',
  'Next.js 14': 'product name and version in the technical specifications',
  'Tailwind CSS': 'product name in the technical specifications',
  'Radix UI': 'product name in the technical specifications',
  'Lucide React': 'product name in the technical specifications',
  'CSS Variables': 'technical term of the specifications, as the code names it',
  Turbo: 'product name in the technical specifications',
  'TC-{}': 'prefix of a generated test-case id (the {} is the number), data and not a text',
}

describe('the area has no fixed text', () => {
  test('the scan reads the files of the area, .ts and .tsx', () => {
    expect(AREA.map(rel)).toEqual(expect.arrayContaining([
      'components/devtools/DevtoolsSidebar.tsx',
      'components/devtools/api-explorer/ApiExplorer.tsx',
      'components/devtools/api-tester/hooks/useApiRequest.ts',
      'components/devtools/bdd/parser.ts',
      'routes/devtools/style/page.tsx',
      'routes/devtools/page.tsx',
    ]))
  })

  test.each(AREA.map(file => [rel(file), file]))('%s', (_name, file) => {
    expect(fixedTexts(parseSource(file), NOT_TRANSLATABLE)).toEqual([])
  })
})

describe('the scan catches', () => {
  const scan = (code: string, notTranslatable: NotTranslatable = {}) =>
    fixedTexts(ts.createSourceFile('mutation.tsx', code, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), notTranslatable).map(line => line.replace(/^\d+: /, ''))

  test.each([
    ['a JSX text', '<p>Plain text</p>', ['Plain text']],
    ['a visible attribute', '<div title="Hello there" />', ['title="Hello there"']],
    ['a visible attribute with a literal in braces', "<div title={'Hello there'} />", ['Hello there']],
    ['a visible attribute with a template', '<div title={`Hello ${x}`} />', ['Hello {}']],
    ['a visible attribute with a template and no substitution', '<div title={`Hello there`} />', ['Hello there']],
    ['a literal as a JSX child', "<p>{'Hello there'}</p>", ['Hello there']],
    ['a template as a JSX child', '<p>{`Hello ${x} there`}</p>', ['Hello {} there']],
    ['a template that starts with a substitution', '<p>{`${n} members`}</p>', ['{} members']],
    ['a ternary branch', "const a = x ? 'Open it' : 'Close it'", ['Open it', 'Close it']],
    ['a fallback', "const a = x || 'Unknown'", ['Unknown']],
    ['a conditional text', "const a = x && 'Unknown'", ['Unknown']],
    ['an acronym sentence in a fallback', "const a = x ?? 'API key missing'", ['API key missing']],
    ['a toast', "toast('Saved'); toast.error('Copy failed'); toast.success('Done'); toast.loading('Please wait')", ['Saved', 'Copy failed', 'Done', 'Please wait']],
    ['a toast with a template', 'toast.error(`Copy failed: ${x}`)', ['Copy failed: {}']],
    ['setError with an acronym', "setError('API key missing')", ['API key missing']],
    ['a lowercase toast', "toast.info('saved')", ['saved']],
    ['a concatenation', "const a = 'Failed: ' + message", ['Failed:']],
    ['new Error', "throw new Error('Failed to load')", ['Failed to load']],
    ['a Record of texts', "const NAMES: Record<string, string> = { a: 'Layers', b: 'Roles' }", ['Layers', 'Roles']],
    ['a visible property', "const a = { label: 'Core', message: 'Nothing here' }", ['Core', 'Nothing here']],
    ['a default parameter', "function f(label = 'Resize panels') {}", ['Resize panels']],
    ['a destructuring default', "function f({ label = 'Resize panels' }: P) {}", ['Resize panels']],
    ['a date formatted for a fixed locale', "const a = d.toLocaleString('es-ES', {}); const b = new Intl.NumberFormat('de')", ["fixed locale 'es-ES'", "fixed locale 'de'"]],
    ['a text with an @', '<p>Write to the team @ the office</p>', ['Write to the team @ the office']],
  ])('%s', (_name, code, expected) => {
    expect(scan(code)).toEqual(expected)
  })

  test('and leaves the code, the exceptions and the demo data alone', () => {
    expect(scan("<code>text-sm</code>; <p>{x}</p>; <p>GET</p>; <p>a@b.com</p>; const c = x ? 'bg-red-500 text' : 'flex'; const R: Record<string, string> = { a: 'bg-muted' }", { GET: 'protocol token' })).toEqual([])
  })
})

describe('the messages check catches', () => {
  test('a quoted placeholder and a broken ICU message', () => {
    expect(brokenMessages({ a: "The file '{path}' does not exist", b: 'Hello {name', c: 'Hello {name}' }, 'en').map(line => line.split(':')[0])).toEqual(['a', 'b'])
  })
})

// --- the keys the area reads --------------------------------------------------------------------------------------

const CATALOGS: Record<string, Record<string, unknown>> = {
  devtools: en.devtools as Record<string, unknown>,
  common: en.common as Record<string, unknown>,
  superadmin: en.superadmin as Record<string, unknown>,
  teams: en.teams as Record<string, unknown>,
}

describe('the keys the area reads exist', () => {
  test.each(AREA.map(file => [rel(file), file]))('%s', (_name, file) => {
    const reads = keysRead(parseSource(file))
    // a key built from a variable (`roles.${role}`) names a branch of the catalog: it has to exist and hold strings
    const missing = reads.filter(({ key, dynamic }) => {
      const found = lookupKey(CATALOGS, dynamic ? key.replace(/\.$/, '') : key)
      return dynamic ? !(found && typeof found === 'object') : typeof found !== 'string'
    })
    expect(missing).toEqual([])
  })

  test('the pages read the catalog (a refactor that drops the reads is not a pass)', () => {
    const total = AREA.flatMap(file => keysRead(parseSource(file))).length
    expect(total).toBeGreaterThan(200)
  })
})
