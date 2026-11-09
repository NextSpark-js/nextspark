/**
 * Productivity Dashboard Layout
 * Replaces core's DashboardShell, so it hydrates the client entity registry itself: the entity detail
 * and edit pages read their config from it.
 */

import type { ReactNode } from 'react'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import type { EntityConfig } from '@nextsparkjs/core/lib/entities/types'
import { serializeEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { EntityRegistryHydrator } from '@nextsparkjs/core/components/dashboard/layouts/EntityRegistryHydrator'
import ProductivityDashboardLayout from '@/templates/shared/ProductivityDashboardLayout'

export default function ProductivityDashboardMainLayout({ children }: { children: ReactNode }) {
  const entities = Object.values(ENTITY_REGISTRY)
    .map((entry) => entry.config)
    .filter((config): config is EntityConfig => 'slug' in config)
    .map(serializeEntityConfig)

  return (
    <EntityRegistryHydrator entities={entities}>
      <ProductivityDashboardLayout>{children}</ProductivityDashboardLayout>
    </EntityRegistryHydrator>
  )
}
