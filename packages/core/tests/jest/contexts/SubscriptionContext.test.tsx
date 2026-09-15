/**
 * SubscriptionProvider — which failures are retried.
 *
 * A role without billing access gets 403 for the team's subscription on every
 * attempt, so retrying only repeats the request; a server error may pass.
 */
import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { SubscriptionProvider, useSubscriptionContext } from '@/core/contexts/SubscriptionContext'

jest.mock('@/core/hooks/useTeam', () => ({
  useTeam: () => ({ team: { id: 'team-a' } }),
}))

jest.mock('@nextsparkjs/registries/billing-registry', () => ({
  BILLING_REGISTRY: { plans: [{ slug: 'free', features: [], limits: {} }], limits: {} },
}))

const fetchMock = jest.fn()

function respond(status: number, body: unknown = {}) {
  return Promise.resolve({ ok: status < 400, status, json: async () => body })
}

function State() {
  const { error, isReady } = useSubscriptionContext()
  return <div data-testid="state">{error ? 'error' : isReady ? 'ready' : 'loading'}</div>
}

function renderProvider() {
  // No retry override: the provider's own policy decides, over the library's
  // default of three retries in the browser.
  render(
    <QueryClientProvider client={new QueryClient()}>
      <SubscriptionProvider>
        <State />
      </SubscriptionProvider>
    </QueryClientProvider>
  )
}

beforeEach(() => {
  fetchMock.mockReset()
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('SubscriptionProvider retries', () => {
  it('does not retry a 403', async () => {
    fetchMock.mockImplementation(() => respond(403, { error: 'Forbidden' }))
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('error'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('retries a server error', async () => {
    fetchMock
      .mockImplementationOnce(() => respond(500))
      .mockImplementation(() => respond(200, { data: { subscription: null } }))
    renderProvider()

    await waitFor(() => expect(screen.getByTestId('state').textContent).toBe('ready'), { timeout: 4000 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
