/**
 * @jest-environment jsdom
 *
 * #547: the API Explorer applies its saved session (auth, key, bypass, team, act-as, recent requests, collapsed sidebar)
 * after mount. Reading localStorage in the initializers made the first client render differ from the server HTML.
 */
import React from 'react'
import { renderToString } from 'react-dom/server'
import { render, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const panelProps: { current: Record<string, unknown> } = { current: {} }
const sidebarProps: { current: Record<string, unknown> } = { current: {} }

jest.mock('../../../../../src/components/devtools/api-explorer/ApiEndpointsSidebar', () => ({
  ApiEndpointsSidebar: (props: Record<string, unknown>) => ((sidebarProps.current = props), null),
}))
const loadSpy = jest.fn()
jest.mock('../../../../../src/components/devtools/api-explorer/explorer-storage', () => {
  const actual = jest.requireActual('../../../../../src/components/devtools/api-explorer/explorer-storage')
  return { ...actual, loadState: (key: string) => (loadSpy(key), actual.loadState(key)) }
})
jest.mock('../../../../../src/components/devtools/api-explorer/PanelDivider', () => ({ PanelDivider: () => null }))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiRequestPanel', () => ({
  ApiRequestPanel: (props: Record<string, unknown>) => ((panelProps.current = props), null),
}))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiResponsePanel', () => ({ ApiResponsePanel: () => null }))
jest.mock('../../../../../src/components/devtools/api-tester/hooks/useApiRequest', () => ({
  useApiRequest: () => ({ status: 'idle', response: null, error: null, execute: jest.fn(), cancel: jest.fn(), reset: jest.fn() }),
}))
jest.mock('../../../../../src/hooks/useApiExplorerNavigation', () => ({
  useApiExplorerNavigation: () => ({ selectedMethod: 'GET', selectedPath: '/api/v1/things', navigateToEndpoint: jest.fn() }),
}))
jest.mock('../../../../../src/hooks/teams', () => ({ useUserTeams: () => ({ teams: [], isLoading: false }) }))
jest.mock('../../../../../src/lib/services/api-presets.service', () => ({ ApiPresetsService: { getByEndpoint: () => undefined } }))
jest.mock('../../../../../src/lib/services/api-docs.service', () => ({ ApiDocsService: { getByEndpoint: () => undefined } }))

import { ApiExplorer } from '../../../../../src/components/devtools/api-explorer/ApiExplorer'

const P = 'nextspark:apiExplorer:'
const routes = { core: [{ path: '/api/v1/things', methods: ['GET'] }], entity: [], theme: [], plugin: [] } as never
const save = (key: string, value: unknown) => localStorage.setItem(P + key, JSON.stringify(value))

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never
})
beforeEach(() => {
  localStorage.clear()
  save('authType', 'apiKey')
  save('apiKey', 'k-saved')
  save('bypassMode', true)
  save('selectedTeamId', 't-saved')
  save('sidebarCollapsed', true)
})
afterEach(cleanup)

describe('ApiExplorer saved session', () => {
  test('rendering reads nothing from localStorage: the server render cannot, so the first client render must not either', () => {
    loadSpy.mockClear()
    renderToString(<ApiExplorer routes={routes} />)
    expect(loadSpy.mock.calls.map(c => c[0])).toEqual([])
    expect(sidebarProps.current.isCollapsed).toBe(false)
  })

  test('after mount the saved session applies', () => {
    render(<ApiExplorer routes={routes} />)
    expect(panelProps.current).toMatchObject({ authType: 'apiKey', apiKey: 'k-saved', bypassMode: true, selectedTeamId: 't-saved' })
    expect(sidebarProps.current.isCollapsed).toBe(true)
  })

  test('the saved session survives a mount whose effects run twice (the persist waits for the read)', () => {
    render(<React.StrictMode><ApiExplorer routes={routes} /></React.StrictMode>)
    expect(JSON.parse(localStorage.getItem(P + 'authType')!)).toBe('apiKey')
    expect(JSON.parse(localStorage.getItem(P + 'apiKey')!)).toBe('k-saved')
    expect(JSON.parse(localStorage.getItem(P + 'sidebarCollapsed')!)).toBe(true)
    expect(panelProps.current).toMatchObject({ authType: 'apiKey', selectedTeamId: 't-saved' })
  })
})
