/**
 * The texts of the permissions a project declares, in the interface language (#553). The Team Roles matrix of superadmin
 * shows the label, the description and the category of every permission; the core's own are translated in the matrix (#549),
 * and these are the ones a preset or a project writes in `permissions.config.ts`. It runs on the server, where the whole
 * catalog is, so the browser receives the resolved strings and no catalog.
 *
 * For each text, the first of these that exists:
 *   1. the text is itself a message key (`presets.team.view`): a project that wants it can write keys in its config;
 *   2. the project's catalog by id: `permissionTexts.<id>.label` / `.description` (`permissionTexts.team.view.label`),
 *      and `permissionTexts.categories.<category>` for a category. This needs no change in the config, so the registry the
 *      dashboard ships is the same;
 *   3. for an entity permission whose config gives no text, the generated one: `superadmin.rolesMatrix.entityActions.<action>`
 *      with the entity's name from its own catalog (`<slug>.entity.plural`), so it reads "Crear tareas";
 *   4. the text as written.
 */
import { entityNameInText } from '../entities/entity-text'

/** The part of a next-intl translator this reads (`getTranslations()`, the root one). */
export interface PermissionTextTranslator {
  (key: string, values?: Record<string, string | number>): string
  has: (key: string) => boolean
}

export interface PermissionTextSource {
  id: string
  label: string
  description?: string
  category: string
  /** The core's own permissions are translated by the matrix itself (#549), so they are left alone. */
  source?: string
}

export interface LocalizedPermissionTexts {
  /** By permission id: only the texts that differ from the config's. */
  texts: Record<string, { label?: string; description?: string }>
  /** By the category the config gives: only the names that differ. */
  categories: Record<string, string>
}

/**
 * The English text the registry generator writes for an entity permission whose config has none. A copy of
 * `defaultEntityPermissionTexts` in `scripts/build/registry/generators/permissions-registry.mjs`; a test keeps them equal.
 */
export function defaultEntityPermissionTexts(action: string, displayName: string): { label: string; description: string } {
  return {
    label: `${action.charAt(0).toUpperCase() + action.slice(1)} ${displayName}`,
    description: `Can ${action} ${displayName.toLowerCase()}`,
  }
}

const KEY = /^[\w-]+(\.[\w-]+)+$/

/** The catalog's string for `key`, or undefined when it has none (or the key is a group of messages). */
function read(t: PermissionTextTranslator, key: string, values?: Record<string, string | number>): string | undefined {
  try {
    if (!t.has(key)) return undefined
    const text = t(key, values)
    return typeof text === 'string' && text !== key ? text : undefined
  } catch {
    return undefined
  }
}

export function localizePermissionTexts(
  t: PermissionTextTranslator,
  permissions: readonly PermissionTextSource[],
  { locale, entities }: { locale: string; entities: Iterable<string> },
): LocalizedPermissionTexts {
  const slugs = new Set(entities)
  const result: LocalizedPermissionTexts = { texts: {}, categories: {} }

  for (const p of permissions) {
    if (p.source === 'core') continue
    const slug = p.id.split('.')[0]
    const entity = slugs.has(slug) ? slug : undefined
    const action = entity ? p.id.slice(slug.length + 1) : ''
    const plural = entity ? read(t, `${entity}.entity.plural`) : undefined
    const defaults = entity && action ? defaultEntityPermissionTexts(action, p.category) : undefined

    const text = (field: 'label' | 'description'): string | undefined => {
      const written = p[field]
      if (!written) return undefined
      const own = (KEY.test(written) ? read(t, written) : undefined) ?? read(t, `permissionTexts.${p.id}.${field}`)
      if (own) return own
      if (plural && defaults && written === defaults[field]) {
        return read(t, `superadmin.rolesMatrix.entityActions.${action}.${field}`, { entity: entityNameInText(plural, locale) })
      }
      return undefined
    }

    const label = text('label')
    const description = text('description')
    if (label || description) result.texts[p.id] = { ...(label && { label }), ...(description && { description }) }

    if (!(p.category in result.categories)) {
      const category = (entity && plural) || read(t, `permissionTexts.categories.${p.category}`) || read(t, `superadmin.rolesMatrix.generatedCategories.${p.category}`)
      if (category && category !== p.category) result.categories[p.category] = category
    }
  }
  return result
}
