/**
 * What the main dashboard layout and its Cache Components variant (dashboard/(main)/layout.cc) have in common: the
 * shell with the entity navigation and the permission check of the entity a request is for.
 */
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { DashboardShell } from '@nextsparkjs/core/components/dashboard/layouts/DashboardShell'
import { serializeEntityConfig, type SerializableEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { setEntityRegistry } from '@nextsparkjs/core/lib/entities/queries'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { getDashboardPermissionContext } from '@nextsparkjs/core/lib/auth/request-session'
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
  const match = pathname.match(/^\/dashboard\/([^/]+)(?:\/(.*))?$/)
  if (!match) return null

  const entity = match[1]
  const rest = match[2] || ''

  if (rest === '' || rest === '/') return { entity, action: 'list' }
  if (rest === 'create') return { entity, action: 'create' }
  if (rest.match(/^[^/]+\/edit$/)) return { entity, action: 'update' }
  if (rest.match(/^[^/]+$/)) return { entity, action: 'read' }

  return { entity, action: 'read' }
}

// Type guard to check if entity is a full EntityConfig
function isEntityConfig(entity: EntityConfig | ChildEntityDefinition): entity is EntityConfig {
  return 'slug' in entity
}

/** The dashboard shell with the navigation of every entity the project registers. */
export function MainDashboardShell({ children }: { children: React.ReactNode }) {
  // Get entities directly from the imported registry
  const allEntities = Object.values(ENTITY_REGISTRY).map(entry => entry.config)
  const entities = allEntities.filter(isEntityConfig)
  const serializedEntities: SerializableEntityConfig[] = entities.map(serializeEntityConfig)

  return <DashboardShell entities={serializedEntities}>{children}</DashboardShell>
}

/** Sends a request for an entity route the signed-in user may not use to the permission-denied page. */
export async function enforceEntityPermission(): Promise<void> {
  const headersList = await headers()

  // A routing hint from the proxy; who the user is and which team they act in come from the verified session
  const pathname = headersList.get('x-pathname') || ''
  const { userId, teamId } = await getDashboardPermissionContext()

  if (userId && teamId && pathname) {
    const parsed = parseEntityFromPathname(pathname)

    if (parsed) {
      const { entity, action } = parsed
      const permission = `${entity}.${action}` as Permission

      if (isValidPermission(`${entity}.list` as Permission)) {
        const hasPermission = await checkPermission(userId, teamId, permission)

        if (!hasPermission) {
          redirect(`/dashboard/permission-denied?entity=${entity}&action=${action}`)
        }
      }
    }
  }
}
