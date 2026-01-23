/**
 * Main Dashboard Layout with Permission Checking
 *
 * This layout handles:
 * 1. Entity registry initialization
 * 2. Server-side permission validation for entity routes
 * 3. Rendering the DashboardShell with entity navigation
 *
 * IMPORTANT: Permission checking MUST be in this layout (not in [entity]/layout.tsx)
 * because (templates) routes with specific paths take precedence over dynamic [entity] routes.
 */
import { headers, cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@nextsparkjs/core/components/dashboard/layouts/DashboardShell'
import { serializeEntityConfig, type SerializableEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { isValidPermission } from '@nextsparkjs/core/lib/permissions/init'
import type { Permission } from '@nextsparkjs/core/lib/permissions/types'
// Import registry directly - webpack resolves @nextsparkjs/registries alias at compile time
import { ENTITY_REGISTRY, ENTITY_METADATA } from '@nextsparkjs/registries/entity-registry'

// Register entities globally so other parts of the app can access them via getRegisteredEntities()
setEntityRegistry(ENTITY_REGISTRY, ENTITY_METADATA)

type EntityAction = 'list' | 'read' | 'create' | 'update' | 'delete'

/**
 * Parse entity and action from pathname
 * Handles paths like: /dashboard/ai-agents, /dashboard/ai-agents/create, /dashboard/ai-agents/[id]/edit
 */
function parseEntityFromPathname(pathname: string): { entity: string; action: EntityAction } | null {
  // Match /dashboard/[entity] patterns
  const match = pathname.match(/^\/dashboard\/([^/]+)(?:\/(.*))?$/)
  if (!match) return null

  const entity = match[1]
  const rest = match[2] || ''

  // Detect action from the rest of the path
  if (rest === '' || rest === '/') return { entity, action: 'list' }
  if (rest === 'create') return { entity, action: 'create' }
  if (rest.match(/^[^/]+\/edit$/)) return { entity, action: 'update' }
  if (rest.match(/^[^/]+$/)) return { entity, action: 'read' }

  // Default to read for any other path
  return { entity, action: 'read' }
}

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

// Default main dashboard layout component with permission checking
async function DefaultMainDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  // Get entities directly from the imported registry
  const allEntities = Object.values(ENTITY_REGISTRY).map(entry => entry.config)
  // Filter to only include full EntityConfig (not child entities)
  const entities = allEntities.filter(isEntityConfig)
  const serializedEntities: SerializableEntityConfig[] = entities.map(serializeEntityConfig)

  // === PERMISSION CHECK ===
  const headersList = await headers()
  const cookieStore = await cookies()

  // Get pathname from middleware header
  const pathname = headersList.get('x-pathname') || ''
  const userId = headersList.get('x-user-id')
  const teamId = cookieStore.get('activeTeamId')?.value

  // Only check permissions if we have the required data
  if (userId && teamId && pathname) {
    const parsed = parseEntityFromPathname(pathname)

    if (parsed) {
      const { entity, action } = parsed
      const permission = `${entity}.${action}` as Permission

      // Only check if this is a valid entity permission
      if (isValidPermission(`${entity}.list` as Permission)) {
        const hasPermission = await checkPermission(userId, teamId, permission)

        if (!hasPermission) {
          redirect(`/dashboard/permission-denied?entity=${entity}&action=${action}`)
        }
      }
    }
  }

  return (
    <DashboardShell entities={serializedEntities}>
      {children}
    </DashboardShell>
  )
}

// Export the resolved component (theme override or default)
export default getTemplateOrDefault('app/dashboard/(main)/layout.tsx', DefaultMainDashboardLayout)