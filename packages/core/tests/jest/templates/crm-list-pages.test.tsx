/**
 * @jest-environment jsdom
 *
 * The list pages of the crm template in Spanish and German (#422): titles, columns, stats and the empty state come from the
 * template catalog, and the totals of NUMERIC columns (which the API sends as strings) are numbers, formatted in the locale.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'

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
let mockDelay: (url: string) => number = () => 0 // a slow endpoint, to answer out of order
let mockStuck = false // an endpoint that always says there is a next page, with no rows
jest.mock('@nextsparkjs/core/lib/api/entities', () => ({
  fetchWithTeam: async (url: string) => {
    mockCalls.push(url)
    if (mockStuck) return { ok: mockCalls.length < 6, json: async () => ({ data: [], info: { hasNextPage: true } }) } // not ok after 5 calls, so a loop without the cut ends and the count fails
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
    // like the generic handler: equality filters on a field, and a `from` date on `dateField`
    if (params.get('status')) rows = rows.filter(row => (row as { status?: string }).status === params.get('status'))
    if (params.get('dateField')) rows = rows.filter(row => String((row as Record<string, unknown>)[params.get('dateField')!] ?? '') >= params.get('from')!)
    // like the generic handler: `search` matches name (and the one `searchField`) with ILIKE, `sortBy`/`sortOrder` order the whole set
    if (params.get('search')) {
      const wanted = params.get('search')!.toLowerCase()
      const fields = ['name', ...(params.get('searchField') ? [params.get('searchField')!] : [])]
      rows = rows.filter(row => fields.some(field => String((row as Record<string, unknown>)[field] ?? '').toLowerCase().includes(wanted)))
    }
    if (params.get('sortBy')) {
      const field = params.get('sortBy')!
      const sign = params.get('sortOrder') === 'desc' ? -1 : 1
      rows = [...rows].sort((x, y) => {
        const l = (x as Record<string, unknown>)[field] as string | number, r = (y as Record<string, unknown>)[field] as string | number
        return (l < r ? -1 : l > r ? 1 : 0) * sign
      })
    }
    const limit = Math.min(Number(params.get('limit') ?? 10), 100)
    const page = Number(params.get('page') ?? 1)
    const total = rows.length
    const delay = mockDelay(url)
    if (delay) await new Promise(resolve => setTimeout(resolve, delay))
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

describe('an empty page ends the paging (#451)', () => {
  test('the API says hasNextPage but sends no rows: the loop stops instead of asking forever', async () => {
    const { fetchRows } = jest.requireActual('../../../templates/projects/crm/lib/crm-utils') as typeof import('../../../templates/projects/crm/lib/crm-utils')
    mockCalls.length = 0
    mockOther = { '/api/v1/stuck': [] }
    mockStuck = true
    try {
      expect(await fetchRows('/api/v1/stuck')).toEqual([])
    } finally {
      mockStuck = false
    }
    expect(mockCalls.filter(url => url.startsWith('/api/v1/stuck?')).length).toBe(1)
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

describe('the lists page on the server (#461)', () => {
  const companies = Array.from({ length: 150 }, (_, i) => ({ id: `co${i + 1}`, name: `Company ${String(i + 1).padStart(3, '0')}`, size: 'small' }))
  const listCalls = (endpoint: string) => mockCalls.filter(url => url.startsWith(`${endpoint}?`)).map(url => new URLSearchParams(url.split('?')[1]))
  beforeEach(() => {
    mockLocale = 'es'
    mockRows = []
    mockOther = {}
    mockCalls.length = 0
  })

  test('companies: the 150th is reached by the pagination (page 10 of 15 rows) and the total is the API\'s', async () => {
    mockRows = companies
    mockOther = { '/api/v1/companies': companies, '/api/v1/contacts': [], '/api/v1/opportunities': [] }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    expect(screen.queryByText('Company 016')).toBeNull()
    expect(screen.getByText('150')).toBeTruthy() // stats total, not the 15 rows of the page
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    await waitFor(() => expect(screen.getByText('Company 136')).toBeTruthy())
    await new Promise(resolve => setTimeout(resolve, 450)) // past the search debounce: the page must stay
    expect(screen.getByText('Company 136')).toBeTruthy()
    expect(screen.getByText('Company 150')).toBeTruthy() // page 10 is rows 136-150: 150 is its last
    expect(screen.queryByText('Company 001')).toBeNull()
  })

  test('companies: the search is asked of the server and finds the 150th', async () => {
    mockRows = companies
    mockOther = { '/api/v1/companies': companies, '/api/v1/contacts': [], '/api/v1/opportunities': [] }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    fireEvent.change(screen.getByPlaceholderText(text('es', 'companies.search')), { target: { value: 'Company 150' } })
    await waitFor(() => expect(screen.getByText('Company 150')).toBeTruthy())
    expect(screen.queryByText('Company 001')).toBeNull()
    expect(listCalls('/api/v1/companies').some(q => q.get('search') === 'Company 150' && q.get('page') === '1')).toBe(true)
  })

  test('companies: the order is asked of the server over the whole set', async () => {
    mockRows = companies
    mockOther = { '/api/v1/companies': companies, '/api/v1/contacts': [], '/api/v1/opportunities': [] }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    const header = screen.getByText(text('es', 'companies.columns.company'))
    fireEvent.click(header) // asc
    fireEvent.click(header) // desc
    await waitFor(() => expect(screen.getByText('Company 150')).toBeTruthy())
    expect(listCalls('/api/v1/companies').some(q => q.get('sortBy') === 'name' && q.get('sortOrder') === 'desc')).toBe(true)
  })

  test('contacts: page, search and order go to the server, and the company names are asked for the page only', async () => {
    const contacts = Array.from({ length: 150 }, (_, i) => ({ id: `c${i + 1}`, firstName: 'N', lastName: `Last${String(i + 1).padStart(3, '0')}`, email: `c${i + 1}@example.com`, companyId: 'co1' }))
    mockRows = contacts
    mockOther = { '/api/v1/contacts': contacts, '/api/v1/companies': [{ id: 'co1', name: 'Acme' }] }
    render(<ContactsPage />)
    await waitFor(() => expect(screen.getAllByText('Acme').length).toBeGreaterThan(0))
    expect(screen.getByText('150')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    await waitFor(() => expect(screen.getByText(/Last150/)).toBeTruthy())
    await new Promise(resolve => setTimeout(resolve, 450))
    expect(screen.getByText(/Last150/)).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(text('es', 'contacts.search')), { target: { value: 'Last077' } })
    await waitFor(() => expect(screen.getByText(/Last077/)).toBeTruthy())
    fireEvent.click(screen.getByText(text('es', 'contacts.columns.name')))
    await waitFor(() => expect(listCalls('/api/v1/contacts').some(q => q.get('sortBy') === 'lastName' && q.get('search') === 'Last077')).toBe(true))
    const calls = listCalls('/api/v1/contacts')
    expect(calls.some(q => q.get('page') === '10')).toBe(true)
    expect(calls.some(q => q.get('search') === 'Last077' && q.get('searchField') === 'lastName' && q.get('page') === '1')).toBe(true)
  })

  test('opportunities: page, search and order go to the server', async () => {
    const opportunities = Array.from({ length: 150 }, (_, i) => ({ id: `o${i + 1}`, name: `Deal ${String(i + 1).padStart(3, '0')}`, amount: String(i + 1) }))
    mockRows = opportunities
    mockOther = { '/api/v1/opportunities': opportunities, '/api/v1/companies': [], '/api/v1/pipelines': [] }
    render(<OpportunitiesPage />)
    await waitFor(() => expect(screen.getByText('Deal 001')).toBeTruthy())
    expect(screen.getByText('150')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    await waitFor(() => expect(screen.getByText('Deal 150')).toBeTruthy())
    await new Promise(resolve => setTimeout(resolve, 450))
    expect(screen.getByText('Deal 150')).toBeTruthy()
    fireEvent.change(screen.getByPlaceholderText(text('es', 'opportunities.search')), { target: { value: 'Deal 042' } })
    await waitFor(() => expect(screen.getByText('Deal 042')).toBeTruthy())
    fireEvent.click(screen.getByText(text('es', 'opportunities.columns.value')))
    await waitFor(() => expect(listCalls('/api/v1/opportunities').some(q => q.get('sortBy') === 'amount' && q.get('sortOrder') === 'asc')).toBe(true))
  })

  test('an old slow answer that arrives after a newer one is dropped', async () => {
    mockRows = companies
    mockOther = { '/api/v1/companies': companies, '/api/v1/contacts': [], '/api/v1/opportunities': [] }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    mockDelay = url => (url.startsWith('/api/v1/companies?') && url.includes('page=2') ? 500 : 0)
    try {
      fireEvent.click(screen.getByRole('button', { name: '2' })) // slow
      fireEvent.click(await screen.findByRole('button', { name: '3' })) // fast, asked after
      await waitFor(() => expect(screen.getByText('Company 031')).toBeTruthy())
      await new Promise(resolve => setTimeout(resolve, 800)) // page 2 arrives now
    } finally {
      mockDelay = () => 0
    }
    expect(screen.getByText('Company 031')).toBeTruthy()
    expect(screen.queryByText('Company 016')).toBeNull()
  })

  test('sorting goes back to the first page', async () => {
    mockRows = companies
    mockOther = { '/api/v1/companies': companies, '/api/v1/contacts': [], '/api/v1/opportunities': [] }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    fireEvent.click(screen.getByRole('button', { name: '10' }))
    await waitFor(() => expect(screen.getByText('Company 136')).toBeTruthy())
    mockCalls.length = 0
    fireEvent.click(screen.getByText(text('es', 'companies.columns.company')))
    await waitFor(() => expect(listCalls('/api/v1/companies').some(q => q.get('sortBy') === 'name' && q.get('page') === '1')).toBe(true))
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    expect(listCalls('/api/v1/companies').every(q => q.get('page') === '1')).toBe(true)
  })

  test('the stats the API can count come from a filtered request, the sums are labelled as of the page', async () => {
    const opportunities = Array.from({ length: 150 }, (_, i) => ({ id: `o${i + 1}`, name: `Deal ${i + 1}`, amount: '10', status: i % 3 === 0 ? 'won' : 'open' }))
    mockRows = opportunities
    mockOther = { '/api/v1/opportunities': opportunities, '/api/v1/companies': [], '/api/v1/pipelines': [] }
    render(<OpportunitiesPage />)
    // 50 won in all (5 in the 15 rows of the page); 150 in all
    await waitFor(() => expect(screen.getByText(text('es', 'opportunities.stats.won')).previousElementSibling?.textContent).toBe('50'))
    expect(screen.getByText(text('es', 'opportunities.stats.total')).previousElementSibling?.textContent).toBe('150')
    expect(listCalls('/api/v1/opportunities').some(q => q.get('status') === 'won' && q.get('limit') === '1')).toBe(true)
    // the value and the average add the rows of the page: the label says so (in the six catalogs)
    expect(text('es', 'opportunities.stats.pipelineValue')).toMatch(/esta página/)
    for (const locale of ['en', 'es', 'de', 'pt', 'fr', 'it']) {
      for (const key of ['opportunities.stats.pipelineValue', 'opportunities.stats.avgProbability', 'contacts.stats.withCompany', 'contacts.stats.withEmail', 'companies.stats.contacts', 'companies.stats.opportunities', 'companies.stats.pipelineValue']) {
        expect(text(locale, key)).toMatch(/\(.+\)$/)
      }
    }
  })

  test('contacts: recently active is counted by the API over the last 30 days', async () => {
    const recent = new Date(Date.now() - 86_400_000).toISOString()
    const old = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const contacts = Array.from({ length: 150 }, (_, i) => ({ id: `c${i + 1}`, firstName: 'N', lastName: `L${i + 1}`, email: 'a@example.com', lastContactedAt: i < 40 ? recent : old }))
    mockRows = contacts
    mockOther = { '/api/v1/contacts': contacts, '/api/v1/companies': [] }
    render(<ContactsPage />)
    await waitFor(() => expect(screen.getByText(text('es', 'contacts.stats.recentlyActive')).previousElementSibling?.textContent).toBe('40'))
    expect(listCalls('/api/v1/contacts').some(q => q.get('dateField') === 'lastContactedAt' && q.get('limit') === '1')).toBe(true)
  })

  test('the lists always ask for a page and its size', async () => {
    mockRows = companies
    mockOther = { '/api/v1/companies': companies, '/api/v1/contacts': [], '/api/v1/opportunities': [] }
    render(<CompaniesPage />)
    await waitFor(() => expect(screen.getByText('Company 001')).toBeTruthy())
    expect(listCalls('/api/v1/companies').every(q => q.get('page') === '1' && q.get('limit') === '15')).toBe(true)
  })
})
