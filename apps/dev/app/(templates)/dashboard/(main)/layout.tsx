import { DashboardShell } from '@nextsparkjs/core/components/dashboard/layouts/DashboardShell'
import { getRegisteredEntities } from '@nextsparkjs/core/lib/entities/queries'
import { serializeEntityConfig, type SerializableEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

// Default main dashboard layout component
// Note: AuthGuard removed - authentication guaranteed by parent CoreDashboardLayout
function DefaultMainDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const allEntities = getRegisteredEntities()
  // Filter to only include full EntityConfig (not child entities)
  const entities = allEntities.filter(isEntityConfig)
  const serializedEntities: SerializableEntityConfig[] = entities.map(serializeEntityConfig)

  return (
    <DashboardShell entities={serializedEntities}>
      {children}
    </DashboardShell>
  )
}

// Export the resolved component (theme override or default)
// Note: Template path must match registry format (WITH 'app/' prefix)
export default getTemplateOrDefault('app/dashboard/(main)/layout.tsx', DefaultMainDashboardLayout)