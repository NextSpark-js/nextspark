/**
 * Jest default for `next-intl` (ESM only, so the real package cannot be required): `useMessages` as it is without a
 * `NextIntlClientProvider`, which throws. The Sheet, Dialog and Toaster read their labels through it and fall back.
 * A test that needs a provider or `useTranslations` mocks the module itself, which takes precedence over this.
 */
module.exports = {
  useMessages: () => {
    throw new Error('No intl context found. Have you configured the provider?')
  },
}
