/**
 * @jest-environment jsdom
 *
 * #524: acting as another user is chosen from a search, stays visible next to Send with a one-click exit, and
 * the response says which auth, team and identity the request used.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => {
  const messages = require('../../../../../src/messages/en/devtools.json')
  const read = (namespace: string, key: string, values?: Record<string, string>) => {
    const value = `${namespace}.${key}`
      .replace(/^devtools\./, '')
      .split('.')
      .reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), messages)
    if (typeof value !== 'string') throw new Error(`missing ${namespace}.${key}`)
    return value.replace(/\{(\w+)\}/g, (_m, name) => values?.[name] ?? '')
  }
  return { useLocale: () => 'en', useTranslations: (ns: string) => (key: string, values?: Record<string, string>) => read(ns, key, values) }
})
jest.mock('react-json-view-lite', () => ({ JsonView: () => null, allExpanded: () => true, collapseAllNested: () => false, defaultStyles: {}, darkStyles: {} }))
jest.mock('react-json-view-lite/dist/index.css', () => ({}), { virtual: true })
jest.mock('../../../../../src/providers/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))
for (const child of ['MethodSelector', 'PathParamsEditor', 'KeyValueEditor', 'AuthSelector', 'PayloadEditor']) {
  jest.mock(`../../../../../src/components/devtools/api-tester/${child}`, () => new Proxy({}, { get: () => () => null }))
}
jest.mock('../../../../../src/components/devtools/api-explorer/PresetsTab', () => ({ PresetsTab: () => null }))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiDocsModal', () => ({ ApiDocsModal: () => null }))

import { toActAsUser } from '../../../../../src/components/devtools/api-explorer/explorer-helpers'
import { ApiRequestPanel } from '../../../../../src/components/devtools/api-explorer/ApiRequestPanel'
import { ApiResponsePanel } from '../../../../../src/components/devtools/api-explorer/ApiResponsePanel'

afterEach(cleanup)

describe('toActAsUser', () => {
  test('labels the user by email and keeps the name for the list', () => {
    expect(toActAsUser({ id: 'u1', email: 'ana@example.test', firstName: 'Ana', lastName: 'Diaz', role: 'member' })).toEqual({
      id: 'u1',
      label: 'ana@example.test',
      name: 'Ana Diaz',
      role: 'member',
    })
  })
  test('a user with no name has none to show', () => {
    expect(toActAsUser({ id: 'u2', email: 'x@example.test' }).name).toBe('')
  })
  test('a name that repeats the email is not shown twice', () => {
    expect(toActAsUser({ id: 'u3', email: 'x@example.test', firstName: 'x@example.test' }).name).toBe('')
  })
})

const panelProps = (over: Record<string, unknown> = {}) => ({
  route: { path: '/api/v1/me', methods: ['GET'] },
  basePath: '/api/v1/me',
  method: 'GET' as const,
  pathParams: [],
  queryParams: [],
  headers: [],
  authType: 'session' as const,
  apiKey: '',
  bypassMode: false,
  selectedTeamId: null,
  actAsUserId: '',
  actAsLabel: '',
  body: '',
  status: 'idle' as const,
  onMethodChange: jest.fn(),
  onPathParamsChange: jest.fn(),
  onQueryParamsChange: jest.fn(),
  onHeadersChange: jest.fn(),
  onAuthTypeChange: jest.fn(),
  onApiKeyChange: jest.fn(),
  onBypassModeChange: jest.fn(),
  onTeamChange: jest.fn(),
  onActAsUserChange: jest.fn(),
  onBodyChange: jest.fn(),
  onSend: jest.fn(),
  onCancel: jest.fn(),
  onCopyCurl: () => '',
  recentRequests: [],
  onOpenRecent: jest.fn(),
  onClearRecent: jest.fn(),
  ...over,
})

describe('the acting-as chip', () => {
  test('is absent for your own session', () => {
    render(<ApiRequestPanel {...panelProps()} />)
    expect(screen.queryByText(/Acting as/)).toBeNull()
  })
  test('names the user and clears the override in one click', () => {
    const props = panelProps({ actAsUserId: 'u1', actAsLabel: 'ana@example.test' })
    render(<ApiRequestPanel {...props} />)
    const chip = screen.getByText('Acting as ana@example.test').closest('button') as HTMLElement
    fireEvent.click(chip)
    expect(props.onActAsUserChange).toHaveBeenCalledWith('', '')
  })
})

describe('the response context line', () => {
  const response = { status: 200, statusText: 'OK', headers: {}, body: {}, timing: 5 }
  test('says the auth, the team and the identity used', () => {
    render(
      <ApiResponsePanel
        status="success"
        response={response}
        error={null}
        context={{ auth: 'session', team: 'Acme', crossTeam: false, actingAs: 'ana@example.test' }}
      />
    )
    expect(screen.getByText('Session · Team: Acme · As ana@example.test')).toBeTruthy()
  })
  test('says cross-team and no team', () => {
    render(<ApiResponsePanel status="success" response={response} error={null} context={{ auth: 'apiKey', team: null, crossTeam: true, actingAs: null }} />)
    expect(screen.getByText('API key · Cross-team')).toBeTruthy()
  })
  test('no context, no line', () => {
    render(<ApiResponsePanel status="success" response={response} error={null} />)
    expect(screen.queryByText(/Session/)).toBeNull()
  })
})
