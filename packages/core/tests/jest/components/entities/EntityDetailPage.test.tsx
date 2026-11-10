import { describe, test, expect, jest } from '@jest/globals'
import { render, screen } from '@testing-library/react'
import type { EntityConfig } from '@/core/lib/entities/types'

let mockLocale = 'en'

const mockT = (key: string, values: Record<string, unknown> = {}) =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  (['entities.detail', key].join('.').split('.').reduce((node: any, part) => node?.[part], require('../../../../src/messages/en/index').default) as string).replace(/\{(\w+)\}/g, (_, name) => String(values[name]))
jest.mock('next-intl', () => ({
  useLocale: () => mockLocale,
  useTranslations: () => mockT,
}))

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}))

jest.mock('@/core/lib/api/entities', () => ({
  deleteEntityData: jest.fn(),
}))

jest.mock('@/core/components/entities/EntityPageHeader', () => ({
  EntityPageHeader: () => null,
}))

import { EntityDetailPage } from '@/core/components/entities/EntityDetailPage'

const WHEN = '2026-09-14T15:30:00Z'

const entityConfig = {
  slug: 'tasks',
  names: { singular: 'Task', plural: 'Tasks' },
  fields: [{ name: 'dueDate', type: 'date', display: { label: 'Due', showInDetail: true } }],
} as unknown as EntityConfig

function renderDates(locale: string) {
  mockLocale = locale
  render(
    <EntityDetailPage
      entityConfig={entityConfig}
      data={{ id: 'task-1', dueDate: WHEN, createdAt: WHEN, updatedAt: WHEN }}
    />
  )
  return new Date(WHEN).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })
}

describe('EntityDetailPage dates', () => {
  test.each(['en', 'es', 'de'])('shows the field, created and updated dates in the active locale (%s)', locale => {
    const expected = renderDates(locale)
    expect(screen.getAllByText(expected)).toHaveLength(3)
  })

  test('a Spanish locale gets Spanish month names', () => {
    const expected = renderDates('es')
    expect(expected).toMatch(/sept/)
    expect(screen.queryAllByText(/Sep 14, 2026/)).toHaveLength(0)
  })
})
