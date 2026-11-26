import { getLocale, getTranslations } from 'next-intl/server'
import { PermissionService } from '@nextsparkjs/core/lib/services/permission.service'
import { ENTITY_REGISTRY } from '@nextsparkjs/registries/entity-registry'
import { localizePermissionTexts } from '@nextsparkjs/core/lib/permissions/permission-texts'
import { TeamRolesView } from '@nextsparkjs/core/routes/_internal/team-roles-view'

/**
 * Team Roles & Permissions. The texts of the project's permissions are resolved here, on the server, where the whole
 * catalog is (#553); the screen receives only the strings it shows.
 */
export default async function TeamRolesPage() {
  const [t, locale] = await Promise.all([getTranslations(), getLocale()])
  const permissionTexts = localizePermissionTexts(t, PermissionService.getMatrix().permissions, { locale, entities: Object.keys(ENTITY_REGISTRY) })
  return <TeamRolesView permissionTexts={permissionTexts} />
}
