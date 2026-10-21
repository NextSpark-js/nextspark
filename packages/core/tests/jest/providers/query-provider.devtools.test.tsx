/**
 * The React Query devtools (#341) are never imported with NEXT_PUBLIC_RQ_DEVTOOLS off, and with it on they load lazily,
 * after the provider module, instead of with it.
 */
jest.mock('next-intl', () => ({
  useTranslations: () => (key: string) => key,
}))
jest.mock('sonner', () => ({ toast: { info: jest.fn() } }))

const devtoolsLoaded = jest.fn()
jest.mock('@tanstack/react-query-devtools', () => {
  devtoolsLoaded()
  return { ReactQueryDevtools: () => require('react').createElement('div', { 'data-testid': 'devtools' }) }
})

import React from 'react'
import { render, screen, waitFor } from '@testing-library/react'

const original = process.env.NEXT_PUBLIC_RQ_DEVTOOLS

/** The provider module evaluated afresh for a flag value: the flag is read when the module is evaluated, as the bundler inlines it at build time. */
function load(flag: string | undefined) {
  if (flag === undefined) delete process.env.NEXT_PUBLIC_RQ_DEVTOOLS
  else process.env.NEXT_PUBLIC_RQ_DEVTOOLS = flag
  let element: React.ReactElement | undefined
  jest.isolateModules(() => {
    // one React for the test and the module, or hooks see a null dispatcher
    jest.doMock('react', () => React)
    const { QueryProvider } = require('@/core/providers/query-provider') as typeof import('@/core/providers/query-provider')
    element = React.createElement(QueryProvider, null, React.createElement('p', null, 'page'))
  })
  return element!
}

beforeEach(() => {
  devtoolsLoaded.mockClear()
})

afterAll(() => {
  if (original === undefined) delete process.env.NEXT_PUBLIC_RQ_DEVTOOLS
  else process.env.NEXT_PUBLIC_RQ_DEVTOOLS = original
})

describe('QueryProvider devtools', () => {
  it('never loads the devtools package when the flag is off', async () => {
    const element = load(undefined)
    render(element)
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.getByText('page')).toBeTruthy()
    expect(screen.queryByTestId('devtools')).toBeNull()
    expect(devtoolsLoaded).not.toHaveBeenCalled()
  })

  it('loads them after the provider module, not with it, when the flag is on', async () => {
    const element = load('true')
    expect(devtoolsLoaded).not.toHaveBeenCalled()
    render(element)
    expect(screen.getByText('page')).toBeTruthy()
    await waitFor(() => expect(screen.getByTestId('devtools')).toBeTruthy())
    expect(devtoolsLoaded).toHaveBeenCalledTimes(1)
  })
})
