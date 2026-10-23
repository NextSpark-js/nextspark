/**
 * GroupToaster (#341): the toaster alone for a route group that needs no React Query, and nothing extra when the root
 * layout already mounts one (every toast would show twice).
 */
import { render, screen } from '@testing-library/react'
import { QueryClient, useQueryClient } from '@tanstack/react-query'
import { GroupToaster } from '@/core/providers/group-toaster'
import { GroupProviders } from '@/core/providers/group-providers'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

let mockRootProviders = true
jest.mock('@/core/lib/config/public-config-client', () => ({
  get ROOT_PROVIDERS() {
    return mockRootProviders
  },
}))
jest.mock('@/core/components/ui/sonner', () => ({
  Toaster: () => require('react').createElement('div', { 'data-testid': 'toaster' }),
}))

describe('GroupToaster', () => {
  it('mounts one toaster for the group when the root layout mounts none', () => {
    mockRootProviders = false
    render(<GroupToaster><p>page</p></GroupToaster>)
    expect(screen.getByText('page')).toBeTruthy()
    expect(screen.getAllByTestId('toaster')).toHaveLength(1)
  })

  it('renders its children as they are under a root layout that has the toaster', () => {
    mockRootProviders = true
    render(<GroupToaster><p>page</p></GroupToaster>)
    expect(screen.getByText('page')).toBeTruthy()
    expect(screen.queryByTestId('toaster')).toBeNull()
  })

  it('leaves the toaster to a GroupProviders below it: one toaster, and the query cache that wrapper adds', () => {
    mockRootProviders = false
    let client: QueryClient | undefined
    function Probe() {
      client = useQueryClient()
      return <p>page</p>
    }
    render(<GroupToaster><GroupProviders><Probe /></GroupProviders></GroupToaster>)
    expect(client).toBeInstanceOf(QueryClient)
    expect(screen.getAllByTestId('toaster')).toHaveLength(1)
  })

  it('needs no query cache: it renders outside any QueryClientProvider', () => {
    mockRootProviders = false
    expect(() => render(<GroupToaster><p>page</p></GroupToaster>)).not.toThrow()
  })
})
