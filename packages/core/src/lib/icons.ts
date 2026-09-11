import type { LucideIcon } from 'lucide-react'
import { Box } from 'lucide-react'
import { ICON_REGISTRY } from '@nextsparkjs/registries/icon-registry'

/**
 * Icon lookup by configured name.
 *
 * Configs name their icon with a string (entity `iconName`, a theme's sidebar
 * sections, a block's `icon`), so there is no static reference a bundler could
 * follow. Resolving that through `import * as Icons from 'lucide-react'` keeps
 * the whole icon set in the bundle — ~500 KB on every route, public ones
 * included. ICON_REGISTRY is generated at build time from those same configs,
 * so the lookup stays dynamic while the bundle carries only the icons the app
 * can actually ask for.
 *
 * A name outside the registry resolves to the fallback rather than throwing:
 * missing from the registry means no config referenced it.
 */
/**
 * Both spellings are in use: entity configs name an icon by its lucide export
 * (`CheckSquare`), while a theme's sidebar and block configs write it in
 * kebab-case (`pie-chart`). The registry is keyed by the export name.
 */
function toPascalCase(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join('')
}

/**
 * Registry lookup by own property only.
 *
 * A plain index would resolve `constructor`, `toString` and friends to members
 * of Object.prototype — truthy values that are not components, so React would
 * fail on an invalid element type instead of falling back.
 */
function lookupIcon(name: string): LucideIcon | undefined {
  return Object.prototype.hasOwnProperty.call(ICON_REGISTRY, name)
    ? ICON_REGISTRY[name]
    : undefined
}

export function resolveIcon(
  name: string | undefined | null,
  fallback: LucideIcon = Box
): LucideIcon {
  if (!name) {
    return fallback
  }
  return lookupIcon(name) ?? lookupIcon(toPascalCase(name)) ?? fallback
}

/**
 * The registry name of an icon component, for crossing a server -> client
 * boundary where the component itself can't travel.
 *
 * Falls back to lucide's own `displayName`, which is the canonical name of the
 * icon: an icon imported under an alias (`import { Home }`, canonically
 * `House`) still round-trips, because both names resolve to the same component.
 */
export function getIconName(icon: unknown, fallback = 'Box'): string {
  if (!icon) {
    return fallback
  }

  for (const [name, candidate] of Object.entries(ICON_REGISTRY)) {
    if (candidate === icon) {
      return name
    }
  }

  const displayName = (icon as { displayName?: string }).displayName
  return displayName || fallback
}
