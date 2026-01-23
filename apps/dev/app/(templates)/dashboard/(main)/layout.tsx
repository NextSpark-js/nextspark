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
import { getRegisteredEntities } from '@nextsparkjs/core/lib/entities/queries'
import { serializeEntityConfig, type SerializableEntityConfig } from '@nextsparkjs/core/lib/entities/serialization'
import { getTemplateOrDefault } from '@nextsparkjs/core/lib/template-resolver'
import type { EntityConfig, ChildEntityDefinition } from '@nextsparkjs/core/lib/entities/types'
import { checkPermission } from '@nextsparkjs/core/lib/permissions/check'
import { isValidPermission } from '@nextsparkjs/core/lib/permissions/init'
import type { Permission } from '@nextsparkjs/core/lib/permissions/types'

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

// Default main dashboard layout component with permission checking
async function DefaultMainDashboardLayout({
  children
}: {
  children: React.ReactNode
}) {
  const allEntities = getRegisteredEntities()
  const entities = allEntities.filter(isEntityConfig)
  const serializedEntities: SerializableEntityConfig[] = entities.map(serializeEntityConfig)

  // === PERMISSION CHECK ===
  const headersList = await headers()
  const cookieStore = await cookies()

  const pathname = headersList.get('x-pathname') || ''
  const userId = headersList.get('x-user-id')
  const teamId = cookieStore.get('activeTeamId')?.value

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

  return (
    <DashboardShell entities={serializedEntities}>
      {children}
    </DashboardShell>
  )
}

// Export the resolved component (theme override or default)
// Note: Template path must match registry format (WITH 'app/' prefix)
export default getTemplateOrDefault('app/dashboard/(main)/layout.tsx', DefaultMainDashboardLayout)