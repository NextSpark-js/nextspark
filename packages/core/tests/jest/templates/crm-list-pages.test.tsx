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
// the rows of an endpoint other than the one the page lists (the lookups of the company names and counters)
let mockOther: Record<string, unknown[]> = {}

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
// like the API: `ids` and `companyId` pick rows, `page` and `limit` slice (at most 100) and `info` (createApiResponse) says if there is a next page
const mockCalls: string[] = []
jest.mock('@nextsparkjs/core/lib/api/entities', () => ({
  fetchWithTeam: async (url: string) => {
    mockCalls.push(url)
    const [path, query = ''] = url.split('?')
    const params = new URLSearchParams(query)
    let rows = (mockOther[path] ?? mockRows) as { id: string }[]
    if (params.has('ids')) {
      const ids = params.get('ids')!.split(',')
      return { ok: true, json: async () => ({ data: rows.filter(row => ids.includes(row.id)) }) }
    }
    if (params.has('companyId')) {
      const wanted = params.get('companyId')!.split(',')
      rows = rows.filter(row => wanted.includes((row as { companyId?: string }).companyId ?? ''))
    }
    const limit = Math.min(Number(params.get('limit') ?? 10), 100)
    const page = Number(params.get('page') ?? 1)
    const total = rows.length
    rows = rows.slice((page - 1) * limit, page * limit)
    return { ok: true, json: async () => ({ data: rows, info: { timestamp: 'now', page, limit, total, hasNextPage: page * limit < total } }) }
  },
}))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))

import CompaniesPage from '../../../templates/projects/crm/templates/dashboard/(main)/companies/page'
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

describe('what the API sends: the columns of the table (#422)', () => {
  beforeEach(() => {
    mockLocale = 'es'
    mockRows = []
    mockOther = {}
  })
  afterEach(() => {
    mockOther = {}
  })

  test('a contact shows the name of its company, which the API sends only as an id', async () => {
    mockRows = [{ id: 'c1', firstName: 'Ana', lastName: 'Ruiz', email: 'a@example.com', companyId: 'co1' }]
    mockOther = { '/api/v1/contacts': mockRows, '/api/v1/companies': [{ id: 'co1', name: 'Acme Corp' }] }
    render(<ContactsPage />)
    await waitFor(() => expect(screen.getAllByText('Acme Corp').length).toBeGreaterThan(0))
  })

  test('the counters of a company come from its contacts and its open opportunities', async () => {
    mockRows = [{ id: 'co1', name: 'Acme' }, { id: 'co2', name: 'Globex' }]
    mockOther = {
      '/api/v1/companies': mockRows,
      '/api/v1/contacts': [{ id: 'c1', companyId: 'co1' }, { id: 'c2', companyId: 'co1' }, { id: 'c3', companyId: 'co2' }],
      '/api/v1/opportunities': [
        { id: 'o1', companyId: 'co1', amount: '1000.00', status: 'open' },
        { id: 'o2', companyId: 'co1', amount: '5000', status: 'won' },
        { id: 'o3', companyId: 'co2', amount: 250, status: 'open' },
      ],
    }
    render(<CompaniesPage />)
    // 3 contacts, 3 opportunities, 1250 of open pipeline
    const pipeline = new Intl.NumberFormat('es', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(1250)
    await waitFor(() => expect(document.body.textContent).toContain(pipeline))
    expect(screen.getAllByText('3').length).toBeGreaterThanOrEqual(2)
  })

  test('a product is active by its isActive column, and the active ones are counted', async () => {
    mockRows = [
      { id: 'p1', name: 'A', price: '10', isActive: true, code: 'SKU-1' },
      { id: 'p2', name: 'B', price: '20', isActive: true },
      { id: 'p3', name: 'C', price: '30', isActive: false },
    ]
    render(<ProductsPage />)
    await waitFor(() => expect(screen.getByText(text('es', 'products.stats.active')).previousElementSibling?.textContent).toBe('2'))
    expect(document.body.textContent).toContain(text('es', 'products.sku').replace('{sku}', 'SKU-1'))
  })
})

describe('more than 100 companies (#451)', () => {
  const companies = Array.from({ length: 150 }, (_, i) => ({ id: `co${i + 1}`, name: `Company ${i + 1}` }))
  beforeEach(() => {
    mockLocale = 'es'
    mockRows = []
    mockOther = {}
    mockCalls.length = 0
  })

  test('a contact of the 150th company shows its name, asked by id and not from a list of 100', async () => {
    mockRows = [{ id: 'c1', firstName: 'Ana', lastName: 'Ruiz', email: 'a@example.com', companyId: 'co150' }]
    mockOther = { '/api/v1/contacts': mockRows, '/api/v1/companies': companies }
    render(<ContactsPage />)
    await waitFor(() => expect(screen.getAllByText('Company 150').length).toBeGreaterThan(0))
    expect(mockCalls.some(url => url.startsWith('/api/v1/companies?') && url.includes('ids=co150'))).toBe(true)
  })

  test('the counters count 150 contacts of one company, over two pages of 100', async () => {
    mockRows = [{ id: 'co1', name: 'Acme' }]
    mockOther = {
      '/api/v1/companies': mockRows,
      '/api/v1/contacts': Array.from({ length: 150 }, (_, i) => ({ id: `c${i}`, companyId: 'co1' })),
      '/api/v1/opportunities': [],
    }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getAllByText('150').length).toBeGreaterThanOrEqual(1))
    const asked = mockCalls.filter(url => url.startsWith('/api/v1/contacts?'))
    expect(asked.some(url => url.includes('page=2'))).toBe(true)
    expect(asked.every(url => url.includes('fields=companyId'))).toBe(true)
  })
})

describe('the counters ask for the companies the page shows (#451)', () => {
  test('contacts and opportunities are requested with companyId= of those companies, not the whole team', async () => {
    mockLocale = 'es'
    mockCalls.length = 0
    mockRows = [{ id: 'co1', name: 'Acme' }, { id: 'co2', name: 'Globex' }]
    mockOther = {
      '/api/v1/companies': mockRows,
      '/api/v1/contacts': [{ id: 'c1', companyId: 'co1' }, { id: 'c9', companyId: 'other' }],
      '/api/v1/opportunities': [],
    }
    render(<CompaniesPage />)
    await waitFor(() => expect(mockCalls.some(url => url.startsWith('/api/v1/opportunities?'))).toBe(true))
    for (const endpoint of ['contacts', 'opportunities']) {
      const asked = mockCalls.filter(url => url.startsWith(`/api/v1/${endpoint}?`))
      expect(asked.length).toBeGreaterThan(0)
      expect(asked.every(url => new URLSearchParams(url.split('?')[1]).get('companyId') === 'co1,co2')).toBe(true)
    }
  })
})

describe('the opportunities list reads what the API sends (#451)', () => {
  beforeEach(() => {
    mockLocale = 'es'
    mockOther = {}
    mockCalls.length = 0
  })

  test('the pipeline name and the stage name come from the pipeline, and the close date from closeDate', async () => {
    mockRows = [{ id: 'o1', name: 'Big deal', amount: '10', companyId: 'co1', pipelineId: 'p1', stageId: 's2', closeDate: '2026-12-31' }]
    mockOther = {
      '/api/v1/opportunities': mockRows,
      '/api/v1/companies': [{ id: 'co1', name: 'Acme' }],
      '/api/v1/pipelines': [{ id: 'p1', name: 'Enterprise Sales', stages: [{ id: 's1', name: 'Lead In' }, { id: 's2', name: 'Negotiation' }] }],
    }
    render(<OpportunitiesPage />)
    await waitFor(() => expect(screen.getByText('Enterprise Sales')).toBeTruthy())
    expect(screen.getByText('Negotiation')).toBeTruthy()
    // the close date column shows a date (not "-"): its year is in the page
    expect(document.body.textContent).toContain('2026')
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
