/**
 * Identifier Safety
 *
 * Registries import user-named things — themes, plugins, blocks — under aliases
 * built from those names. The names come from slugs, so they carry whatever a
 * directory name allows: hyphens, dots, and a leading digit ('7startups').
 *
 * Replacing hyphens is not enough. `as 7startupsAppConfig` is a parse error,
 * and because every route reaches the app through these registries, one bad
 * alias takes down the whole project rather than just that theme.
 *
 * @module core/scripts/build/registry/generators/identifier
 */

/**
 * Turn a name into a valid JavaScript identifier.
 *
 * Only used to build aliases, never to look anything up: the real name stays
 * in the string keys the registry is indexed by.
 *
 * @param {string} name
 * @returns {string}
 */
export function toSafeIdentifier(name) {
  const cleaned = String(name).replace(/[^A-Za-z0-9_$]/g, '_')
  if (cleaned === '') return '_'
  return /^[0-9]/.test(cleaned) ? `_${cleaned}` : cleaned
}
