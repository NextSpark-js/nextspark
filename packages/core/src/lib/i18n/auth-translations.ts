import { getTranslations } from 'next-intl/server'
import { AUTH_IN_DEFAULT_LOCALE } from '@nextsparkjs/registries/request-locale'
import { I18N_CONFIG } from '../config'

/**
 * `getTranslations` for the server side of an `(auth)` page: its metadata and the auth layout.
 *
 * With Cache Components the `(auth)` layout provides the default locale's messages unless `i18n.requestLocale.auth` is
 * on. A title or a line that took the request's locale instead would show a mix of two languages, and would read the
 * request while the page is prerendered; this one asks for the same locale as the layout, so it reads nothing from the
 * request when the group is static, and follows it when the group is on.
 */
export function getAuthTranslations(namespace: string) {
  return AUTH_IN_DEFAULT_LOCALE
    ? getTranslations({ locale: I18N_CONFIG.defaultLocale, namespace })
    : getTranslations(namespace)
}
