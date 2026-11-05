import type { Metadata } from 'next'
import { getAuthTranslations } from '@nextsparkjs/core/lib/i18n/auth-translations'

/**
 * The metadata of an `(auth)` page: its title and description from the `auth` messages, in the language the group
 * renders in (the default's unless `i18n.requestLocale.auth` is on), so the tab agrees with the page.
 */
export async function authPageMetadata(titleKey: string, descriptionKey: string): Promise<Metadata> {
  const t = await getAuthTranslations('auth')
  return { title: t(titleKey), description: t(descriptionKey) }
}
