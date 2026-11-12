/**
 * #413: the dashboard, superadmin and devtools areas (DashboardProviders) set `<html lang>` to the locale they render in:
 * the root layout of a Cache Components host is prerendered with the default's.
 */
import React from 'react'
import { render } from '@testing-library/react'

let mockLocale = 'de'
jest.mock('next-intl', () => ({ useLocale: () => mockLocale }))
jest.mock('../../../src/providers/query-provider', () => ({ QueryProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('../../../src/contexts/TeamContext', () => ({ TeamProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>, useOptionalTeamContext: () => null }))
jest.mock('../../../src/contexts/SubscriptionContext', () => ({ SubscriptionProvider: ({ children }: { children: React.ReactNode }) => <>{children}</> }))
jest.mock('../../../src/components/ui/sonner', () => ({ Toaster: () => null }))

import { DashboardProviders } from '../../../src/providers/DashboardProviders'

test('DashboardProviders puts the active locale on <html>', () => {
  document.documentElement.lang = 'en'
  render(<DashboardProviders>page</DashboardProviders>)
  expect(document.documentElement.lang).toBe('de')
})

describe('HtmlLang (#442)', () => {
  const { HtmlLang } = require('../../../src/providers/html-lang')
  test('sets the locale, puts the previous lang back on unmount and follows a locale change', () => {
    document.documentElement.lang = 'en'
    const view = render(<HtmlLang />)
    expect(document.documentElement.lang).toBe('de')
    mockLocale = 'fr'
    view.rerender(<HtmlLang />)
    expect(document.documentElement.lang).toBe('fr')
    view.unmount()
    expect(document.documentElement.lang).toBe('en')
    mockLocale = 'de'
  })
})
