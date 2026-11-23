/**
 * The consent screen of MCP browser sign-in (#541): what it sends is what stayed ticked, and when it cannot learn
 * what the user's role allows it asks for no entity permission.
 */
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
const SEARCH = new URLSearchParams({
  client_id: 'https://client.example/meta',
  scope: 'openid offline_access tasks:read tasks:write tasks:delete customers:read',
  code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM',
})
jest.mock('next/navigation', () => ({ useSearchParams: () => SEARCH }))
const consent = jest.fn()
jest.mock('@/core/lib/auth-client', () => ({
  authClient: {
    oauth2: {
      publicClient: jest.fn().mockResolvedValue({ data: { client_name: 'Client' } }),
      consent: (...args: unknown[]) => consent(...args),
    },
  },
}))
jest.mock('@/core/lib/base-path', () => ({ withBasePath: (path: string) => path }))

import { OAuthConsent } from '@/core/components/auth/OAuthConsent'

const box = (entity: string, action: string) => document.querySelector(`[data-cy=oauth-consent-${entity}-${action}]`) as HTMLButtonElement
const checked = (entity: string, action: string) => box(entity, action).getAttribute('aria-checked') === 'true'
const allow = () => document.querySelector('[data-cy=oauth-consent-allow]') as HTMLButtonElement
const sentScope = () => (consent.mock.calls[0][0] as { scope?: string }).scope

// What the server offers unless a test says otherwise: every entity permission the application asks for
const ASKED = (SEARCH.get('scope') ?? '').split(' ').filter(scope => scope.includes(':'))
const teamResponse = (allowed: string[], granted: string[] | null = null, offered: string[] = ASKED) => ({
  ok: true,
  json: async () => ({ data: [{ id: 'team-1', name: 'One' }], selected: 'team-1', allowed, granted, offered }),
})

beforeEach(() => {
  jest.clearAllMocks()
  consent.mockResolvedValue({ data: null, error: { message: 'stay on the page' } })
})

describe('OAuthConsent', () => {
  it('reading and writing come ticked, deleting does not, and what the role cannot hold cannot be ticked', async () => {
    global.fetch = jest.fn().mockResolvedValue(teamResponse(['tasks:read', 'tasks:write', 'tasks:delete'])) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    expect([checked('tasks', 'read'), checked('tasks', 'write'), checked('tasks', 'delete')]).toEqual([true, true, false])
    expect(box('tasks', 'delete').disabled).toBe(false)
    // customers:read is not among what the role holds: unticked and locked
    expect(checked('customers', 'read')).toBe(false)
    expect(box('customers', 'read').disabled).toBe(true)
  })

  it('a permission the application asks for that no tool needs any more is not shown, ticked or sent', async () => {
    // the server offers tasks only: customers:read was asked for (the application kept an older list) and is gone
    global.fetch = jest.fn().mockResolvedValue(teamResponse(['tasks:read', 'tasks:write'], ['tasks:read', 'customers:read'], ['tasks:read', 'tasks:write', 'tasks:delete'])) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    expect(box('customers', 'read')).toBeNull()
    expect(document.body.textContent).not.toContain('customers')
    // what the role cannot hold of what is offered is still shown, locked
    expect(box('tasks', 'delete').disabled).toBe(true)
    await act(async () => { fireEvent.click(allow()) })
    expect(sentScope()).not.toContain('customers:read')
    expect(sentScope()).toContain('tasks:read')
  })

  it('shows no permission before the server has said what it offers, and none when it cannot say', async () => {
    let answer: (value: unknown) => void = () => {}
    global.fetch = jest.fn().mockReturnValue(new Promise(resolve => { answer = resolve })) as never
    render(<OAuthConsent />)
    // the application asks for tasks and customers; nothing is drawn until the server answers
    expect(document.querySelector('[data-cy=oauth-consent-permissions]')).toBeNull()
    expect(allow().disabled).toBe(true)
    await act(async () => { answer({ ok: false, json: async () => ({}) }) })
    expect(document.querySelector('[data-cy=oauth-consent-permissions]')).toBeNull()
    expect(box('tasks', 'read')).toBeNull()
  })

  it('sends exactly what stayed ticked, with the scopes that are not entity permissions', async () => {
    global.fetch = jest.fn().mockResolvedValue(teamResponse(['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read'])) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    fireEvent.click(box('tasks', 'write')) // untick
    fireEvent.click(box('tasks', 'delete')) // tick
    await act(async () => { fireEvent.click(allow()) })
    expect(consent).toHaveBeenCalledWith({ accept: true, scope: 'openid offline_access tasks:read tasks:delete customers:read' })
  })

  it('cannot be accepted while what the role allows is still loading', () => {
    global.fetch = jest.fn().mockReturnValue(new Promise(() => {})) as never
    render(<OAuthConsent />)
    expect(allow().disabled).toBe(true)
    // and no permission is drawn yet: which ones the server offers is not known
    expect(box('tasks', 'read')).toBeNull()
  })

  it('an HTTP error reading what the role allows leaves no entity permission to grant', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, json: async () => ({}) }) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    await act(async () => { fireEvent.click(allow()) })
    expect(sentScope()).toBe('openid offline_access')
  })

  it('a network error reading what the role allows leaves no entity permission to grant either', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('offline')) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    expect([box('tasks', 'read'), box('tasks', 'write')]).toEqual([null, null])
    await act(async () => { fireEvent.click(allow()) })
    expect(sentScope()).toBe('openid offline_access')
  })

  it('a refusal sends no scope', async () => {
    global.fetch = jest.fn().mockResolvedValue(teamResponse(['tasks:read'])) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    await act(async () => { fireEvent.click(document.querySelector('[data-cy=oauth-consent-deny]') as HTMLButtonElement) })
    expect(consent).toHaveBeenCalledWith({ accept: false })
    expect(screen.queryByRole('alert')).not.toBeNull()
  })

  it('an application already connected starts from what it holds: its delete stays ticked, nothing it lacks is ticked', async () => {
    const all = ['tasks:read', 'tasks:write', 'tasks:delete', 'customers:read']
    global.fetch = jest.fn().mockResolvedValue(teamResponse(all, ['tasks:read', 'tasks:delete'])) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    // what it has, delete included; not the write it was not given, nor a read it never had
    expect([checked('tasks', 'read'), checked('tasks', 'write'), checked('tasks', 'delete'), checked('customers', 'read')]).toEqual([true, false, true, false])
    expect(document.querySelector('[data-cy=oauth-consent-hint]')?.textContent).toBe('hintConnected')
    // accepting as it is grants what it had: nothing is taken away, nothing is added
    await act(async () => { fireEvent.click(allow()) })
    expect(sentScope()).toBe('openid offline_access tasks:read tasks:delete')
    // the screen asked what this application holds in the chosen team
    expect(String((global.fetch as jest.Mock).mock.calls[0][0])).toContain('client_id=https%3A%2F%2Fclient.example%2Fmeta')
  })

  it('an application already connected does not keep ticked what the role can no longer hold', async () => {
    global.fetch = jest.fn().mockResolvedValue(teamResponse(['tasks:read'], ['tasks:read', 'tasks:write'])) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    expect([checked('tasks', 'read'), checked('tasks', 'write')]).toEqual([true, false])
    expect(box('tasks', 'write').disabled).toBe(true)
  })

  it('a first connection keeps the defaults and their hint', async () => {
    global.fetch = jest.fn().mockResolvedValue(teamResponse(['tasks:read', 'tasks:write', 'tasks:delete'], null)) as never
    render(<OAuthConsent />)
    await waitFor(() => expect(allow().disabled).toBe(false))
    expect(document.querySelector('[data-cy=oauth-consent-hint]')?.textContent).toBe('hint')
  })
})
