/**
 * StaticIntlProvider tests
 *
 * Verifies that the PPR-compatible IntlProvider wraps children
 * and passes locale/messages to use-intl's IntlProvider.
 */

import React from 'react'
import { render, screen } from '@testing-library/react'

// Mock use-intl/react to avoid ESM transform issues in Jest
const mockIntlProvider = jest.fn(({ children }) => <>{children}</>)
jest.mock('use-intl/react', () => ({
  IntlProvider: (props: Record<string, unknown>) => {
    mockIntlProvider(props)
    return <>{props.children}</>
  },
}))

import { StaticIntlProvider } from '@nextsparkjs/core/providers/static-intl-provider'

describe('StaticIntlProvider', () => {
  beforeEach(() => {
    mockIntlProvider.mockClear()
  })

  it('renders children', () => {
    render(
      <StaticIntlProvider locale="es" messages={{ hello: 'Hola' }}>
        <span data-testid="child">Content</span>
      </StaticIntlProvider>
    )

    expect(screen.getByTestId('child')).toHaveTextContent('Content')
  })

  it('passes locale to IntlProvider', () => {
    render(
      <StaticIntlProvider locale="fr" messages={{}}>
        <div>Test</div>
      </StaticIntlProvider>
    )

    expect(mockIntlProvider).toHaveBeenCalledWith(
      expect.objectContaining({ locale: 'fr' })
    )
  })

  it('passes messages to IntlProvider', () => {
    const messages = { greeting: 'Hello', farewell: 'Goodbye' }

    render(
      <StaticIntlProvider locale="en" messages={messages}>
        <div>Test</div>
      </StaticIntlProvider>
    )

    expect(mockIntlProvider).toHaveBeenCalledWith(
      expect.objectContaining({ messages: expect.anything() })
    )
  })

  it('renders with empty messages without crashing', () => {
    render(
      <StaticIntlProvider locale="en" messages={{}}>
        <div data-testid="child">Content</div>
      </StaticIntlProvider>
    )

    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

describe('StaticIntlProvider onError', () => {
  it('ignores ENVIRONMENT_FALLBACK (the request-free provider never configures now/timeZone) and reports every other error', () => {
    const { onStaticIntlError } = jest.requireActual('@nextsparkjs/core/providers/static-intl-provider') as { onStaticIntlError: (error: unknown) => void }
    const report = jest.spyOn(console, 'error').mockImplementation(() => {})

    onStaticIntlError({ code: 'ENVIRONMENT_FALLBACK' })
    expect(report).not.toHaveBeenCalled()

    const missing = { code: 'MISSING_MESSAGE' }
    onStaticIntlError(missing)
    expect(report).toHaveBeenCalledWith(missing)

    report.mockRestore()
  })

  it('hands that handler to IntlProvider', () => {
    render(
      <StaticIntlProvider locale="en" messages={{}}>
        <div>Test</div>
      </StaticIntlProvider>
    )

    expect(mockIntlProvider).toHaveBeenCalledWith(expect.objectContaining({ onError: expect.any(Function) }))
  })
})
