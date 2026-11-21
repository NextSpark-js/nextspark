/**
 * @jest-environment jsdom
 *
 * #524: with act-as off on the server the picker cannot be opened and says why.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('../../../../../src/components/devtools/api-tester/TeamSelector', () => ({ TeamSelector: () => null }))
jest.mock('@tanstack/react-query', () => ({ useQuery: () => ({ data: [], isFetching: false, isError: false }) }))

import { AuthSelector } from '../../../../../src/components/devtools/api-tester/AuthSelector'

afterEach(cleanup)

const noop = () => {}
const renderSelector = (actAsDisabled: boolean) =>
  render(
    <AuthSelector
      authType="session"
      apiKey=""
      bypassMode={false}
      selectedTeamId={null}
      actAsUserId=""
      actAsDisabled={actAsDisabled}
      onAuthTypeChange={noop}
      onApiKeyChange={noop}
      onBypassModeChange={noop}
      onTeamChange={noop}
      onActAsUserChange={noop}
    />
  )

const picker = () => document.querySelector('[data-cy="devtools-api-auth-act-as-user"]')

test('act-as off: the picker is disabled and the reason is on screen', () => {
  renderSelector(true)
  expect(picker()?.hasAttribute('disabled')).toBe(true)
  expect(screen.getByText('actAsUserDisabled')).toBeTruthy()
})

test('act-as on: the picker is open to use and says nothing', () => {
  renderSelector(false)
  expect(picker()?.hasAttribute('disabled')).toBe(false)
  expect(screen.queryByText('actAsUserDisabled')).toBeNull()
})
