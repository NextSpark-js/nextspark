/**
 * Which sources may pick a request's locale (`i18n.detectionStrategy`). Pure and
 * import-free, so the server resolution (lib/locale) and the client hooks that
 * copy the account's language to the cookie apply the same rule.
 */

export type LocaleDetectionSource = 'user_database' | 'cookie' | 'header' | 'default'

const SOURCES: readonly unknown[] = ['user_database', 'cookie', 'header', 'default']
const warned = new Set<string>()

interface DetectionConfig {
  supportedLocales: readonly string[]
  localeDetection?: boolean
  detectionStrategy?: unknown
}

/**
 * Unset, every source is on. Only an array turns sources off: any other value
 * (`true`, `{}`, a string) is a config mistake and leaves them all on, with a
 * warning in development. A name that is not a source warns too.
 */
export function isSourceEnabled(config: DetectionConfig, source: LocaleDetectionSource): boolean {
  const strategy = config.detectionStrategy
  if (strategy === undefined) return true
  if (!Array.isArray(strategy)) {
    warnOnce('notArray', 'i18n.detectionStrategy must be an array of sources; ignoring it.')
    return true
  }
  for (const value of strategy) {
    if (!SOURCES.includes(value)) {
      warnOnce(String(value), `i18n.detectionStrategy has an unknown source "${String(value)}" (expected ${SOURCES.join(', ')}).`)
    }
  }
  return strategy.includes(source)
}

/** The app renders `defaultLocale` for every request and reads nothing from it. */
export function isLocaleFixedFor(config: DetectionConfig): boolean {
  return (
    config.supportedLocales.length <= 1 ||
    config.localeDetection === false ||
    !(['cookie', 'user_database', 'header'] as const).some(source => isSourceEnabled(config, source))
  )
}

/** Whether the account's language may be copied to the locale cookie. */
export function usesAccountLocale(config: DetectionConfig): boolean {
  return !isLocaleFixedFor(config) && isSourceEnabled(config, 'user_database')
}

function warnOnce(key: string, message: string) {
  if (process.env.NODE_ENV === 'production' || warned.has(key)) return
  warned.add(key)
  console.warn(`[nextspark] ${message}`)
}
