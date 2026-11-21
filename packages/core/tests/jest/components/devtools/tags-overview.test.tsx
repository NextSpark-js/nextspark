/**
 * @jest-environment jsdom
 *
 * #528: an open tag lists its test files as links to their Test Cases page, selector tags (`@SEL_*`) live in their own
 * collapsed group instead of "Other", and every tag has its own data-cy (two categories can share a key).
 */
import { describe, test, expect, jest } from '@jest/globals'
import { render, screen, fireEvent } from '@testing-library/react'

jest.mock('sonner', () => ({ toast: { success: jest.fn(), error: jest.fn() } }))
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('next/link', () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => <a href={href} {...rest}>{children}</a>,
}))
jest.mock('@nextsparkjs/registries/testing-registry', () => ({
  COVERAGE_SUMMARY: { tags: { testFiles: 3 } },
  TAGS_REGISTRY: {
    features: { billing: { tag: '@feat-billing', testCount: 1, files: ['tests/cypress/e2e/billing/pay.cy.ts'] } },
    blocks: { billing: { tag: '@b-billing', testCount: 1, files: ['contents/themes/x/tests/cypress/e2e/blocks/b.cy.ts', 'other/file.ts'] } },
    other: {
      smoke2: { tag: '@smoke2', testCount: 1, files: [] },
      SEL_login_btn: { tag: '@SEL_login_btn', testCount: 1, files: [] },
    },
  },
}))

import { TagsOverview } from '@/core/components/devtools/TagsOverview'
import { testDocPath, isSelectorTag } from '@/core/components/devtools/tag-utils'

describe('testDocPath', () => {
  test('maps a Cypress file to the documentation page, wherever the project root is', () => {
    expect(testDocPath('tests/cypress/e2e/auth/login.cy.ts')).toBe('/devtools/tests/auth/login.bdd.md')
    expect(testDocPath('contents/themes/x/tests/cypress/e2e/a/b.cy.tsx')).toBe('/devtools/tests/a/b.bdd.md')
  })
  test('is null for a file outside the e2e directory or not a Cypress file', () => {
    expect(testDocPath('other/file.ts')).toBeNull()
    expect(testDocPath('tests/cypress/e2e/a/readme.txt')).toBeNull()
  })
})

describe('isSelectorTag', () => {
  test('matches @SEL_ tags only', () => {
    expect(isSelectorTag('@SEL_x')).toBe(true)
    expect(isSelectorTag('@smoke')).toBe(false)
  })
})

describe('TagsOverview', () => {
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

  test('an open tag lists its files as links to the tests page, plain text when there is no page', () => {
    render(<TagsOverview />)
    fireEvent.click(screen.getByText('@b-billing'))
    const links = screen.getAllByRole('link').map((a) => a.getAttribute('href'))
    expect(links).toContain('/devtools/tests/blocks/b.bdd.md')
    expect(screen.getByText('file.ts')).toBeTruthy()
    expect(screen.getByText('file.ts').closest('a')).toBeNull()
  })
})
