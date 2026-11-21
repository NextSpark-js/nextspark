/**
 * The superadmin filters have room for their longest label ("Todos los estados" was cut by a fixed 150 px) and the
 * superadmin catalogs do not name roles the list does not have (#536).
 */
import React from 'react'
import { render } from '@testing-library/react'

jest.mock('next-intl', () => jest.requireActual('../../__mocks__/next-intl.js'))

import { FilterDropdown } from '@/core/components/superadmin/filters/FilterDropdown'
import enAll from '@/core/messages/en/index'
import esAll from '@/core/messages/es/index'
import deAll from '@/core/messages/de/index'
import frAll from '@/core/messages/fr/index'
import itAll from '@/core/messages/it/index'
import ptAll from '@/core/messages/pt/index'

const en = enAll.superadmin
const catalogs = { en, es: esAll.superadmin, de: deAll.superadmin, fr: frAll.superadmin, it: itAll.superadmin, pt: ptAll.superadmin } as Record<string, { users: Record<string, unknown> }>

it('the select grows with its label instead of cutting it at a fixed width', () => {
  const { container } = render(<FilterDropdown value="__all__" onChange={() => {}} options={[]} allLabel="Todos los estados" />)
  const trigger = container.querySelector('[role="combobox"]')!
  expect(trigger.className).not.toMatch(/w-\[150px\]/)
  expect(trigger.className).toMatch(/\bw-auto\b/)
  expect(trigger.className).toMatch(/min-w-\[11rem\]/)
})

describe.each(Object.entries(catalogs))('%s catalog', (_locale, catalog) => {
  const text = JSON.stringify(catalog.users).toLowerCase()

  it('has no role in the users texts that the list does not have (collaborator was removed) nor the unused list of them', () => {
    expect(text).not.toMatch(/colab|collab|mitarbeiter/)
    expect(catalog.users).not.toHaveProperty('membersCollaboratorsAdmins')
  })
})

it('English says what the users list holds: members, developers and suspended accounts', () => {
  expect(en.users.descriptions.regularUsersDescription).toMatch(/members, developers and suspended accounts/)
})
