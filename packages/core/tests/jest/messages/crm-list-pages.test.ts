/**
 * #422: the list pages of the crm template (and the sidebar, the table and the activity components they render), the top
 * bar and the opportunity and pipeline forms read their texts from the `crm.list`, `crm.topBar` and `crm.forms` namespaces
 * of the template catalogs, in every locale the template ships. The scan finds the texts written in the source; the catalog
 * checks compare the keys the sources read with the catalogs.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { brokenMessages, fixedTexts, keysRead, lookupKey, parseSource, type NotTranslatable } from './fixed-text-scanner'

const CRM = path.join(__dirname, '../../../templates/projects/crm')
const PAGES = ['contacts', 'leads', 'companies', 'opportunities', 'activities', 'pipelines', 'products', 'campaigns']
// the detail, create and edit pages and the other forms are outside this change
const FILES = [
  ...PAGES.map(page => `templates/dashboard/(main)/${page}/page.tsx`),
  'templates/dashboard/(main)/activities/components/ActivityCard.tsx',
  'templates/dashboard/(main)/activities/components/ActivityTimeline.tsx',
  'templates/shared/CRMSidebar.tsx',
  'templates/shared/CRMDataTable.tsx',
  'templates/shared/CRMTopBar.tsx',
  'templates/shared/OpportunityForm.tsx',
  'templates/shared/PipelineForm.tsx',
]
const LOCALES = ['en', 'es', 'de', 'pt', 'fr', 'it']

const STAYS: NotTranslatable = {
  USD: 'an ISO currency code, the default of the amount formatter',
  SalesHub: 'the product name in the sidebar header',
  'CRM Pro': 'the product tagline in the sidebar header',
  ESC: 'the name of a key on the keyboard',
  POST: 'an HTTP method',
  PATCH: 'an HTTP method',
  'Failed to load opportunity': 'the message of an Error that is only logged to the console',
  'Failed to save opportunity': 'the message of an Error that is only logged to the console',
  'Failed to load pipeline': 'the message of an Error that is only logged to the console',
  'Failed to save pipeline': 'the message of an Error that is only logged to the console',
  ...Object.fromEntries(
    PAGES.map(page => [`Failed to fetch ${page}`, 'the message of an Error that is only logged to the console']),
  ),
}

const catalog = (locale: string) => JSON.parse(readFileSync(path.join(CRM, `messages/${locale}.json`), 'utf8'))

const leaves = (node: unknown, prefix = ''): Record<string, string> =>
  typeof node === 'string'
    ? { [prefix]: node }
    : Object.entries(node as object).reduce((all, [key, value]) => ({ ...all, ...leaves(value, prefix ? `${prefix}.${key}` : key) }), {})

describe('the amounts and percentages of the crm lists follow the locale', () => {
  const source = (page: string) => readFileSync(path.join(CRM, `templates/dashboard/(main)/${page}/page.tsx`), 'utf8')

  test('the margin of a product is a percentage formatted for the locale, not a toFixed with a fixed "%"', () => {
    expect(source('products')).not.toMatch(/toFixed\(/)
    expect(source('products')).toMatch(/style: 'percent'/)
  })

  test('the budget of a campaign is a currency amount, not a number after a fixed "$"', () => {
    expect(source('campaigns')).not.toMatch(/\$\{formatLocaleNumber/)
    expect(source('campaigns')).toMatch(/style: 'currency'/)
  })
})

describe('the crm list pages write no text in the source', () => {
  test.each(FILES)('%s', file => {
    expect(fixedTexts(parseSource(path.join(CRM, file)), STAYS)).toEqual([])
  })

  test('the scan finds a title written in a page (the check is not vacuous)', () => {
    const source = parseSource(path.join(CRM, FILES[0]))
    const found = fixedTexts(source)
    expect(found.some(line => line.includes('Failed to fetch contacts'))).toBe(true)
  })
})

describe('the keys the list pages read are in every catalog', () => {
  const reads = FILES.flatMap(file => keysRead(parseSource(path.join(CRM, file))))
    .filter(read => read.key.startsWith('crm.'))

  test('the pages, the top bar and the forms read their keys from the crm namespaces', () => {
    expect(reads.length).toBeGreaterThan(150)
  })

  test.each(LOCALES)('%s has each key', locale => {
    const messages = catalog(locale)
    const missing = reads.filter(read => {
      const value = lookupKey(messages, read.key.replace(/\.$/, ''))
      // a template key (`filters.${type}`) names a group of messages
      return read.dynamic ? !(value && typeof value === 'object') : typeof value !== 'string'
    })
    expect(missing).toEqual([])
  })

  test.each(LOCALES)('%s has the group of each template key complete', locale => {
    const groups = {
      'crm.list.activities.filters.': ['all', 'call', 'email', 'meeting', 'task', 'note'],
      'crm.list.activities.status.': ['scheduled', 'in_progress', 'completed', 'cancelled', 'overdue', 'unknown'],
      'crm.forms.opportunity.currencies.': ['USD', 'EUR', 'GBP', 'MXN', 'CAD'],
      'crm.forms.opportunity.types.': ['new_business', 'existing_business', 'renewal', 'upgrade', 'downgrade'],
      'crm.forms.opportunity.sources.': ['web', 'referral', 'cold_call', 'trade_show', 'social_media', 'email', 'advertising', 'partner', 'other'],
      'crm.forms.opportunity.statuses.': ['open', 'won', 'lost', 'abandoned'],
      'crm.forms.pipeline.types.': ['sales', 'support', 'project', 'custom'],
      'crm.forms.opportunity.title.': ['create', 'edit'],
      'crm.forms.opportunity.subtitle.': ['create', 'edit'],
      'crm.forms.pipeline.title.': ['create', 'edit'],
      'crm.forms.pipeline.subtitle.': ['create', 'edit'],
      'crm.list.sidebar.nav.': ['dashboard', 'leads', 'contacts', 'companies', 'pipelines', 'products', 'campaigns', 'activities', 'settings'],
    }
    for (const [prefix, names] of Object.entries(groups)) {
      for (const name of names) expect(typeof lookupKey(catalog(locale), prefix + name)).toBe('string')
    }
  })
})

describe.each(['list', 'topBar', 'forms'])('the crm.%s catalogs', group => {
  const english = Object.keys(leaves(catalog('en').crm[group])).sort()

  test.each(LOCALES)('%s has the keys of English, valid ICU', locale => {
    const messages = leaves(catalog(locale).crm[group])
    expect(Object.keys(messages).sort()).toEqual(english)
    expect(brokenMessages(messages, locale)).toEqual([])
  })

  // a few words are the same in a language (Name, Contacts, Status), but a catalog copied from English is not translated
  test.each(LOCALES.filter(locale => locale !== 'en'))('%s translates most of the texts', locale => {
    const base = leaves(catalog('en').crm[group])
    const messages = leaves(catalog(locale).crm[group])
    const same = Object.keys(base).filter(key => messages[key] === base[key])
    expect(same.length / Object.keys(base).length).toBeLessThan(0.15)
  })
})
