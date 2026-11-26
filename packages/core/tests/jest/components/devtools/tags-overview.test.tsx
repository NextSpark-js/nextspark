/**
 * @jest-environment jsdom
 *
 * #528: an open tag lists its test files as links to their Test Cases page, selector tags (`@SEL_*`) live in their own
 * collapsed group instead of "Other", and every tag has its own data-cy (two categories can share a key).
 */
import { describe, test, expect, jest, beforeEach } from '@jest/globals'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

// the screens keep their state in the URL (#519)
jest.mock('next/navigation', () => ({ useRouter: () => ({ replace: jest.fn(), push: jest.fn() }), usePathname: () => '/area', useSearchParams: () => new URLSearchParams() }))
jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}))
jest.mock('@nextsparkjs/registries/testing-registry', () => ({
  COVERAGE_SUMMARY: { tags: { testFiles: 3 } },
  TAGS_REGISTRY: {
    features: { billing: { tag: '@feat-billing', testCount: 1, files: ['tests/cypress/e2e/billing/pay.cy.ts', 'tests/cypress/e2e/billing/nodoc.cy.ts'] } },
    blocks: { billing: { tag: '@b-billing', testCount: 1, files: ['contents/themes/x/tests/cypress/e2e/blocks/b.cy.ts', 'other/file.ts'] } },
    other: {
      smoke2: { tag: '@smoke2', testCount: 1, files: [] },
      SEL_login_btn: { tag: '@SEL_login_btn', testCount: 1, files: [] },
    },
  },
}))

import { TagsOverview } from '@/core/components/devtools/TagsOverview'
import { testDocPath, docPaths, isSelectorTag } from '@/core/components/devtools/tag-utils'

const DOCS = new Set(['auth/login.bdd.md', 'a/b.bdd.md', 'blocks/b.bdd.md', 'billing/pay.bdd.md'])

describe('docPaths', () => {
  test('flattens the tree of documentation files', () => {
    const tree = [{ path: 'x', type: 'folder' as const, children: [{ path: 'x/y.bdd.md', type: 'file' as const }] }, { path: 'z.bdd.md', type: 'file' as const }]
    expect([...docPaths(tree)].sort()).toEqual(['x/y.bdd.md', 'z.bdd.md'])
  })
})

describe('testDocPath', () => {
  test('maps a Cypress file that has a doc to its page, wherever the project root is', () => {
    expect(testDocPath('tests/cypress/e2e/auth/login.cy.ts', DOCS)).toBe('/devtools/tests/auth/login.bdd.md')
    expect(testDocPath('contents/themes/x/tests/cypress/e2e/a/b.cy.tsx', DOCS)).toBe('/devtools/tests/a/b.bdd.md')
  })
  test('is null for a Cypress file with no doc, outside the e2e directory, or not a Cypress file', () => {
    expect(testDocPath('tests/cypress/e2e/auth/other.cy.ts', DOCS)).toBeNull()
    expect(testDocPath('other/file.ts', DOCS)).toBeNull()
    expect(testDocPath('tests/cypress/e2e/a/readme.txt', DOCS)).toBeNull()
  })
})

describe('isSelectorTag', () => {
  test('matches @SEL_ tags only', () => {
    expect(isSelectorTag('@SEL_x')).toBe(true)
    expect(isSelectorTag('@smoke')).toBe(false)
  })
})

describe('TagsOverview', () => {
  beforeEach(() => {
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ data: { tree: [
        { path: 'blocks', type: 'folder', children: [{ path: 'blocks/b.bdd.md', type: 'file' }] },
        { path: 'billing', type: 'folder', children: [{ path: 'billing/pay.bdd.md', type: 'file' }] },
      ] } }),
    })) as unknown as typeof fetch
  })

  test('selector tags are in their own group, collapsed, and out of Other', () => {
    render(<TagsOverview />)
    expect(screen.getByText('@smoke2')).toBeTruthy()
    expect(screen.queryByText('@SEL_login_btn')).toBeNull()
    fireEvent.click(screen.getByText('categories.selectors'))
    expect(screen.getByText('@SEL_login_btn')).toBeTruthy()
  })

  test('tags that share a key have distinct data-cy', () => {
    const { container } = render(<TagsOverview />)
    const cys = [...container.querySelectorAll('[data-cy^="devtools-tags-tag-"]')].map((e) => e.getAttribute('data-cy'))
    expect(new Set(cys).size).toBe(cys.length)
    expect(cys).toEqual(expect.arrayContaining(['devtools-tags-tag-@feat-billing', 'devtools-tags-tag-@b-billing']))
  })

  test('an open tag links the files that have a doc and shows the rest as plain text', async () => {
    render(<TagsOverview />)
    fireEvent.click(screen.getByText('@b-billing'))
    await waitFor(() => expect(screen.getAllByRole('link').map((a) => a.getAttribute('href'))).toContain('/devtools/tests/blocks/b.bdd.md'))
    expect(screen.getByText('file.ts').closest('a')).toBeNull()
  })

  test('a test file without a doc is plain text, not a link to a page that does not exist', async () => {
    render(<TagsOverview />)
    fireEvent.click(screen.getByText('@feat-billing'))
    await waitFor(() => expect(screen.getByText('pay.cy.ts').closest('a')).not.toBeNull())
    expect(screen.getByText('nodoc.cy.ts').closest('a')).toBeNull()
  })
})

describe('TagsOverview tree fetch (#544)', () => {
  const TREE = { data: { tree: [{ path: 'blocks', type: 'folder', children: [{ path: 'blocks/b.bdd.md', type: 'file' }] }] } }
  const fileLink = () => screen.getByText('b.cy.ts').closest('a')

  test('a second tag opened before the answer does not fetch again, and no file links before the tree arrives', async () => {
    let resolve!: (v: unknown) => void
    const fetchMock = jest.fn(() => new Promise((r) => { resolve = r }))
    global.fetch = fetchMock as unknown as typeof fetch
    render(<TagsOverview />)
    fireEvent.click(screen.getByText('@b-billing'))
    fireEvent.click(screen.getByText('@feat-billing'))
    fireEvent.click(screen.getByText('@b-billing'))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fileLink()).toBeNull()
    resolve({ ok: true, json: async () => TREE })
    await waitFor(() => expect(fileLink()).not.toBeNull())
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  test.each([
    ['a response that is not ok', async () => ({ ok: false, json: async () => ({}) })],
    ['a request that rejects', async () => { throw new Error('offline') }],
  ])('%s is not asked again when another tag is opened, and files stay plain text', async (_name, answer) => {
    const fetchMock = jest.fn(answer)
    global.fetch = fetchMock as unknown as typeof fetch
    render(<TagsOverview />)
    fireEvent.click(screen.getByText('@b-billing'))
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1))
    await new Promise((r) => setTimeout(r, 0))
    fireEvent.click(screen.getByText('@feat-billing'))
    fireEvent.click(screen.getByText('@b-billing'))
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fileLink()).toBeNull()
  })
})
