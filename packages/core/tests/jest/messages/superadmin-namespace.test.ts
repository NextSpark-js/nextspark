/**
 * #412: the superadmin area (components/superadmin, routes/superadmin, its docs sidebar and layout) reads every text from
 * the `superadmin` namespace. The six catalogs hold the same keys with the same placeholders, every key the area reads
 * exists, and a fixed text written back into the source of the area fails the scan.
 */
import { describe, test, expect } from '@jest/globals'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'
import en from '@/core/messages/en/index'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import it_ from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'

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

// the namespaces of the area: `superadmin`, and `devtools.gallery` (the style galleries that live in components/superadmin)
const SECTIONS: Array<[string, (catalog: Record<string, any>) => unknown]> = [
  ['superadmin', catalog => catalog.superadmin],
  ['devtools.gallery', catalog => catalog.devtools.gallery],
]
const ENGLISH_OF: Record<string, Record<string, string>> = Object.fromEntries(SECTIONS.map(([name, pick]) => [name, flat(pick(en))]))

describe.each(Object.keys(LOCALES).flatMap(locale => SECTIONS.map(([section, pick]) => [locale, section, pick] as const)))('%s %s messages', (locale, section, pick) => {
  const messages = flat(pick(LOCALES[locale]))
  const ENGLISH = ENGLISH_OF[section]

  test('hold every key of the English catalog', () => {
    expect(Object.keys(ENGLISH).filter(key => !(key in messages))).toEqual([])
  })

  test('use the placeholders and tags of the English text', () => {
    for (const [key, text] of Object.entries(messages)) {
      if (key in ENGLISH) expect({ key, found: placeholders(text) }).toEqual({ key, found: placeholders(ENGLISH[key]) })
    }
  })

  test('have no empty text', () => {
    expect(Object.entries(messages).filter(([, text]) => text.trim() === '').map(([key]) => key)).toEqual([])
  })

  // the English text of a message is not left as it is in the other languages, except what is the same word everywhere
  if (locale !== 'en') {
    test('translate the long texts', () => {
      // a plural of words that are the same in the language (French "permission") is not an untranslated text
      const same = Object.entries(messages).filter(([key, text]) => key in ENGLISH && text === ENGLISH[key] && text.length > 40 && !text.startsWith('{count, plural'))
      expect(same.map(([key]) => key)).toEqual([])
    })
  }
})

// --- the area -----------------------------------------------------------------------------------------------------

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : /\.tsx$/.test(name) ? [full] : []
  })
}

const AREA = [
  ...walk(path.join(SRC, 'components/superadmin')),
  ...walk(path.join(SRC, 'routes/superadmin')),
  ...walk(path.join(SRC, 'components/users')),
  path.join(SRC, 'components/docs/superadmin-docs-sidebar.tsx'),
  path.join(SRC, 'routes/_internal/superadmin-layout.tsx'),
]

const parse = (file: string) => ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
const rel = (file: string) => path.relative(SRC, file)

// What stays as it is: size abbreviations, a type name, product names, demo data (an email) and code
const NOT_TRANSLATABLE = new Set(['XS', 'SM', 'MD', 'LG', 'array', 'console.log("Hello World");', 'React', 'Vue.js', 'Angular', 'Svelte'])
const VISIBLE_ATTRIBUTES = new Set(['placeholder', 'title', 'alt', 'aria-label', 'aria-description', 'label', 'description', 'helpText', 'allLabel'])
const letters = (text: string) => /[A-Za-z]{2}/.test(text)
const translatable = (text: string) => letters(text) && !NOT_TRANSLATABLE.has(text.trim()) && !/@/.test(text)

/** The fixed texts of a source: JSX text, visible attributes with a literal, and sentence-like literals in a ternary, `||`/`??` or `new Error`. */
function fixedTexts(source: ts.SourceFile): string[] {
  const found: string[] = []
  const at = (node: ts.Node, text: string) => found.push(`${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}: ${text.replace(/\s+/g, ' ').trim()}`)
  const insideCode = (node: ts.Node) => {
    for (let p = node.parent; p; p = p.parent) {
      if ((ts.isJsxElement(p) && ['code', 'pre'].includes(p.openingElement.tagName.getText(source)))) return true
    }
    return false
  }
  // starts like a word of a sentence ("Free", "Open it"); a class list or a variant name is lowercase
  const sentence = (text: string) => /^[A-Z][a-z]/.test(text)
  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.text.replace(/\s+/g, ' ').trim()
      if (text && translatable(text) && !insideCode(node)) at(node, text)
    } else if (ts.isJsxAttribute(node) && node.initializer && ts.isStringLiteral(node.initializer) && VISIBLE_ATTRIBUTES.has(node.name.getText(source))) {
      if (translatable(node.initializer.text)) at(node, `${node.name.getText(source)}="${node.initializer.text}"`)
    } else if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const parent = node.parent
      const inTernary = ts.isConditionalExpression(parent) && parent.condition !== node
      const inFallback = ts.isBinaryExpression(parent) && [ts.SyntaxKind.BarBarToken, ts.SyntaxKind.QuestionQuestionToken].includes(parent.operatorToken.kind) && parent.right === node
      const inError = ts.isNewExpression(parent) && parent.expression.getText(source) === 'Error'
      const inProperty = ts.isPropertyAssignment(parent) && VISIBLE_ATTRIBUTES.has(parent.name.getText(source))
      if ((inTernary || inFallback || inError || inProperty) && sentence(node.text) && translatable(node.text)) at(node, node.text)
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return found
}

describe('the roles of a user have a name', () => {
  // the users page and the user detail read `usersPage.roles.<role>` for what the API answers as a user's role
  test.each(Object.keys(LOCALES))('%s', locale => {
    for (const role of ['member', 'developer', 'suspended', 'superadmin']) expect(typeof LOCALES[locale].superadmin.usersPage.roles[role]).toBe('string')
  })
})

describe('the area has no fixed text', () => {
  test('the scan reads the files of the area', () => {
    const names = AREA.map(rel)
    expect(names).toEqual(expect.arrayContaining([
      'components/superadmin/layouts/SuperadminSidebar.tsx',
      'components/docs/superadmin-docs-sidebar.tsx',
      'routes/superadmin/users/page.tsx',
      'routes/superadmin/page.tsx',
    ]))
  })

  test.each(AREA.map(file => [rel(file), file]))('%s', (_name, file) => {
    expect(fixedTexts(parse(file))).toEqual([])
  })

  test('the scan catches a fixed text, a fixed attribute and a fixed fallback', () => {
    const source = ts.createSourceFile(
      'mutation.tsx',
      `export const A = ({ x }: { x: string }) => <div title="Hello there"><p>Plain text</p>{x ? 'Open it' : 'Close it'}{x || 'Unknown'}<code>text-sm</code></div>`,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    )
    expect(fixedTexts(source).map(line => line.replace(/^\d+: /, ''))).toEqual(['title="Hello there"', 'Plain text', 'Open it', 'Close it', 'Unknown'])
  })
})

// --- the keys the area reads --------------------------------------------------------------------------------------

const CATALOGS: Record<string, Record<string, unknown>> = {
  superadmin: en.superadmin as Record<string, unknown>,
  teams: en.teams as Record<string, unknown>,
  common: en.common as Record<string, unknown>,
  devtools: en.devtools as Record<string, unknown>,
}
const lookup = (full: string) => full.split('.').reduce<any>((node, key) => (node && typeof node === 'object' ? node[key] : undefined), CATALOGS)

/** The `t('key')` calls of a source, with the namespace of the `useTranslations`/`getTranslations` they come from. */
function keysRead(source: ts.SourceFile): { key: string; dynamic: boolean }[] {
  const namespaces: Record<string, string> = {}
  const reads: { key: string; dynamic: boolean }[] = []
  const visit = (node: ts.Node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      const init = ts.isAwaitExpression(node.initializer) ? node.initializer.expression : node.initializer
      if (ts.isCallExpression(init) && ['useTranslations', 'getTranslations'].includes(init.expression.getText(source)) && init.arguments[0] && ts.isStringLiteral(init.arguments[0])) {
        namespaces[node.name.text] = init.arguments[0].text
      }
    }
    if (ts.isCallExpression(node)) {
      const callee = node.expression.getText(source).replace(/\.rich$/, '')
      const arg = node.arguments[0]
      if (callee in namespaces && arg) {
        if (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg)) reads.push({ key: `${namespaces[callee]}.${arg.text}`, dynamic: false })
        else if (ts.isTemplateExpression(arg)) reads.push({ key: `${namespaces[callee]}.${arg.head.text}`, dynamic: true })
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return reads
}

describe('the keys the area reads exist', () => {
  test.each(AREA.map(file => [rel(file), file]))('%s', (_name, file) => {
    const reads = keysRead(parse(file))
    // a key built from a variable (`roles.${role}`) names a branch of the catalog: it has to exist and hold strings
    const missing = reads.filter(({ key, dynamic }) => {
      const found = lookup(dynamic ? key.replace(/\.$/, '') : key)
      return dynamic ? !(found && typeof found === 'object') : typeof found !== 'string'
    })
    expect(missing).toEqual([])
  })

  test('the pages read the catalog (a refactor that drops the reads is not a pass)', () => {
    const total = AREA.flatMap(file => keysRead(parse(file))).length
    expect(total).toBeGreaterThan(300)
  })
})
