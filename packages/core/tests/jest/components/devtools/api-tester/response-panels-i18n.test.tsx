/**
 * @jest-environment jsdom
 *
 * #414: a cancelled or failed request is worded by the panels from the active locale; the hook carries a status, not text.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

let mockLocale = 'es'

jest.mock('next-intl', () => {
  const read = (namespace: string, key: string) =>
    `${namespace}.${key}`.split('.').reduce<unknown>((node, part) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined), require(`../../../../../src/messages/${mockLocale}/index`).default)
  return {
    useLocale: () => mockLocale,
    useTranslations: (namespace: string) => (key: string) => {
      const value = read(namespace, key)
      if (typeof value !== 'string') throw new Error(`missing ${namespace}.${key}`)
      return value
    },
  }
})

jest.mock('react-json-view-lite', () => ({ JsonView: () => null, allExpanded: () => true, collapseAllNested: () => false, defaultStyles: {}, darkStyles: {} }))
jest.mock('react-json-view-lite/dist/index.css', () => ({}), { virtual: true })
jest.mock('../../../../../src/providers/theme-provider', () => ({ useTheme: () => ({ resolvedTheme: 'light' }) }))

import { ApiResponsePanel } from '../../../../../src/components/devtools/api-explorer/ApiResponsePanel'
import { ResponseViewer } from '../../../../../src/components/devtools/api-tester/ResponseViewer'

afterEach(cleanup)

describe.each([
  ['ApiResponsePanel', ApiResponsePanel],
  ['ResponseViewer', ResponseViewer],
])('%s', (_name, Panel) => {
  test.each([
    ['es', 'Petición cancelada', 'Ocurrió un error'],
    ['de', 'Anfrage abgebrochen', null],
  ])('says a cancelled request in %s', (locale, cancelled) => {
    mockLocale = locale
    render(<Panel status="cancelled" response={null} error={null} />)
    expect(screen.getByText(cancelled)).toBeTruthy()
  })

  test('says an error with no message from the catalog', () => {
    mockLocale = 'es'
    render(<Panel status="error" response={null} error={null} />)
    expect(screen.queryByText('Unknown error occurred')).toBeNull()
    expect(screen.getByText(require('../../../../../src/messages/es/devtools.json').apiTester.responseStates.error)).toBeTruthy()
  })
})
