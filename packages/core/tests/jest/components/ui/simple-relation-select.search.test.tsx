/**
 * @jest-environment jsdom
 *
 * SimpleRelationSelect — the list holds only the first `limit` records, so a typed term is also
 * searched on the server (debounced) and the hits merge into the options.
 */
import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals'
import { render, screen, act, fireEvent } from '@testing-library/react'

const fetchWithTeam = jest.fn<(url: string, init?: RequestInit) => Promise<Response>>()

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => (key === 'status.loading' ? 'Loading...' : key) }))
jest.mock('@/core/lib/api/entities', () => ({ fetchWithTeam: (...args: [string, RequestInit?]) => fetchWithTeam(...args) }))
jest.mock('@/core/lib/entities/client-entity-meta', () => ({
  parseClientChildEntity: (t: string) => (t.includes(':') ? { isChild: true, parentEntity: 'clients', childType: 'x' } : { isChild: false }),
  getClientEntityApiPath: (t: string) => (t.includes(':') ? null : t),
}))

import { SimpleRelationSelect } from '@/core/components/ui/simple-relation-select'

const json = (data: Array<Record<string, unknown>>) =>
  Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data }) } as Response)

const first20 = Array.from({ length: 20 }, (_, i) => ({ id: `c${i}`, name: `Client ${i}` }))
const outside = { id: 'z1', name: 'Zeta Industries' }

let pending: Array<(r: Response) => void> = []
const deferred = () => new Promise<Response>(resolve => { pending.push(resolve) })

function mockApi(onSearch: (url: URL) => Promise<Response>) {
  fetchWithTeam.mockImplementation((raw: string) => {
    const url = new URL(raw)
    return url.searchParams.has('search') ? onSearch(url) : json(first20)
  })
}
const searchCalls = () => fetchWithTeam.mock.calls.map(c => new URL(c[0])).filter(u => u.searchParams.has('search'))

async function openAndType(text: string, props: Partial<React.ComponentProps<typeof SimpleRelationSelect>> = {}) {
  const view = render(<SimpleRelationSelect entityType="clients" onChange={() => {}} {...props} />)
  await act(async () => { fireEvent.click(screen.getByRole('combobox')) })
  await type(text)
  return view
}
async function type(text: string) {
  await act(async () => { fireEvent.change(screen.getByPlaceholderText('Search...'), { target: { value: text } }) })
}
const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms) })

beforeEach(() => {
  jest.useFakeTimers()
  fetchWithTeam.mockReset()
  pending = []
  ;(global as { ResizeObserver?: unknown }).ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }
  Element.prototype.scrollIntoView ??= () => {}
})
afterEach(() => { jest.useRealTimers() })

describe('SimpleRelationSelect server-side search', () => {
  it('finds a record outside the first page, URL-encoding the term', async () => {
    mockApi(() => json([{ id: 'z3', name: 'Zeta & Co' }]))
    await openAndType('Zeta & Co')
    await advance(300)
    const [call] = searchCalls()
    expect(call.pathname).toBe('/api/v1/clients')
    expect(call.searchParams.get('search')).toBe('Zeta & Co')
    expect(call.search).toContain('search=Zeta+%26+Co')
    expect(call.searchParams.get('limit')).toBe('20')
    expect(await screen.findByText('Zeta & Co')).toBeInTheDocument()
    expect(screen.queryByText('Client 0')).not.toBeInTheDocument()
  })

  it('debounces: nothing before 300 ms, one request for rapid typing, none for a single character', async () => {
    mockApi(() => json([outside]))
    await openAndType('z')
    await advance(1000)
    expect(searchCalls()).toHaveLength(0)
    await type('ze')
    await advance(200)
    await type('zet')
    await advance(299)
    expect(searchCalls()).toHaveLength(0)
    await advance(1)
    expect(searchCalls()).toHaveLength(1)
    expect(searchCalls()[0].searchParams.get('search')).toBe('zet')
  })

  it('does not duplicate options already loaded', async () => {
    mockApi(() => json([first20[3], { id: 'z2', name: 'Client 3 Zeta' }]))
    await openAndType('Client 3')
    await advance(300)
    await screen.findByText('Client 3 Zeta')
    expect(screen.getAllByText('Client 3')).toHaveLength(1)
  })

  it('ignores a stale response: the later search wins', async () => {
    mockApi(() => deferred())
    await openAndType('alpha')
    await advance(300)
    await type('zeta')
    await advance(300)
    expect(pending).toHaveLength(2)
    const res = (data: Array<Record<string, unknown>>) => ({ ok: true, json: () => Promise.resolve({ success: true, data }) } as Response)
    await act(async () => { pending[1](res([outside])) })
    await act(async () => { pending[0](res([{ id: 'a1', name: 'Zeta Stale' }])) })
    expect(await screen.findByText('Zeta Industries')).toBeInTheDocument()
    expect(screen.queryByText('Zeta Stale')).not.toBeInTheDocument()
  })

  it('does not search while the first page loads, and searches once it lands (the page would wipe the hits)', async () => {
    let firstPage!: (r: Response) => void
    fetchWithTeam.mockImplementation((raw: string) =>
      new URL(raw).searchParams.has('search')
        ? json([outside])
        : new Promise<Response>(resolve => { firstPage = resolve }))
    await openAndType('Zeta')
    await advance(1000)
    expect(searchCalls()).toHaveLength(0)
    await act(async () => { firstPage({ ok: true, json: () => Promise.resolve({ success: true, data: first20 }) } as Response) })
    await advance(300)
    expect(searchCalls()).toHaveLength(1)
    expect(await screen.findByText('Zeta Industries')).toBeInTheDocument()
  })

  it('stops searching after a 400 SEARCH_NOT_SUPPORTED', async () => {
    mockApi(() => Promise.resolve({ ok: false, status: 400, json: () => Promise.resolve({ success: false, code: 'SEARCH_NOT_SUPPORTED' }) } as Response))
    await openAndType('ze')
    await advance(300)
    await type('zet')
    await advance(300)
    expect(searchCalls()).toHaveLength(1)
    expect(screen.queryByText('Loading...')).not.toBeInTheDocument()
  })

  it('keeps parentId, userFiltered and filter in the search request', async () => {
    mockApi(() => json([]))
    await openAndType('zeta', { parentId: 'p1', userFiltered: true, filter: { type: 'generic' } })
    await advance(300)
    const [call] = searchCalls()
    expect(call.searchParams.get('parentId')).toBe('p1')
    expect(call.searchParams.get('userFiltered')).toBe('true')
    expect(call.searchParams.get('type')).toBe('generic')
  })

  it('shows the translated loading text while searching', async () => {
    mockApi(() => deferred())
    await openAndType('zzzz')
    await advance(300)
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('clears the search when the popover closes (also after a selection)', async () => {
    mockApi(() => json([outside]))
    await openAndType('Zeta')
    await advance(300)
    await act(async () => { fireEvent.click(await screen.findByText('Zeta Industries')) })
    await act(async () => { fireEvent.click(screen.getByRole('combobox')) })
    expect(screen.getByPlaceholderText('Search...')).toHaveValue('')
  })

  it('does not search in property mode', async () => {
    mockApi(() => json([]))
    await openAndType('zeta', { usePropertyMode: true, propField: 'industry', propertyOptions: [{ value: 'a', label: 'A' }] })
    await advance(1000)
    expect(searchCalls()).toHaveLength(0)
  })

  it('does not search for a child entity', async () => {
    mockApi(() => json([]))
    await openAndType('zeta', { entityType: 'clients:contacts', parentId: 'p1' })
    await advance(1000)
    expect(searchCalls()).toHaveLength(0)
  })
})
