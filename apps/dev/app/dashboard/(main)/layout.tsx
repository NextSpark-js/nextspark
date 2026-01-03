import { DashboardShell } from '@nextsparkjs/core/components/dashboard/layouts/DashboardShell'
import { getRegisteredEntities } from '@nextsparkjs/core/lib/entities/queries'
import { serializeEntityConfig, type SerializableEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import { TemplateService } from '@nextsparkjs/core/lib/services/template.service'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'

// Debug: Check template override status at module load
const LAYOUT_PATH = 'app/dashboard/(main)/layout.tsx'
console.log('[MainLayout] Checking template override for:', LAYOUT_PATH)
console.log('[MainLayout] hasTemplateOverride:', TemplateService.hasOverride(LAYOUT_PATH))
console.log('[MainLayout] templateEntry:', TemplateService.getEntry(LAYOUT_PATH)?.template?.themeName)

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
export default getTemplateOrDefault('app/dashboard/(main)/layout.tsx', DefaultMainDashboardLayout)