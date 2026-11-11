/**
 * Jest stand-in for `use-intl/react` (ESM only, so the real package cannot be required): a provider renders its
 * children, and the hooks answer as an English area with no messages. The behaviour of the real providers is checked
 * by the node tests (tests/node/area-messages-check.test.ts).
 */
module.exports = {
  IntlProvider: ({ children }) => children,
  useLocale: () => 'en',
  useMessages: () => ({}),
}
