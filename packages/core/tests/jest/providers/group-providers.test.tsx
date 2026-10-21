/**
 * GroupProviders (#341): the query cache and the toaster for a route group when the root layout mounts neither, and
 * nothing extra when it does (a second cache would split the data, a second Toaster would show every toast twice).
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { GroupProviders } from '@/core/providers/group-providers'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))

jest.mock('@/core/components/ui/sonner', () => ({
  Toaster: () => require('react').createElement('div', { 'data-testid': 'toaster' }),
}))

let seen: QueryClient | undefined

function Probe() {
  seen = useQueryClient()
  return <p>page</p>
}

beforeEach(() => {
  seen = undefined
})

describe('GroupProviders', () => {
  it('gives the group a query cache and one toaster when nothing above provides them', () => {
    render(<GroupProviders><Probe /></GroupProviders>)
    expect(seen).toBeInstanceOf(QueryClient)
    expect(screen.getAllByTestId('toaster')).toHaveLength(1)
  })

  it('renders its children as they are under a root that already has a query cache', () => {
    const root = new QueryClient()
    render(
      <QueryClientProvider client={root}>
        <GroupProviders><Probe /></GroupProviders>
      </QueryClientProvider>,
    )
    expect(seen).toBe(root)
    expect(screen.queryByTestId('toaster')).toBeNull()
  })
})
