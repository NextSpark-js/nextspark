/**
 * @jest-environment jsdom
 *
 * #524: the identity of a request never claims an act-as the server ignores. With act-as off (production runtime, or
 * ALLOW_ACT_AS_USER not set) a remembered user is not sent, not shown on the chip, not named on the response, and the
 * picker is disabled with the reason.
 */
import React from 'react'
import { render, screen, act, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))

const execute = jest.fn()
const panelProps: { current: Record<string, unknown> } = { current: {} }
const responseProps: { current: Record<string, unknown> } = { current: {} }

jest.mock('../../../../../src/components/devtools/api-explorer/ApiEndpointsSidebar', () => ({ ApiEndpointsSidebar: () => null }))
jest.mock('../../../../../src/components/devtools/api-explorer/PanelDivider', () => ({ PanelDivider: () => null }))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiRequestPanel', () => ({
  ApiRequestPanel: (props: Record<string, unknown>) => ((panelProps.current = props), null),
}))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiResponsePanel', () => ({
  ApiResponsePanel: (props: Record<string, unknown>) => ((responseProps.current = props), null),
}))
jest.mock('../../../../../src/components/devtools/api-tester/hooks/useApiRequest', () => ({
  useApiRequest: () => ({ status: 'idle', response: null, error: null, execute, cancel: jest.fn(), reset: jest.fn() }),
}))
jest.mock('../../../../../src/hooks/useApiExplorerNavigation', () => ({
  useApiExplorerNavigation: () => ({ selectedMethod: 'GET', selectedPath: '/api/v1/things', navigateToEndpoint: jest.fn() }),
}))
jest.mock('../../../../../src/hooks/teams', () => ({ useUserTeams: () => ({ teams: [], isLoading: false }) }))
jest.mock('../../../../../src/lib/services/api-presets.service', () => ({ ApiPresetsService: { getByEndpoint: () => undefined } }))
jest.mock('../../../../../src/lib/services/api-docs.service', () => ({ ApiDocsService: { getByEndpoint: () => undefined } }))

import { ApiExplorer } from '../../../../../src/components/devtools/api-explorer/ApiExplorer'

beforeAll(() => {
  window.matchMedia = ((query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} })) as never
})
beforeEach(() => {
  execute.mockClear()
  window.localStorage.clear()
  window.localStorage.setItem('nextspark:apiExplorer:actAsUserId', JSON.stringify('u-remembered'))
  window.localStorage.setItem('nextspark:apiExplorer:actAsLabel', JSON.stringify('ana@example.test'))
})
afterEach(cleanup)

const routes = { core: [{ path: '/api/v1/things', methods: ['GET'] }], entity: [], theme: [], plugin: [] } as never

const send = async () => {
  await act(async () => {
    await (panelProps.current.onSend as () => Promise<void>)()
  })
}

describe('act-as on', () => {
  test('sends the header and names the user', async () => {
    render(<ApiExplorer routes={routes} actAsEnabled />)
    expect(panelProps.current.actAsUserId).toBe('u-remembered')
    await send()
    expect(execute.mock.calls[0][0].headers['x-act-as-user']).toBe('u-remembered')
    expect((responseProps.current.context as { actingAs: string }).actingAs).toBe('ana@example.test')
  })
})

describe('act-as off', () => {
  test('the remembered user is not sent, not on the chip and not on the response', async () => {
    render(<ApiExplorer routes={routes} actAsEnabled={false} />)
    expect(panelProps.current.actAsUserId).toBe('')
    expect(panelProps.current.actAsEnabled).toBe(false)
    await send()
    expect(execute.mock.calls[0][0].headers['x-act-as-user']).toBeUndefined()
    expect((responseProps.current.context as { actingAs: string | null }).actingAs).toBeNull()
  })

  test('the copied cURL does not carry it either', () => {
    render(<ApiExplorer routes={routes} actAsEnabled={false} />)
    expect((panelProps.current.onCopyCurl as () => string)()).not.toContain('x-act-as-user')
  })
})
