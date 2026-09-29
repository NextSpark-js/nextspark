/**
 * Entity Permission Layout (the `[entity]` route)
 *
 * Validates entity permissions BEFORE rendering any page; the check itself is in
 * ../../../_internal/entity-permission-layout, which the generated host's per-entity layouts
 * also use. NOT overridable by themes: security must not be bypassable.
 */
import { EntityPermissionLayout } from '../../../_internal/entity-permission-layout'

export default async function EntityRouteLayout({
  children,
  params
}: {
  children: React.ReactNode
  params: Promise<{ entity: string }>
}) {
  const { entity } = await params
  return <EntityPermissionLayout entity={entity}>{children}</EntityPermissionLayout>
}
