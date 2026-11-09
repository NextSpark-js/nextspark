/**
 * A dashboard layout that replaces DashboardShell hydrates the client entity registry through
 * EntityRegistryHydrator: without it useEntityConfig answers "not found in the registry" (#417).
 */
import React from 'react'
import { render, screen } from '@testing-library/react'
import { EntityRegistryHydrator } from '../../../../../src/components/dashboard/layouts/EntityRegistryHydrator'
import { getAllEntityConfigs } from '../../../../../src/lib/entities/registry.client'
import type { SerializableEntityConfig } from '../../../../../src/lib/entities/serialization'

const contacts = { slug: 'contacts', enabled: true, iconName: 'Users', i18nFallbackLocale: 'en' } as unknown as SerializableEntityConfig

test('children see the entities in the client registry on their first render', () => {
  let seen: string[] = []
  const Child = () => {
    seen = getAllEntityConfigs().map(e => e.slug)
    return <span>child</span>
  }
  render(<EntityRegistryHydrator entities={[contacts]}><Child /></EntityRegistryHydrator>)
  expect(screen.getByText('child')).toBeTruthy()
  expect(seen).toEqual(['contacts'])
})
