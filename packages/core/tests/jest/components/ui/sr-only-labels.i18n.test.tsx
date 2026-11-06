/**
 * @jest-environment jsdom
 */

/**
 * #405: the texts only a screen reader announces (pagination, breadcrumb, row actions, search clear, loading) come from
 * the active locale's `common` messages; without a provider they stay English. A scan keeps a new fixed English
 * `sr-only` text out of `src/components`.
 */
import { describe, test, expect, afterEach, jest } from '@jest/globals'
import { render, screen, cleanup } from '@testing-library/react'
import fs from 'node:fs'
import path from 'node:path'
import { Pagination, PaginationEllipsis, PaginationNext, PaginationPrevious } from '@/core/components/ui/pagination'
import { Breadcrumb, BreadcrumbEllipsis } from '@/core/components/ui/breadcrumb'
import { MultiSelectFilter } from '@/core/components/shared/MultiSelectFilter'
import { DoubleRange } from '@/core/components/ui/double-range'
import { SearchInput } from '@/core/components/superadmin/filters/SearchInput'
import { PaginationControls } from '@/core/components/superadmin/filters/PaginationControls'
import { DashboardAuthSkeleton } from '@/core/components/dashboard/layouts/DashboardAuthSkeleton'
import es from '@/core/messages/es/index'
import en from '@/core/messages/en/index'

let messagesInScope: Record<string, unknown> | null = null
jest.mock('next-intl', () => ({
  useMessages: () => {
    if (!messagesInScope) throw new Error('No intl context found')
    return messagesInScope
  },
}))

afterEach(() => {
  cleanup()
  messagesInScope = null
})

const a11y = es.common.a11y
const cases: Array<[string, () => React.ReactElement, string[], string[]]> = [
  [
    'Pagination',
    () => (
      <Pagination>
        <PaginationPrevious href="#" />
        <PaginationNext href="#" />
        <PaginationEllipsis />
      </Pagination>
    ),
    [a11y.pagination, a11y.goToPreviousPage, a11y.goToNextPage, a11y.morePages, es.common.buttons.previous, es.common.buttons.next],
    ['Pagination', 'Go to previous page', 'Go to next page', 'More pages', 'Previous', 'Next'],
  ],
  [
    'Breadcrumb',
    () => (
      <Breadcrumb>
        <BreadcrumbEllipsis />
      </Breadcrumb>
    ),
    [a11y.breadcrumb, a11y.more],
    ['Breadcrumb', 'More'],
  ],
  [
    'DoubleRange',
    () => <DoubleRange value={[1, 5]} onChange={() => {}} min={0} max={10} />,
    [a11y.minimumValue, a11y.maximumValue],
    ['Minimum value', 'Maximum value'],
  ],
  [
    'SearchInput',
    () => <SearchInput value="x" onChange={() => {}} />,
    [es.common.search.clear],
    ['Clear search'],
  ],
  [
    'PaginationControls',
    () => <PaginationControls page={2} totalPages={5} total={50} limit={10} onPageChange={() => {}} onLimitChange={() => {}} />,
    [a11y.firstPage, a11y.previousPage, a11y.nextPage, a11y.lastPage],
    ['First page', 'Previous page', 'Next page', 'Last page'],
  ],
  [
    'MultiSelectFilter',
    () => <MultiSelectFilter label="Color" options={[{ value: 'r', label: 'Red' }]} values={['r']} onChange={() => {}} />,
    [a11y.removeItem.replace('{name}', 'Red'), a11y.clearFilter.replace('{name}', 'Color')],
    ['Remove Red', 'Clear Color filter'],
  ],
  [
    'DashboardAuthSkeleton',
    () => <DashboardAuthSkeleton />,
    [a11y.loading],
    ['Loading'],
  ],
]

describe.each(cases)('%s', (_name, build, spanish, english) => {
  const asTextOrLabel = (text: string) => screen.queryAllByText(text, { exact: true }).length + document.querySelectorAll(`[aria-label="${text}"]`).length

  test("is announced in the active locale's language", () => {
    messagesInScope = { common: es.common }
    render(build())
    spanish.forEach((t) => expect(asTextOrLabel(t)).toBeGreaterThan(0))
    english.forEach((t, i) => spanish[i] !== t && expect(asTextOrLabel(t)).toBe(0))
  })

  test('is English with no provider', () => {
    render(build())
    english.forEach((t) => expect(asTextOrLabel(t)).toBeGreaterThan(0))
  })
})

describe('what the consumer sets wins over the locale', () => {
  test('moreLabel names BreadcrumbEllipsis and PaginationEllipsis', () => {
    messagesInScope = { common: es.common }
    render(
      <>
        <BreadcrumbEllipsis moreLabel="Custom crumbs" />
        <PaginationEllipsis moreLabel="Custom pages" />
      </>
    )
    expect(screen.queryAllByText('Custom crumbs')).toHaveLength(1)
    expect(screen.queryAllByText('Custom pages')).toHaveLength(1)
    expect(screen.queryAllByText(es.common.a11y.more)).toHaveLength(0)
    expect(screen.queryAllByText(es.common.a11y.morePages)).toHaveLength(0)
  })

  test('the aria-label of the consumer replaces the one of Breadcrumb, Pagination, PaginationPrevious and PaginationNext', () => {
    messagesInScope = { common: es.common }
    const { container } = render(
      <>
        <Breadcrumb aria-label="Mine crumbs" />
        <Pagination aria-label="Mine pages">
          <PaginationPrevious href="#" aria-label="Mine back" />
          <PaginationNext href="#" aria-label="Mine forth" />
        </Pagination>
      </>
    )
    const labels = [...container.querySelectorAll('[aria-label]')].map((e) => e.getAttribute('aria-label'))
    expect(labels).toEqual(['Mine crumbs', 'Mine pages', 'Mine back', 'Mine forth'])
  })
})

describe('the new keys', () => {
  test('exist in the six catalogs with a translation', async () => {
    for (const locale of ['de', 'en', 'es', 'fr', 'it', 'pt']) {
      const common = (await import(`@/core/messages/${locale}/index`)).default.common as typeof en.common
      for (const key of Object.keys(en.common.a11y) as Array<keyof typeof en.common.a11y>) {
        expect(typeof (common.a11y as Record<string, unknown>)[key]).toBe('string')
      }
    }
  })
})

describe('texts only a screen reader announces in src/components', () => {
  // A fixed English word in a `sr-only` element or in `aria-label="..."` is announced in English whatever the locale.
  const root = path.resolve(__dirname, '../../../../src/components')
  const walk = (dir: string): string[] =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name)
      return e.isDirectory() ? walk(p) : /\.tsx$/.test(e.name) ? [p] : []
    })
  // path (relative to src/components) -> [text that may stay fixed, reason]
  const allowed: Record<string, Array<[string, string]>> = {
    'superadmin/layouts/SuperadminSidebar.tsx': [['Exit Super Admin', 'the superadmin sidebar stays English until it is translated as a whole']],
    'docs/superadmin-docs-sidebar.tsx': [['Admin documentation navigation', 'the superadmin sidebar stays English until it is translated as a whole']],
  }
  // `[^>{]*` and `\s*` run over line breaks: the text may sit on a line of its own
  const fixedText = [/sr-only[^>{]*>\s*[A-Z][a-z]/g, /aria-label="[A-Z][a-z]/g]

  test('none is a fixed English text', () => {
    const offenders = walk(root).flatMap((file) => {
      const rel = path.relative(root, file)
      const source = fs.readFileSync(file, 'utf8')
      return fixedText.flatMap((re) =>
        [...source.matchAll(re)].flatMap((m) => {
          const end = source.indexOf('\n', m.index! + m[0].length)
          const found = source.slice(m.index, end < 0 ? undefined : end)
          if ((allowed[rel] ?? []).some(([text]) => found.includes(text))) return []
          return `${rel}:${source.slice(0, m.index).split('\n').length}: ${found.replace(/\s+/g, ' ')}`
        })
      )
    })
    expect(offenders).toEqual([])
  })
})
