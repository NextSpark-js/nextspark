/**
 * The Users and Teams tables sort from their headers (the page asks the server) and copy an id from its row without
 * opening the row (#538).
 */
import React from 'react'
import { render, screen, fireEvent, act } from '@testing-library/react'

const mockPush = jest.fn()
jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))
jest.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
jest.mock('next/link', () => ({ __esModule: true, default: ({ href, children, ...rest }: React.ComponentProps<'a'>) => <a href={href as string} {...rest}>{children}</a> }))
jest.mock('@/core/lib/auth-client', () => ({ useSession: () => ({ data: { user: { id: 'viewer', role: 'developer' } }, isPending: false }) }))
jest.mock('@/core/components/users/tables/UserActions', () => ({ useUserActions: () => ({ dialog: null }), UserActionsMenu: () => null }))

import { UsersTable } from '@/core/components/users/tables/UsersTable'
import { TeamsTable } from '@/core/components/superadmin/tables/TeamsTable'
import { nextSort } from '@/core/components/users/tables/SortableHead'

const user = { id: 'user-0123456789', email: 'u@x', firstName: 'U', lastName: '', fullName: 'U', role: 'member', emailVerified: true, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' }
const team = { id: 'team-0123456789ab', name: 'Acme', owner: { id: 'o', name: 'Olive', email: 'o@x' }, memberCount: 3, createdAt: '2026-10-13T00:00:00Z', updatedAt: '2026-10-13T00:00:00Z' }

beforeEach(() => mockPush.mockClear())

describe('nextSort', () => {
  it('flips the direction of the sorted column and starts another one in its own first direction', () => {
    expect(nextSort({ key: 'name', order: 'asc' }, 'name')).toEqual({ key: 'name', order: 'desc' })
    expect(nextSort({ key: 'name', order: 'desc' }, 'name')).toEqual({ key: 'name', order: 'asc' })
    expect(nextSort({ key: 'name', order: 'asc' }, 'createdAt', 'desc')).toEqual({ key: 'createdAt', order: 'desc' })
    expect(nextSort({ key: 'createdAt', order: 'desc' }, 'name')).toEqual({ key: 'name', order: 'asc' })
  })
})

describe('Users headers', () => {
  it('sort by name, email and joined, and say which one is sorted', () => {
    const onSortChange = jest.fn()
    render(<UsersTable users={[user] as never} sort={{ key: 'createdAt', order: 'desc' }} onSortChange={onSortChange} />)
    expect(screen.getByRole('columnheader', { name: 'Joined' })).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getByRole('columnheader', { name: 'User' })).toHaveAttribute('aria-sort', 'none')
    fireEvent.click(screen.getByRole('button', { name: 'User' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', order: 'asc' })
    fireEvent.click(screen.getByRole('button', { name: 'Joined' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'createdAt', order: 'asc' })
    fireEvent.click(screen.getByRole('button', { name: 'Email' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'email', order: 'asc' })
  })

  it('stay plain text when the page does not sort', () => {
    render(<UsersTable users={[user] as never} />)
    expect(screen.queryByRole('button', { name: 'Joined' })).toBeNull()
  })
})

describe('Teams headers', () => {
  it('sort by team, members (biggest first) and created', () => {
    const onSortChange = jest.fn()
    render(<TeamsTable teams={[team] as never} sort={{ key: 'createdAt', order: 'desc' }} onSortChange={onSortChange} />)
    fireEvent.click(screen.getByRole('button', { name: 'Members' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'members', order: 'desc' })
    fireEvent.click(screen.getByRole('button', { name: 'Team' }))
    expect(onSortChange).toHaveBeenLastCalledWith({ key: 'name', order: 'asc' })
  })
})

describe('copy id', () => {
  it('copies the whole id of a user, not the shortened one, without opening the row', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<UsersTable users={[user] as never} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy ID' })) })
    expect(writeText).toHaveBeenCalledWith('user-0123456789')
    expect(mockPush).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Copied' })).toBeInTheDocument()
  })

  it('copies the id of a team', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined)
    Object.assign(navigator, { clipboard: { writeText } })
    render(<TeamsTable teams={[team] as never} />)
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Copy ID' })) })
    expect(writeText).toHaveBeenCalledWith('team-0123456789ab')
  })
})
