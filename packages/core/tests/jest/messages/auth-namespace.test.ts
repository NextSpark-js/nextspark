/**
 * #401: the auth pages and layout read their texts from the `auth` namespace, so every locale of the core catalog
 * holds every key (a missing one shows its key, or the key's path, to the visitor), with the same placeholders.
 */
import { describe, test, expect } from '@jest/globals'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import en from '@/core/messages/en/index'
import es from '@/core/messages/es/index'
import de from '@/core/messages/de/index'
import fr from '@/core/messages/fr/index'
import it_ from '@/core/messages/it/index'
import pt from '@/core/messages/pt/index'

const LOCALES = { en, es, de, fr, it: it_, pt } as Record<string, Record<string, any>>

function flat(node: unknown, prefix = ''): Record<string, string> {
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>((all, [key, value]) => {
    if (value && typeof value === 'object') return { ...all, ...flat(value, `${prefix}${key}.`) }
    return { ...all, [`${prefix}${key}`]: String(value) }
  }, {})
}

const placeholders = (text: string) => [...text.matchAll(/\{(\w+)[,}]|<(\w+)>/g)].map(m => m[1] ?? `<${m[2]}>`).sort()

const ENGLISH = flat(en.auth)

// Texts a visitor reads that are written in the source: a visible attribute with a literal, or a literal after `?`, `:`, `||`
// or `??` that starts like a sentence. Values that are not translatable (a masked password, an example email) are allowed.
const NOT_TRANSLATABLE = new Set(['name@example.com', 'email@example.com'])
function fixedTexts(source: string): string[] {
  const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  const attributes = [...code.matchAll(/\b(?:placeholder|aria-label|title|alt|label)=(?:"([^"]*)"|'([^']*)'|\{\s*(?:'([^']*)'|"([^"]*)"|`([^`$]*)`)\s*\})/g)]
  const expressions = [...code.matchAll(/(?:\?\?|\|\||\?|:)\s*(?:'([A-Z][a-z][^']*)'|"([A-Z][a-z][^"]*)"|`([A-Z][a-z][^`$]*)`)/g)]
  return [...attributes, ...expressions]
    .filter(m => {
      const value = m.slice(1).find(group => group !== undefined) ?? ''
      return /[A-Za-z]/.test(value) && !NOT_TRANSLATABLE.has(value)
    })
    .map(m => m[0])
}

describe.each(Object.keys(LOCALES))('%s auth messages', locale => {
  const messages = flat(LOCALES[locale].auth)

  test('hold every key of the English catalog', () => {
    expect(Object.keys(ENGLISH).filter(key => !(key in messages))).toEqual([])
  })

  test('use the placeholders and tags of the English text', () => {
    for (const [key, text] of Object.entries(messages)) {
      if (key in ENGLISH) expect({ key, found: placeholders(text) }).toEqual({ key, found: placeholders(ENGLISH[key]) })
    }
  })
})

// The pages and layout of (auth) that read the namespace, with the prefix their useTranslations/getAuthTranslations has
const READERS: Array<[string, string]> = [
  ['src/routes/(auth)/accept-invite/[token]/page.tsx', 'auth.acceptInvite'],
  ['src/routes/(auth)/forgot-password/page.tsx', 'auth'],
  ['src/routes/(auth)/reset-password/page.tsx', 'auth.resetPassword'],
  ['src/routes/(auth)/verify-email/page.tsx', 'auth.verifyEmail'],
  ['src/routes/_internal/default-auth-layout.tsx', 'auth.layout'],
  ['src/routes/_internal/auth-layout.tsx', 'auth.metadata'],
]

describe('the keys the auth pages read', () => {
  test.each(READERS)('%s only reads keys the catalog holds', (file, prefix) => {
    const source = readFileSync(path.join(__dirname, '../../..', file), 'utf8')
    const used = [...source.matchAll(/\b(?:t|tRef\.current)(?:\.rich)?\(\s*['"]([\w.]+)['"]/g)].map(m => `${prefix}.${m[1]}`.replace(/^auth\./, ''))
    expect(used.length).toBeGreaterThan(0)
    expect(used.filter(key => !(`${key}` in ENGLISH))).toEqual([])
  })

  // A text written in the JSX of a client page is English for everyone: it goes through t()
  test.each(READERS.slice(0, 4).map(([file]) => file))('%s has no literal text in its JSX', file => {
    const source = readFileSync(path.join(__dirname, '../../..', file), 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '')
    expect([...source.matchAll(/>\s*[A-Za-z][^<{]*</g)].map(m => m[0].trim())).toEqual([])
  })

  // #408: nor in a visible attribute, nor in a ternary or a fallback
  test.each([...READERS.slice(0, 4).map(([file]) => file), 'src/components/auth/forms/LoginForm.tsx', 'src/components/auth/forms/SignupForm.tsx'])(
    '%s has no fixed text in attributes or expressions',
    file => {
      expect(fixedTexts(readFileSync(path.join(__dirname, '../../..', file), 'utf8'))).toEqual([])
    },
  )

  test('fixedTexts catches a fixed placeholder, a ternary and a fallback, and lets non-translatable values through', () => {
    expect(fixedTexts('<Input placeholder="Enter your email" />')).toEqual(['placeholder="Enter your email"'])
    expect(fixedTexts("<Input aria-label={'Email address'} title='Your email' />")).toHaveLength(2)
    expect(fixedTexts("<h2>{sent ? 'Reset Password' : t('x')}</h2>")).toEqual(["? 'Reset Password'"])
    expect(fixedTexts("{sent ? t('x') : 'Reset Password'}")).toEqual([": 'Reset Password'"])
    expect(fixedTexts("setMessage(error || 'Unknown error'); name ?? `Guest user`")).toHaveLength(2)
    expect(fixedTexts('<Input placeholder="••••••••" /><Input placeholder="name@example.com" /><a title={t("x")} />')).toEqual([])
    expect(fixedTexts("fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' } })")).toEqual([])
  })

  test('the success message of forgot-password is one message with a tag, not two concatenated texts', () => {
    const source = readFileSync(path.join(__dirname, '../../..', 'src/routes/(auth)/forgot-password/page.tsx'), 'utf8')
    expect(source).toContain("t.rich('forgotPassword.success.description'")
    expect(source).not.toMatch(/t\('forgotPassword\.success\.description'\)/)
    for (const locale of Object.keys(LOCALES)) {
      expect(flat(LOCALES[locale].auth)['forgotPassword.success.description']).toContain('<email>{address}</email>')
    }
  })

  // #408: German and Portuguese were written without their diacritics
  test.each([
    ['de', /Bestaetig|pruef|Pruef|fuer\b|ueberpruef|Ueberpruef|Zurueck|zurueck|Druecken|ungueltig|Ungueltig|spaeter|muessen|Mueller|Grossbuch|Oeffnen|laeuft|laueft/],
    ['pt', /\b(?:nao|Nao|Voce|Ja|ja|opcoes|invalid[oa]s?|Usuario|autenticacao|informacoes|comecar|condicoes|verificacao|necessario|botao|faca|endereco|recuperacao|conexao|maiuscula|minuscula|numero|pagina|Ultimo|Joao)\b/],
  ] as Array<[string, RegExp]>)('%s auth messages are written with their diacritics', (locale, unaccented) => {
    const messages = flat(LOCALES[locale].auth)
    expect(Object.entries(messages).filter(([, text]) => unaccented.test(text)).map(([key]) => key)).toEqual([])
  })

  test('the metadata of the pages names keys the catalog holds', () => {
    for (const [file, keys] of [
      ['src/routes/(auth)/login/page.tsx', ['login.title', 'login.description']],
      ['src/routes/(auth)/signup/page.tsx', ['signup.title', 'signup.description']],
      ['src/routes/(auth)/auth-error/page.tsx', ['error.generic.title', 'error.generic.description']],
    ] as Array<[string, string[]]>) {
      const source = readFileSync(path.join(__dirname, '../../..', file), 'utf8')
      for (const key of keys) {
        expect(source).toContain(`'${key}'`)
        expect(ENGLISH).toHaveProperty([key])
      }
    }
  })
})
