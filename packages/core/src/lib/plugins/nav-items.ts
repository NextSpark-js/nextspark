/**
 * Navigation items plugins contribute to the devtools and superadmin areas.
 *
 * The server registry holds the plugins that declare 'server' and the client registry the ones that declare
 * 'web', so a plugin's navigation is found in whichever of them lists it; a plugin declared in both is listed once.
 * Server-side only (the layouts): it imports the server registry.
 */
import { getPluginNavItems as getServerPluginNavItems } from '@nextsparkjs/registries/plugin-registry'
import { getPluginNavItems as getWebPluginNavItems } from '@nextsparkjs/registries/plugin-registry.client'
import type { PluginNavItem } from '../../types/plugin'

export function getAllPluginNavItems(area: 'devtools' | 'superadmin'): PluginNavItem[] {
  const seen = new Set<string>()
  const items: PluginNavItem[] = []
  for (const item of [...(getServerPluginNavItems(area) as PluginNavItem[]), ...(getWebPluginNavItems(area) as PluginNavItem[])]) {
    const key = `${item.href}|${item.label}`
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
  }
  return items
}
