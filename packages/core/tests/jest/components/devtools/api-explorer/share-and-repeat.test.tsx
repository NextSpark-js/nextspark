/**
 * @jest-environment jsdom
 *
 * #525: a request can be copied as cURL (API key masked), shared through the query string in the address, and
 * repeated from a Recent list of the last 20.
 */
import React from 'react'
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
for (const child of ['MethodSelector', 'PathParamsEditor', 'KeyValueEditor', 'AuthSelector', 'PayloadEditor']) {
  jest.mock(`../../../../../src/components/devtools/api-tester/${child}`, () => new Proxy({}, { get: () => () => null }))
}
jest.mock('../../../../../src/components/devtools/api-explorer/PresetsTab', () => ({ PresetsTab: () => null }))
jest.mock('../../../../../src/components/devtools/api-explorer/ApiDocsModal', () => ({ ApiDocsModal: () => null }))

import {
  buildCurl,
  buildRequestHeaders,
  maskApiKey,
  pushRecent,
  queryToSearch,
  searchToRows,
  RECENT_LIMIT,
  type RecentRequest,
} from '../../../../../src/components/devtools/api-explorer/explorer-helpers'
import { RecentRequests } from '../../../../../src/components/devtools/api-explorer/RecentRequests'
import { ApiRequestPanel } from '../../../../../src/components/devtools/api-explorer/ApiRequestPanel'

afterEach(cleanup)

const row = (key: string, value: string, enabled = true) => ({ id: key, key, value, enabled })

describe('buildRequestHeaders', () => {
  test('adds bypass, team and act-as, and the user headers win', () => {
    expect(
      buildRequestHeaders({
        bypassMode: true,
        selectedTeamId: 't1',
        actAsUserId: ' u1 ',
        headers: [row('x-team-id', 'mine'), row('x-off', 'no', false), row('', 'blank')],
      })
    ).toEqual({ 'x-admin-bypass': 'confirm-cross-team-access', 'x-team-id': 'mine', 'x-act-as-user': 'u1' })
  })
  test('nothing set, nothing sent', () => {
    expect(buildRequestHeaders({ bypassMode: false, selectedTeamId: null, actAsUserId: '', headers: [] })).toEqual({})
  })
})

describe('maskApiKey', () => {
  test('keeps the ends of a long key and hides a short one', () => {
    expect(maskApiKey('sk_live_abcdef123456')).toBe('sk_l••••3456')
    expect(maskApiKey('short')).toBe('••••')
  })
})

describe('buildCurl', () => {
  test('masks the API key and never prints it', () => {
    const curl = buildCurl({ method: 'GET', url: 'http://x.test/api/v1/a?b=1', headers: {}, authType: 'apiKey', apiKey: 'sk_live_abcdef123456' })
    expect(curl).toContain("-H 'x-api-key: sk_l••••3456'")
    expect(curl).not.toContain('abcdef123456')
    expect(curl.startsWith("curl -X GET 'http://x.test/api/v1/a?b=1'")).toBe(true)
  })
  test('a session request carries a cookie placeholder, not a key header', () => {
    const curl = buildCurl({ method: 'GET', url: 'http://x.test/a', headers: {}, authType: 'session', apiKey: 'sk_live_abcdef123456' })
    expect(curl).toContain('Cookie: <your-session-cookie>')
    expect(curl).not.toContain('x-api-key')
  })
  test('sends the body of a POST, quoting single quotes, and omits it for a GET', () => {
    const post = buildCurl({ method: 'POST', url: 'http://x.test/a', headers: { 'x-team-id': 't1' }, body: `{"n":"it's"}`, authType: 'session' })
    expect(post).toContain(`-d '{"n":"it'\\''s"}'`)
    expect(post).toContain("-H 'x-team-id: t1'")
    expect(buildCurl({ method: 'GET', url: 'http://x.test/a', headers: {}, body: '{"a":1}', authType: 'session' })).not.toContain('-d')
  })
})

describe('the query string in the address', () => {
  test('writes only the enabled, filled rows', () => {
    expect(queryToSearch([row('a', '1'), row('b', ''), row('c', '3', false), row('d x', 'e&f')])).toBe('?a=1&d+x=e%26f')
    expect(queryToSearch([row('', '')])).toBe('')
  })
  test('reads it back as the same rows', () => {
    const search = queryToSearch([row('a', '1'), row('d x', 'e&f')])
    expect(searchToRows(search).map(({ key, value, enabled }) => ({ key, value, enabled }))).toEqual([
      { key: 'a', value: '1', enabled: true },
      { key: 'd x', value: 'e&f', enabled: true },
    ])
    expect(searchToRows('')).toEqual([])
  })
})

describe('pushRecent', () => {
  const entry = (path: string, status: number | null = 200, at = 1): RecentRequest => ({ method: 'GET', path, pathParams: {}, query: [], body: '', status, at })

  test('puts the newest first and keeps only the last 20', () => {
    let list: RecentRequest[] = []
    for (let i = 0; i < 25; i++) list = pushRecent(list, entry(`/api/${i}`))
    expect(list).toHaveLength(RECENT_LIMIT)
    expect(list[0].path).toBe('/api/24')
    expect(list[RECENT_LIMIT - 1].path).toBe('/api/5')
  })
  test('a repeated request moves up with its new status instead of appearing twice', () => {
    let list = pushRecent([], entry('/api/a', 500, 1))
    list = pushRecent(list, entry('/api/b'))
    list = pushRecent(list, entry('/api/a', 200, 3))
    expect(list.map((item) => item.path)).toEqual(['/api/a', '/api/b'])
    expect(list[0].status).toBe(200)
  })
  test('the same path with other params is another request', () => {
    const a = { ...entry('/api/a'), query: [{ key: 'q', value: '1' }] }
    expect(pushRecent([a], entry('/api/a'))).toHaveLength(2)
  })
})

describe('RecentRequests', () => {
  const item: RecentRequest = { method: 'GET', path: '/api/v1/x', pathParams: {}, query: [{ key: 'q', value: '1' }], body: '', status: 404, at: 1 }
  test('lists a request with its params and status and reopens it on click', () => {
    const onOpen = jest.fn()
    render(<RecentRequests items={[item]} onOpen={onOpen} onClear={() => {}} />)
    fireEvent.click(screen.getByText('title'))
    fireEvent.click(screen.getByText('/api/v1/x?q=1'))
    expect(onOpen).toHaveBeenCalledWith(item)
    expect(screen.getByText('404')).toBeTruthy()
  })
  test('says it is empty', () => {
    render(<RecentRequests items={[]} onOpen={() => {}} onClear={() => {}} />)
    fireEvent.click(screen.getByText('title'))
    expect(screen.getByText('empty')).toBeTruthy()
  })
})

describe('Copy cURL in the request panel', () => {
  test('puts the command on the clipboard and confirms', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    const noop = jest.fn()
    render(
      <ApiRequestPanel
        route={{ path: '/api/v1/me', methods: ['GET'] } as never}
        basePath="/api/v1/me"
        method="GET"
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
        onCopyCurl={() => 'curl -X GET x'}
        recentRequests={[]}
        onOpenRecent={noop}
        onClearRecent={noop}
      />
    )
    fireEvent.click(screen.getByText('copyCurl'))
    await waitFor(() => expect(screen.getByText('curlCopied')).toBeTruthy())
    expect(writeText).toHaveBeenCalledWith('curl -X GET x')
  })
})
