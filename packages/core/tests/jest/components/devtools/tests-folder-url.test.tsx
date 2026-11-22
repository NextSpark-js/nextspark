/**
 * @jest-environment jsdom
 *
 * #550: a folder of the devtools test tree opened by URL shows its entries, with the folder open in the tree, and
 * asks the API for nothing; an unknown path keeps its not-found state, and a file is requested once the tree is known.
 */
import React from 'react'
import { render, screen, waitFor, cleanup } from '@testing-library/react'

let mockPathname = '/devtools/tests/auth'
jest.mock('next/navigation', () => ({ usePathname: () => mockPathname, useRouter: () => ({ push: jest.fn() }) }))
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string, values?: { count?: number }) => (values ? `${key}:${values.count}` : key),
}))
jest.mock('../../../../src/components/devtools/TestCoverageDashboard', () => ({ TestCoverageDashboard: () => <div>dashboard</div> }))
jest.mock('../../../../src/components/devtools/MarkdownViewer', () => ({ MarkdownViewer: ({ content }: { content: string }) => <div>{content}</div> }))
jest.mock('../../../../src/components/devtools/bdd', () => ({ BDDTestViewer: () => <div>bdd</div> }))

import { TestCasesViewer } from '../../../../src/components/devtools/TestCasesViewer'

const tree = [
  { name: 'auth', path: 'auth', type: 'folder', children: [{ name: 'login.md', path: 'auth/login.md', type: 'file' }] },
  { name: 'empty', path: 'empty', type: 'folder', children: [] },
]
const fetchMock = jest.fn()

beforeEach(() => {
  fetchMock.mockReset()
  fetchMock.mockImplementation(async (url: string) =>
    url.endsWith('/api/devtools/tests')
      ? { ok: true, json: async () => ({ data: { tree } }) }
      : { ok: true, json: async () => ({ data: { path: 'auth/login.md', content: 'file body' } }) }
  )
  ;(global as unknown as { fetch: unknown }).fetch = fetchMock
})
afterEach(cleanup)

const requested = () => fetchMock.mock.calls.map((c) => c[0] as string).filter((u) => !u.endsWith('/api/devtools/tests'))

test('a folder URL lists its entries, opens the folder in the tree and never asks the API for it', async () => {
  mockPathname = '/devtools/tests/auth'
  render(<TestCasesViewer initialPath="auth" />)
  const folder = await waitFor(() => {
    const el = document.querySelector('[data-cy="devtools-tests-folder"]')
    expect(el).not.toBeNull()
    return el!
  })
  expect(folder.textContent).toContain('login.md')
  expect(folder!.textContent).toContain('folderItems:1')
  await waitFor(() => expect(document.querySelector('[data-cy="dev-tests-folder-auth"]')!.getAttribute('aria-expanded')).toBe('true'))
  expect(document.querySelector('[data-cy="devtools-tests-error"]')).toBeNull()
  expect(requested()).toEqual([])
})

test('an empty folder says so', async () => {
  mockPathname = '/devtools/tests/empty'
  render(<TestCasesViewer initialPath="empty" />)
  expect(await screen.findByText('folderEmpty')).toBeInTheDocument()
  expect(requested()).toEqual([])
})

test('a path that is not in the tree keeps its not-found state and requests nothing', async () => {
  mockPathname = '/devtools/tests/nope'
  render(<TestCasesViewer initialPath="nope" />)
  await waitFor(() => expect(document.querySelector('[data-cy="devtools-tests-not-found"]')).not.toBeNull())
  expect(requested()).toEqual([])
})

test('a file is requested once, after the tree is known', async () => {
  mockPathname = '/devtools/tests/auth/login.md'
  render(<TestCasesViewer initialPath="auth/login.md" />)
  expect(await screen.findByText('file body')).toBeInTheDocument()
  expect(fetchMock.mock.calls[0][0]).toMatch(/\/api\/devtools\/tests$/)
  expect(requested()).toHaveLength(1)
})
