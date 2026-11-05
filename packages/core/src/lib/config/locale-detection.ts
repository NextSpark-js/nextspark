/**
 * Which sources may pick a request's locale (`i18n.detectionStrategy`). Pure, with
 * a type-only import, so the server resolution (lib/locale) and the client hooks
 * that copy the account's language to the cookie apply the same rule.
 */

import type { LocaleDetectionSource } from './types'
export type { LocaleDetectionSource }

const SOURCES: readonly unknown[] = ['user_database', 'cookie', 'header', 'default']
const warned = new Set<string>()

interface DetectionConfig {
  supportedLocales: readonly string[]
  localeDetection?: boolean
  detectionStrategy?: unknown
  requestLocale?: unknown
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

const REQUEST_LOCALE_GROUPS = ['auth', 'public'] as const

/**
 * Development warnings for `i18n.requestLocale` (which route groups render in the request's locale, with Cache
 * Components). `generated` is what the registry holds, read from the config file as text when the registries are
 * generated: a value the merged config has and the registry does not is one the generator could not read.
 */
export function checkRequestLocale(config: DetectionConfig, generated: Record<(typeof REQUEST_LOCALE_GROUPS)[number], boolean>) {
  const setting = config.requestLocale
  if (setting === undefined) return
  if (typeof setting !== 'object' || setting === null || Array.isArray(setting)) {
    warnOnce('requestLocaleShape', 'i18n.requestLocale must be an object like { auth: true, public: false }; ignoring it.')
    return
  }
  for (const [key, value] of Object.entries(setting)) {
    if (!(REQUEST_LOCALE_GROUPS as readonly string[]).includes(key)) {
      warnOnce(`requestLocale.${key}`, `i18n.requestLocale has an unknown group "${key}" (expected ${REQUEST_LOCALE_GROUPS.join(' and ')}).`)
    } else if (typeof value !== 'boolean') {
      warnOnce(`requestLocale.${key}.type`, `i18n.requestLocale.${key} must be true or false (found ${JSON.stringify(value)}); it counts as false.`)
    }
  }
  for (const group of REQUEST_LOCALE_GROUPS) {
    if ((setting as Record<string, unknown>)[group] !== true) continue
    if (!generated[group]) {
      warnOnce(`requestLocale.${group}.registry`, `i18n.requestLocale.${group} is true in the merged config but the generated registry has false: write it as the literal \`requestLocale: { ${group}: true }\` in config/app.config.ts and regenerate the registries.`)
    } else if (isLocaleFixedFor(config)) {
      warnOnce(`requestLocale.${group}.fixed`, `i18n.requestLocale.${group} has no effect: the app renders ${'`defaultLocale`'} for every request (one locale, localeDetection: false or no detection source), so the ${group} pages stay prerendered.`)
    }
  }
}

function warnOnce(key: string, message: string) {
  if (process.env.NODE_ENV === 'production' || warned.has(key)) return
  warned.add(key)
  console.warn(`[nextspark] ${message}`)
}
