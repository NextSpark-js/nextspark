/**
 * The languages --locales accepts, checked here before the install so a typo does not cost minutes. The list is the
 * wizard's AVAILABLE_LOCALES (packages/cli), which the project's own CLI validates again; a test keeps them equal.
 */
export const LOCALES = ['en', 'es', 'fr', 'de', 'it', 'pt']

export function checkLocales(locales: string | undefined, defaultLocale: string | undefined): void {
  if (locales === undefined) {
    if (defaultLocale !== undefined) throw new Error('--default-locale needs --locales.')
    return
  }
  const requested = locales.split(',').map(l => l.trim().toLowerCase()).filter(Boolean)
  if (requested.length === 0) {
    throw new Error(`--locales needs at least one language. Valid locales: ${LOCALES.join(', ')}.`)
  }
  const unknown = requested.filter(l => !LOCALES.includes(l))
  if (unknown.length > 0) {
    throw new Error(`Unknown locale${unknown.length > 1 ? 's' : ''} "${unknown.join('", "')}" in --locales. Valid locales: ${LOCALES.join(', ')}.`)
  }
  const chosen = defaultLocale?.trim().toLowerCase()
  if (chosen !== undefined && !requested.includes(chosen)) {
    throw new Error(`--default-locale "${defaultLocale}" is not one of the selected locales (${[...new Set(requested)].join(', ')}).`)
  }
}
