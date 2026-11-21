/**
 * @jest-environment jsdom
 *
 * #523: the API Explorer opens with a team chosen and complains about a missing one only after a send.
 */
import React from 'react'
import { render, screen, cleanup } from '@testing-library/react'

jest.mock('next-intl', () => ({ useTranslations: () => (key: string) => key }))
jest.mock('../../../../../src/hooks/teams', () => ({
  useUserTeams: () => ({ teams: [{ id: 't1', name: 'One', slug: 'one' }], isLoading: false }),
  useTeamSearch: () => ({ teams: [], totalCount: 0, isLoading: false }),
}))
jest.mock('../../../../../src/hooks/useDebounce', () => ({ useDebounce: (v: string) => v }))

import { pickDefaultTeamId } from '../../../../../src/components/devtools/api-explorer/explorer-helpers'
import { TeamSelector } from '../../../../../src/components/devtools/api-tester/TeamSelector'

afterEach(cleanup)

const teams = [{ id: 'a' }, { id: 'b' }]

describe('pickDefaultTeamId', () => {
  test('keeps the team that is already set', () => {
    expect(pickDefaultTeamId(teams, 'zzz', 'a')).toBe('zzz')
  })
  test('uses the dashboard active team when the user belongs to it', () => {
    expect(pickDefaultTeamId(teams, null, 'b')).toBe('b')
  })
  test('ignores an active team the user is not in', () => {
    expect(pickDefaultTeamId(teams, null, 'x')).toBeNull()
  })
  test('uses the only team when there is one', () => {
    expect(pickDefaultTeamId([{ id: 'solo' }], null, null)).toBe('solo')
  })
  test('does not guess among several teams', () => {
    expect(pickDefaultTeamId(teams, null, null)).toBeNull()
  })
})

describe('TeamSelector error', () => {
  const noop = () => {}
  test('no team and no send yet: no error', () => {
    render(<TeamSelector selectedTeamId={null} onTeamChange={noop} bypassMode={false} />)
    expect(screen.queryByText('required')).toBeNull()
  })
  test('no team after a send: the error shows', () => {
    render(<TeamSelector selectedTeamId={null} onTeamChange={noop} bypassMode={false} showError />)
    expect(screen.getByText('required')).toBeTruthy()
  })
  test('a chosen team never shows it', () => {
    render(<TeamSelector selectedTeamId="t1" onTeamChange={noop} bypassMode={false} showError />)
    expect(screen.queryByText('required')).toBeNull()
  })
})
