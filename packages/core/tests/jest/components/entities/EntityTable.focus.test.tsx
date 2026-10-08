/**
 * EntityTable — where focus goes when the confirmation dialog of a row action closes.
 *
 * The menu item that opened the dialog unmounts with the menu, so without help focus falls to <body> (a keyboard
 * user loses their place). It returns to the row's menu button, or, once the row is deleted, to the next row's
 * (the previous row's for the last one), or to the table when no row is left.
 */
import { describe, it, expect, jest } from '@jest/globals'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({ usePermission: () => true }))
jest.mock('@/core/components/entities/EntityFieldRenderer', () => ({ EntityFieldRenderer: () => null }))

import { EntityTable } from '@/core/components/entities/EntityTable'
import type { EntityConfig } from '@/core/lib/entities/types'

const entityConfig = { slug: 'tasks', names: { singular: 'Task', plural: 'Tasks' }, fields: [] } as unknown as EntityConfig
type Row = { id: string; title: string }

function Harness({ initial, deleteDelayMs = 0 }: { initial: Row[]; deleteDelayMs?: number }) {
  const [rows, setRows] = useState(initial)
  return (
    <EntityTable<Row>
      entityConfig={entityConfig}
      data={rows}
      columns={[{ key: 'title', header: 'Title', render: (item) => item.title }]}
      useDefaultActions={false}
      showHeader={false}
      onDelete={async (id) => {
        // Like the app: the request finishes, and the list refreshes, after the dialog has closed
        if (deleteDelayMs) await new Promise((r) => setTimeout(r, deleteDelayMs))
        setRows((prev) => prev.filter((r) => r.id !== id))
      }}
      dropdownActions={[
        {
          id: 'delete',
          label: 'Delete',
          icon: null,
          onClick: () => {},
          variant: 'destructive',
          requiresConfirmation: true,
        },
      ]}
    />
  )
}

const rows = (...ids: string[]) => ids.map((id) => ({ id, title: `Task ${id}` }))
const menuOf = (id: string) => document.querySelector(`[data-cy="tasks-menu-${id}"]`) as HTMLElement

async function openDeleteDialog(user: ReturnType<typeof userEvent.setup>, id: string) {
  menuOf(id).focus()
  await user.keyboard('{Enter}')
  await user.click(await screen.findByRole('menuitem', { name: 'Delete' }))
  return screen.findByRole('alertdialog')
}

describe('EntityTable confirmation dialog focus', () => {
  it('returns focus to the row menu button when the dialog is dismissed', async () => {
    const user = userEvent.setup()
    render(<Harness initial={rows('a', 'b')} />)
    await openDeleteDialog(user, 'a')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(document.activeElement).toBe(menuOf('a')))
  })

  it('moves focus to the next row after the row is deleted', async () => {
    const user = userEvent.setup()
    render(<Harness initial={rows('a', 'b', 'c')} />)
    await openDeleteDialog(user, 'b')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(menuOf('b')).toBeNull())
    await waitFor(() => expect(document.activeElement).toBe(menuOf('c')))
  })

  it('moves focus to the next row when the delete finishes after the dialog has closed', async () => {
    const user = userEvent.setup()
    render(<Harness initial={rows('a', 'b', 'c')} deleteDelayMs={50} />)
    await openDeleteDialog(user, 'b')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    expect(document.activeElement).toBe(menuOf('c'))
    await waitFor(() => expect(menuOf('b')).toBeNull())
    expect(document.activeElement).toBe(menuOf('c'))
  })

  it('moves focus to the previous row when the last row is deleted', async () => {
    const user = userEvent.setup()
    render(<Harness initial={rows('a', 'b')} />)
    await openDeleteDialog(user, 'b')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(document.activeElement).toBe(menuOf('a')))
  })

  it('moves focus to the table when no row is left', async () => {
    const user = userEvent.setup()
    render(<Harness initial={rows('a')} />)
    await openDeleteDialog(user, 'a')
    await user.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(document.activeElement).toBe(document.querySelector('[data-cy="tasks-table-container"]')))
  })
})
