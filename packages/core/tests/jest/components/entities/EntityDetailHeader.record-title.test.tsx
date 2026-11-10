/**
 * @jest-environment jsdom
 *
 * The header of a record's detail and edit pages names the record (#421): its title or name, else the first text
 * column of the entity's list, and the entity's name only when the record has none of them.
 */
import React from 'react'
import { render, screen } from '@testing-library/react'

jest.mock('next/navigation', () => ({ useRouter: () => ({ push: jest.fn() }) }))
jest.mock('@/core/lib/permissions/hooks', () => ({
  usePermissions: (map: Record<string, string>) => Object.fromEntries(Object.keys(map).map(key => [key, false])),
}))

import { EntityDetailHeader } from '@/core/components/entities/EntityDetailHeader'
import { getRecordTitle } from '@/core/lib/entities/entity-text'
import { contactsEntityConfig } from '../../../../templates/projects/crm/entities/contacts/contacts.config'
import { activitiesEntityConfig } from '../../../../templates/projects/crm/entities/activities/activities.config'
import type { EntityConfig } from '@/core/lib/entities/types'

const contacts = contactsEntityConfig as EntityConfig
const activities = activitiesEntityConfig as EntityConfig

describe('the detail header', () => {
  test('names a contact by the field its list leads with', () => {
    render(<EntityDetailHeader entityConfig={contacts} mode="view" entity={{ id: 'c1', firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com' }} />)
    expect(screen.getByRole('heading', { name: 'Ana' })).toBeTruthy()
  })

  test('skips a select column to the first text one (an activity is named by its subject)', () => {
    render(<EntityDetailHeader entityConfig={activities} mode="edit" entity={{ id: 'a1', type: 'call', subject: 'Llamada de seguimiento' }} />)
    expect(screen.getByRole('heading', { name: 'Llamada de seguimiento' })).toBeTruthy()
  })
})

describe('getRecordTitle', () => {
  test('a title or a name wins, and a record without readable fields gets the fallback', () => {
    expect(getRecordTitle(contacts, { title: 'Dr.', firstName: 'Ana' }, 'contact')).toBe('Dr.')
    expect(getRecordTitle(contacts, { name: 'Ana Pérez', firstName: 'Ana' }, 'contact')).toBe('Ana Pérez')
    expect(getRecordTitle(contacts, { firstName: '  ', lastName: 'Pérez' }, 'contact')).toBe('Pérez')
    expect(getRecordTitle(contacts, { id: 'c1' }, 'contact')).toBe('contact')
    expect(getRecordTitle(contacts, null, 'contact')).toBe('contact')
  })
})
