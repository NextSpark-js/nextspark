import { DashboardShell } from '@nextsparkjs/core/components/dashboard/layouts/DashboardShell'
import { serializeEntityConfig, type SerializableEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Register entities globally so other parts of the app can access them via getRegisteredEntities()
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

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
  // Get entities directly from the imported registry
  const allEntities = Object.values(ENTITY_REGISTRY).map(entry => entry.config)
  // Filter to only include full EntityConfig (not child entities)
  const entities = allEntities.filter(isEntityConfig)
  const serializedEntities: SerializableEntityConfig[] = entities.map(serializeEntityConfig)

  // DEBUG: Log entity data
  console.log('[MainLayout] Entities count:', entities.length)

  return (
    <DashboardShell entities={serializedEntities}>
      {children}
    </DashboardShell>
  )
}

// Export the resolved component (theme override or default)
export default getTemplateOrDefault('app/dashboard/(main)/layout.tsx', DefaultMainDashboardLayout)
