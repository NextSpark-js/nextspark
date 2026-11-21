/**
 * @jest-environment jsdom
 *
 * #526: an endpoint that opens with a body opens on the Body tab, so the payload is seen before it is sent.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
for (const child of ['MethodSelector', 'PathParamsEditor', 'KeyValueEditor', 'AuthSelector', 'PayloadEditor']) {
  jest.mock(`../../../../../src/components/devtools/api-tester/${child}`, () => new Proxy({}, { get: () => () => null }))
}
jest.mock('../../../../../src/components/devtools/api-explorer/PresetsTab', () => ({ PresetsTab: () => null }))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiDocsModal', () => ({ ApiDocsModal: () => null }))

import { ApiRequestPanel } from '../../../../../src/components/devtools/api-explorer/ApiRequestPanel'

afterEach(cleanup)

const noop = jest.fn()
const panel = (over: Record<string, unknown>) => (
  <ApiRequestPanel
    route={{ path: '/api/v1/things', methods: ['GET', 'POST'] } as never}
    basePath="/api/v1/things"
    method="POST"
    pathParams={[]}
    queryParams={[]}
    headers={[]}
    authType="session"
    apiKey=""
    bypassMode={false}
    selectedTeamId={null}
    actAsUserId=""
    actAsLabel=""
    body=""
    status="idle"
    onMethodChange={noop}
    onPathParamsChange={noop}
    onQueryParamsChange={noop}
    onHeadersChange={noop}
    onAuthTypeChange={noop}
    onApiKeyChange={noop}
    onBypassModeChange={noop}
    onTeamChange={noop}
    onActAsUserChange={noop}
    onBodyChange={noop}
    onSend={noop}
    onCancel={noop}
    onCopyCurl={() => ''}
    recentRequests={[]}
    onOpenRecent={noop}
    onClearRecent={noop}
    {...over}
  />
)

const selectedTab = () => screen.getAllByRole('tab').find((tab) => tab.getAttribute('aria-selected') === 'true')?.textContent

test('a POST that opens with a body opens on the Body tab', () => {
  render(panel({ body: '{"name":""}' }))
  expect(selectedTab()).toBe('tabs.body')
})

test('a POST with an empty body opens on Params', () => {
  render(panel({ body: '  ' }))
  expect(selectedTab()).toBe('tabs.params')
})

test('a GET never opens on Body, whatever the editor holds', () => {
  render(panel({ method: 'GET', body: '{"name":""}' }))
  expect(selectedTab()).toBe('tabs.params')
})

test('another endpoint decides again: the tab is remounted per method and path', () => {
  const { rerender } = render(panel({ body: '' }))
  expect(selectedTab()).toBe('tabs.params')
  rerender(panel({ basePath: '/api/v1/other', body: '{"a":1}' }))
  expect(selectedTab()).toBe('tabs.body')
})
