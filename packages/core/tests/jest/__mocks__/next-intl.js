/**
 * Jest default for `next-intl` (ESM only, so the real package cannot be required): `useMessages` as it is without a
 * `NextIntlClientProvider`, which throws. The Sheet, Dialog and Toaster read their labels through it and fall back.
 * A test that needs a provider or `useTranslations` mocks the module itself, which takes precedence over this.
 */
// the real file: a test that mocks `next-intl/server` replaces the module at this path
const { format, loadNamespace } = jest.requireActual('./next-intl-server.js')

/**
 * `useTranslations` as the English core catalog answers it (a page or a layout that reads its texts renders in a test
 * with no provider), with the `has` and `rich` of the real one: `rich` leaves the tags of the text in place.
 */
function useTranslations(namespace) {
  const ns = loadNamespace('en', namespace)
  const read = key => ns[key] ?? key.split('.').reduce((node, part) => (node && typeof node === 'object' ? node[part] : undefined), ns)
  const t = (key, params) => {
    const value = read(key)
    if (typeof value !== 'string') throw new Error(`next-intl mock: missing key "${key}" in namespace "${namespace}"`)
    return format(value, params, 'en')
  }
  t.has = key => typeof read(key) === 'string'
  t.rich = (key, params) => t(key, params)
  return t
}

module.exports = {
  useMessages: () => {
    throw new Error('No intl context found. Have you configured the provider?')
  },
  useTranslations,
  useLocale: () => 'en',
}
