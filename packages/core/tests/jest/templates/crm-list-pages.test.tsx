/**
 * @jest-environment jsdom
 *
 * The list pages of the crm template in Spanish and German (#422): titles, columns, stats and the empty state come from the
 * template catalog, and the totals of NUMERIC columns (which the API sends as strings) are numbers, formatted in the locale.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render, screen, waitFor } from '@testing-library/react'

const CRM = path.join(__dirname, '../../../templates/projects/crm')
const catalog = (locale: string) => JSON.parse(readFileSync(path.join(CRM, `messages/${locale}.json`), 'utf8'))

let mockLocale = 'es'
let mockRows: unknown[] = []

/** The ICU subset the list catalogs use: `{name}` and `{count, plural, one {..} other {..}}` (the catalog test checks the real syntax). */
function format(text: string, values: Record<string, unknown> = {}): string {
  const plural = (_: string, name: string, body: string) => {
    const options = Object.fromEntries([...body.matchAll(/(\w+)\s*\{([^}]*)\}/g)].map(m => [m[1], m[2]]))
    const category = new Intl.PluralRules(mockLocale).select(Number(values[name]))
    return (options[category] ?? options.other).replace('#', String(values[name]))
  }
  return text
    .replace(/\{(\w+), plural, ((?:\w+ \{[^}]*\}\s*)+)\}/g, plural)
    .replace(/\{(\w+)\}/g, (_, name) => String(values[name]))
}

jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: (namespace: string) => (key: string, values?: Record<string, unknown>) => {
    const node = `${namespace}.${key}`.split('.').reduce((n: any, part) => n?.[part], catalog(mockLocale))
    if (typeof node !== 'string') throw new Error(`missing message ${namespace}.${key} in ${mockLocale}`)
    return format(node, values)
  },
}))
jest.mock('@nextsparkjs/core/contexts/TeamContext', () => ({ useTeamContext: () => ({ currentTeam: { id: 't1' }, isLoading: false }) }))
jest.mock('@nextsparkjs/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@nextsparkjs/core/components/permissions/PermissionGate', () => ({ PermissionGate: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('@nextsparkjs/core/lib/api/entities', () => ({
  fetchWithTeam: async () => ({ ok: true, json: async () => ({ data: mockRows }) }),
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

import ContactsPage from '../../../templates/projects/crm/templates/dashboard/(main)/contacts/page'
import OpportunitiesPage from '../../../templates/projects/crm/templates/dashboard/(main)/opportunities/page'
import ProductsPage from '../../../templates/projects/crm/templates/dashboard/(main)/products/page'
import { sumNumeric, toNumber } from '../../../templates/projects/crm/lib/crm-utils'

const text = (locale: string, key: string) => key.split('.').reduce((n: any, part) => n[part], catalog(locale).crm.list) as string

describe.each([['es'], ['de']])('contacts list in %s', locale => {
  beforeEach(() => {
    mockLocale = locale
    mockRows = []
  })

  test('shows the title, the stats and the empty state of the catalog', async () => {
    render(<ContactsPage />)
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(text(locale, 'contacts.title'))
    expect(screen.getByText(text(locale, 'contacts.stats.withCompany'))).toBeTruthy()
    await waitFor(() => expect(screen.getByText(text(locale, 'contacts.empty'))).toBeTruthy())
    expect(screen.getByText(text(locale, 'contacts.emptyDescription'))).toBeTruthy()
    expect(screen.getByPlaceholderText(text(locale, 'contacts.search'))).toBeTruthy()
    expect(document.body.textContent).not.toMatch(/Manage your business contacts|No contacts yet|Total Contacts/)
  })

  test('the last activity is a date in the locale, and "never" is translated', async () => {
    mockRows = [
      { id: 'a', firstName: 'Ana', lastName: 'Ruiz', email: 'a@example.com' },
      { id: 'b', firstName: 'Bo', lastName: 'Lee', email: 'b@example.com', lastActivityAt: new Date(Date.now() - 86_400_000).toISOString() },
    ]
    render(<ContactsPage />)
    await waitFor(() => expect(screen.getByText(text(locale, 'common.never'))).toBeTruthy())
    // "yesterday" in the language of the page, not the English word
    expect(document.body.textContent).toContain(new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(-1, 'day'))
    expect(document.body.textContent).not.toMatch(/Never|Yesterday/)
  })
})

describe.each([
  ['es', /2\.234\.568/],
  ['de', /2\.234\.568/],
])('totals over NUMERIC strings in %s', (locale, grouped) => {
  beforeEach(() => {
    mockLocale = locale
  })

  test('the pipeline value adds strings as numbers', async () => {
    mockRows = [
      { id: 'o1', name: 'A', amount: '1234567.50', probability: '50.00' },
      { id: 'o2', name: 'B', amount: '1000000', probability: '70' },
      { id: 'o3', name: 'C', amount: 'not a number' },
    ]
    render(<OpportunitiesPage />)
    await waitFor(() => expect(screen.getAllByText(grouped).length).toBeGreaterThan(0))
    expect(document.body.textContent).not.toContain('NaN')
  })

  test('the average price adds strings as numbers and skips the invalid ones', async () => {
    mockRows = [
      { id: 'p1', name: 'A', price: '1000.00', status: 'active', salesCount: '2' },
      { id: 'p2', name: 'B', price: '3000.50', status: 'active', salesCount: 1 },
      { id: 'p3', name: 'C', price: 'n/a', status: 'inactive' },
    ]
    render(<ProductsPage />)
    // average of 1000 and 3000.50 = 2000.25 (the invalid one is out of the count), revenue = 2*1000 + 3000.50
    const average = new Intl.NumberFormat(locale, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(2000.25)
    await waitFor(() => expect(document.body.textContent).toContain(average))
    expect(document.body.textContent).not.toContain('NaN')
  })
})

describe('sumNumeric', () => {
  test('reads numeric strings and ignores what is not a number', () => {
    expect(sumNumeric(['10.50', 2, null, undefined, '', 'abc', NaN, Infinity, '1e2'])).toBe(112.5)
    expect(sumNumeric([])).toBe(0)
    expect(toNumber('7')).toBe(7)
    expect(toNumber(' ')).toBeNull()
  })
})
