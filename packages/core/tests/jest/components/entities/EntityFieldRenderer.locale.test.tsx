/**
 * @jest-environment jsdom
 *
 * #413: the date, date-time and number fields of an entity are written in the active locale, not in the browser's.
 */
import React from 'react'
import { render } from '@testing-library/react'

let mockLocale = 'de'
jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key, useLocale: () => mockLocale }))
jest.mock('@/core/hooks/useDisplayUrls', () => ({ useDisplayUrls: () => (url: string) => url, useSignedProps: (props: unknown) => props }))
jest.mock('@/core/hooks/useMediaUpload', () => ({ useMediaUpload: () => ({ mutateAsync: jest.fn() }) }))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: null, isPending: false }) }))
jest.mock('next/image', () => ({ __esModule: true, default: () => null }))

import { EntityFieldRenderer } from '@/core/components/entities/EntityFieldRenderer'
import type { EntityField } from '@/core/lib/entities/types'

const field = (type: string) => ({ name: 'f', type, display: { label: 'F', showInList: true, showInDetail: true } }) as unknown as EntityField
const show = (type: string, value: unknown) => {
  return render(<EntityFieldRenderer field={field(type)} value={value} mode="list" />).container.textContent
}

describe('EntityFieldRenderer values in the active locale', () => {
  test.each([
    ['de', 'Dez'],
    ['es', 'dic'],
  ])('a date in %s names the month in that language', (locale, month) => {
    mockLocale = locale
    expect(show('date', '2026-12-24T12:00:00Z')).toContain(month)
  })

  test('a number uses the locale separators', () => {
    mockLocale = 'de'
    expect(show('number', 1234567.5)).toContain('1.234.567,5')
  })

  test('a date-time carries the time in the locale', () => {
    mockLocale = 'de'
    expect(show('datetime', '2026-12-24T12:00:00Z')).toMatch(/^24\.12\.2026/)
  })
})
