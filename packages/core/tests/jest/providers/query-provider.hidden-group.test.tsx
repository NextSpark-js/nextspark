/**
 * A group that Cache Components keeps in <Activity mode="hidden"> (#363): its effects are unmounted, its QueryClient
 * and its mounted queries are not. A sign-in while it is hidden must not leave the previous user's data on screen
 * when it comes back.
 */
import { Activity, startTransition, useLayoutEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { act, render, screen } from '@testing-library/react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { QueryProvider } from '@/core/providers/query-provider'
import { clearQueryCaches } from '@/core/lib/auth/query-caches'

jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

let client: QueryClient | undefined
function Teams() {
  client = useQueryClient()
  const { data } = useQuery({ queryKey: ['user-teams'], queryFn: () => new Promise<string>(() => {}), staleTime: Infinity })
  return <p data-testid="teams">{data ?? 'no data'}</p>
}

const group = (mode: 'visible' | 'hidden') => (
  <Activity mode={mode}><QueryProvider><Teams /></QueryProvider></Activity>
)

// Reads the DOM in a microtask after the commit that shows the group, before any later work: what the first frame holds.
let firstFrame = ''
function FirstFrame({ n }: { n: number }) {
  useLayoutEffect(() => {
    queueMicrotask(() => { firstFrame = document.querySelector('[data-testid=teams]')?.textContent ?? '' })
  }, [n])
  return null
}
const page = (mode: 'visible' | 'hidden', n: number) => (
  <>
    {group(mode)}
    <FirstFrame n={n} />
  </>
)

beforeEach(() => {
  client = undefined
})

describe('QueryProvider inside a hidden Activity', () => {
  it('shows nothing of the previous user after a sign-in while it was hidden', async () => {
    const { rerender } = render(group('visible'))
    act(() => { client!.setQueryData(['user-teams'], 'teams of user 1') })
    expect(await screen.findByText('teams of user 1')).toBeTruthy()

    rerender(group('hidden'))
    clearQueryCaches() // user 2 signs in
    rerender(group('visible'))

    expect(screen.getByTestId('teams').textContent).toBe('no data')
    expect(client!.getQueryCache().getAll().every(q => q.state.data === undefined)).toBe(true)
  })

  it('paints nothing of the previous user in the first frame when a transition shows it again', async () => {
    const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
    g.IS_REACT_ACT_ENVIRONMENT = true
    const el = document.body.appendChild(document.createElement('div'))
    const root = createRoot(el)
    try {
      await act(async () => root.render(page('visible', 0)))
      await act(async () => { client!.setQueryData(['user-teams'], 'teams of user 1') })
      await act(async () => root.render(page('hidden', 1)))
      clearQueryCaches() // user 2 signs in

      g.IS_REACT_ACT_ENVIRONMENT = false // no act: the passive effects run when React decides
      firstFrame = ''
      startTransition(() => root.render(page('visible', 2)))
      for (let i = 0; i < 50 && !firstFrame; i++) await new Promise(r => setTimeout(r, 0))

      expect(firstFrame).toBe('no data')
    } finally {
      g.IS_REACT_ACT_ENVIRONMENT = true
      await act(async () => root.unmount())
      el.remove()
    }
  })

  it('keeps its data when nobody signed in while it was hidden', async () => {
    const { rerender } = render(group('visible'))
    act(() => { client!.setQueryData(['user-teams'], 'teams of user 1') })
    await screen.findByText('teams of user 1')

    rerender(group('hidden'))
    rerender(group('visible'))

    expect(screen.getByTestId('teams').textContent).toBe('teams of user 1')
  })

  it('a provider that stays visible (providers.scope root) is emptied once, and one mounted after the sign-in is left alone', () => {
    const { rerender } = render(<QueryProvider><Teams /></QueryProvider>)
    client!.setQueryData(['user-teams'], 'a')
    clearQueryCaches()
    expect(client!.getQueryCache().getAll()).toHaveLength(0)

    client!.setQueryData(['user-teams'], 'b') // the new user's data
    rerender(<QueryProvider><Teams /></QueryProvider>)
    expect(client!.getQueryCache().getAll()).toHaveLength(1)
  })
})
