/**
 * #413: the dashboard, entity and shared components and the routes read their texts from the catalogs. No visible text
 * (JSX text, a visible attribute, a toast, an error message, a default parameter) is written in the source of
 * `src/components` and `src/routes`, every key those files read exists in the six catalogs, the English fallback a
 * component passes to `useCommonText` / `useMessageText` / `useSectionText` is the English text of the catalog, and the
 * messages are valid ICU with the placeholders of the English text.
 *
 * The areas that have a test of their own (`superadmin` #412, `devtools` #414, `auth` #408) are not scanned again.
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
import { API_SCOPES, SCOPE_CATEGORIES } from '@/core/lib/api/keys'
import { brokenMessages, fixedTexts, keysRead, lookupKey, parseSource, walkSource, type NotTranslatable } from './fixed-text-scanner'

const ROOT = path.join(__dirname, '../../..')
const LOCALES = { en, es, de, fr, it: it_, pt } as Record<string, Record<string, any>>

function flat(node: unknown, prefix = ''): Record<string, string> {
  return Object.entries(node as Record<string, unknown>).reduce<Record<string, string>>((all, [key, value]) => {
    if (value && typeof value === 'object') return { ...all, ...flat(value, `${prefix}${key}.`) }
    return { ...all, [`${prefix}${key}`]: String(value) }
  }, {})
}
// an argument opens with `{name}` or `{name,`; the arms of a plural (`one {member}`) are texts, not arguments
const placeholders = (text: string) => [...text.matchAll(/(?<!(?:\bzero|\bone|\btwo|\bfew|\bmany|\bother|=\d+)\s*)\{(\w+)[,}]|<(\w+)>/g)].map(m => m[1] ?? `<${m[2]}>`).sort()

// --- what is scanned ------------------------------------------------------------------------------------------------

// Areas with a namespace test of their own
const OWN_TEST = [/^src\/components\/(superadmin|devtools)\//, /^src\/routes\/(superadmin|devtools|\(auth\))\//, /^src\/routes\/api\//,
  /^src\/routes\/_internal\/(default-auth-layout|auth-layout)\.tsx$/]

// Files that hold data, not texts of the interface: the lists of countries, currencies and time zones carry the names that
// `Intl.DisplayNames` does not give for every locale, and are the subject of their own change
const DATA_FILES: Record<string, string> = {
  'src/components/ui/country-select.tsx': 'a list of country names and dial codes (data)',
  'src/components/ui/currency-select.tsx': 'a list of currency names and codes (data)',
  'src/components/ui/timezone-select.tsx': 'a list of time zone names (data)',
}

// Texts that stay as they are, with the reason
const NOT_TRANSLATABLE: NotTranslatable = {
  POST: 'an HTTP method',
  PATCH: 'an HTTP method',
  YOUR_API_KEY: 'a placeholder inside a code sample',
  'Authorization: Bearer': 'an HTTP header inside a code sample',
  'LayoutGrid': 'the name of an icon',
  AR: 'an ISO country code (the default country of the phone input)',
}

// Texts that stay as they are in one file, with the reason (the same text elsewhere is still a finding)
const FILE_EXCEPTIONS: Record<string, NotTranslatable> = {
  'src/routes/_internal/area-access.tsx': {
    'Authentication required': 'the message of a JSON response to an API client (machine-facing, with its error code)',
    'Access denied: /{} requires the {} role': 'the message of a JSON response to an API client (machine-facing, with its error code)',
  },
  'src/routes/_internal/public-layout.tsx': {
    Application: 'the placeholder meta description of the default public layout, which a project replaces; it is not shown on the page',
  },
  'src/routes/_internal/lemonsqueezy-webhook.ts': {
    'If this deployment runs on test data (staging, a preview), set LEMONSQUEEZY_ACCEPT_TEST_MODE=true.': 'a hint for the operator of the deployment in a webhook error, naming an environment variable',
  },
  'src/routes/_internal/devtools-layout.tsx': {
    DevTools: 'the name of the devtools area, in a static metadata export that a project layout spreads',
    'Development tools and documentation': 'the meta description of the devtools area (noindex), in a static metadata export that a project layout spreads',
  },
  'src/routes/layout.tsx': {
    'NextSpark App': 'the default title of the root layout, which a project replaces with its own name',
    'Built with NextSpark': 'the default meta description of the root layout, which a project replaces',
  },
  'src/routes/layout.ppr.tsx': {
    'NextSpark App': 'the default title of the root layout, which a project replaces with its own name',
    'Built with NextSpark': 'the default meta description of the root layout, which a project replaces',
  },
  'src/routes/dashboard/settings/profile/page.tsx': {
    English: 'the name of a language, written in that language',
    Español: 'the name of a language, written in that language',
  },
}

const files = [...walkSource(path.join(ROOT, 'src/components')), ...walkSource(path.join(ROOT, 'src/routes'))]
  .map(file => path.relative(ROOT, file))
  .filter(rel => !OWN_TEST.some(pattern => pattern.test(rel)) && !(rel in DATA_FILES))

describe('fixed texts in src/components and src/routes', () => {
  test('there are files to scan', () => {
    expect(files.length).toBeGreaterThan(150)
  })

  test.each(files)('%s has no text written in its source', rel => {
    expect(fixedTexts(parseSource(path.join(ROOT, rel)), { ...NOT_TRANSLATABLE, ...FILE_EXCEPTIONS[rel] })).toEqual([])
  })

  test('the scan sees a text written in a component', () => {
    const source = ts.createSourceFile('x.tsx', 'export const A = () => <button title="Save it">Save</button>', ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
    expect(fixedTexts(source).length).toBe(2)
  })
})

// --- the keys the sources read --------------------------------------------------------------------------------------

/** The `useCommonText(section, key, fallback)`, `useMessageText(path, fallback)` and `useSectionText(path, {key: fallback})` calls of a source. */
function fallbackReads(source: ts.SourceFile): Array<{ key: string; fallback: string }> {
  const reads: Array<{ key: string; fallback: string }> = []
  const literal = (node: ts.Node | undefined) => (node && (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) ? node.text : undefined)
  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
      const [a, b, c] = node.arguments
      if (node.expression.text === 'useCommonText' && literal(a) && literal(b) && literal(c) !== undefined) reads.push({ key: `common.${literal(a)}.${literal(b)}`, fallback: literal(c)! })
      if (node.expression.text === 'useMessageText' && literal(a) && literal(b) !== undefined) reads.push({ key: literal(a)!, fallback: literal(b)! })
      if (node.expression.text === 'useSectionText' && literal(a) && b && ts.isObjectLiteralExpression(b)) {
        for (const property of b.properties) {
          if (ts.isPropertyAssignment(property) && literal(property.initializer) !== undefined) reads.push({ key: `${literal(a)}.${ts.isStringLiteral(property.name) ? property.name.text : property.name.getText(source)}`, fallback: literal(property.initializer)! })
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return reads
}

describe('the keys the components read', () => {
  const sources = files.map(rel => [rel, parseSource(path.join(ROOT, rel))] as const)

  test.each(Object.keys(LOCALES))('%s holds every key a component reads', locale => {
    const missing: string[] = []
    for (const [rel, source] of sources) {
      for (const { key, dynamic } of keysRead(source)) {
        // a template (`status.${x}`) reads one of several keys: its fixed head has to lead somewhere
        const found = dynamic ? lookupKey(LOCALES[locale], key.replace(/\.?$/, '').replace(/\.$/, '')) !== undefined || Object.keys(flat(LOCALES[locale])).some(k => k.startsWith(key)) : typeof lookupKey(LOCALES[locale], key) === 'string'
        if (!found) missing.push(`${rel}: ${key}`)
      }
      for (const { key } of fallbackReads(source)) {
        if (typeof lookupKey(LOCALES[locale], key) !== 'string') missing.push(`${rel}: ${key}`)
      }
    }
    expect(missing).toEqual([])
  })

  test('the English fallback of a component is the English text of the catalog', () => {
    const different: string[] = []
    for (const [rel, source] of sources) {
      for (const { key, fallback } of fallbackReads(source)) {
        const text = lookupKey(en, key)
        if (typeof text === 'string' && text !== fallback) different.push(`${rel}: ${key}: ${JSON.stringify(fallback)} vs ${JSON.stringify(text)}`)
      }
    }
    expect(different).toEqual([])
  })
})

// --- the catalogs ---------------------------------------------------------------------------------------------------

// `devtools` has its own check (#414)
const ENGLISH = flat(Object.fromEntries(Object.entries(en).filter(([ns]) => ns !== 'devtools')))

describe.each(Object.keys(LOCALES))('%s catalog', locale => {
  const messages = flat(Object.fromEntries(Object.entries(LOCALES[locale]).filter(([ns]) => ns !== 'devtools')))

  test('every message is valid ICU and quotes no placeholder', () => {
    expect(brokenMessages(messages, locale)).toEqual([])
  })

  test('every message holds the placeholders and tags of the English text', () => {
    const different: string[] = []
    for (const [key, text] of Object.entries(messages)) {
      if (key in ENGLISH && placeholders(text).join() !== placeholders(ENGLISH[key]).join()) different.push(`${key}: ${placeholders(text)} vs ${placeholders(ENGLISH[key])}`)
    }
    expect(different).toEqual([])
  })
})

// --- the scopes of the API keys dialog ------------------------------------------------------------------------------

describe('the scope texts of the API keys dialog', () => {
  test.each(Object.keys(LOCALES))('%s has the text of every scope and category of lib/api/keys', locale => {
    const missing: string[] = []
    for (const scope of Object.keys(API_SCOPES)) {
      if (typeof lookupKey(LOCALES[locale], `settings.apiKeys.scopeLabels.${scope}`) !== 'string') missing.push(scope)
    }
    for (const [key, category] of Object.entries(SCOPE_CATEGORIES)) {
      for (const field of ['name', 'description'] as const) {
        if (typeof lookupKey(LOCALES[locale], `settings.apiKeys.scopeCategories.${key}.${field}`) !== 'string') missing.push(`${key}.${field} (${category[field]})`)
      }
    }
    expect(missing).toEqual([])
  })

  test('the English text is the one in lib/api/keys', () => {
    for (const [scope, text] of Object.entries(API_SCOPES)) expect(lookupKey(en, `settings.apiKeys.scopeLabels.${scope}`)).toBe(text)
    for (const [key, category] of Object.entries(SCOPE_CATEGORIES)) {
      expect(lookupKey(en, `settings.apiKeys.scopeCategories.${key}.name`)).toBe(category.name)
      expect(lookupKey(en, `settings.apiKeys.scopeCategories.${key}.description`)).toBe(category.description)
    }
  })
})
