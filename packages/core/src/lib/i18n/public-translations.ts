import { getTranslations } from 'next-intl/server'
import { PUBLIC_IN_DEFAULT_LOCALE } from '@nextsparkjs/registries/request-locale'
import { I18N_CONFIG } from '../config'

/**
 * `getTranslations` for a server component of a `(public)` page.
 *
 * With Cache Components the `(public)` layout (navbar, footer) provides the default locale's messages unless
 * `i18n.requestLocale.public` is on. A page that took the request's locale instead would show a mix of two languages;
 * this one asks for the same locale as the layout, and so reads nothing from the request when the group is static.
 */
export function getPublicTranslations(namespace: string) {
  return PUBLIC_IN_DEFAULT_LOCALE
    ? getTranslations({ locale: I18N_CONFIG.defaultLocale, namespace })
    : getTranslations(namespace)
}
