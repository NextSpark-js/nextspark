import tsParser from '@typescript-eslint/parser'
import tsPlugin from '@typescript-eslint/eslint-plugin'
import nextPlugin from '@next/eslint-plugin-next'
import jsxA11y from 'eslint-plugin-jsx-a11y'
import reactHooks from 'eslint-plugin-react-hooks'

// Rules the whole source tree follows. `pnpm lint` (`next lint` in apps/dev) finds this file by
// walking up from apps/dev; generated projects get packages/core/templates/eslint.config.mjs.
// The parser and plugins resolve from the root because pnpm hoists `*eslint*` packages there.
export default [
  {
    ignores: ['**/node_modules/**', '**/dist/**', '**/.next/**', '**/coverage/**', 'packages/core/templates/app/**'],
  },
  {
    files: ['**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    // Disable comments in the code name rules of these plugins. Registering them lets ESLint
    // resolve those names without turning any of their rules on -- but only for names the
    // installed plugin still defines: a comment naming a rule the plugin dropped is an error
    // on its own, whatever the rule's severity would have been.
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@next/next': nextPlugin,
      'jsx-a11y': jsxA11y,
      'react-hooks': reactHooks,
    },
    linterOptions: { reportUnusedDisableDirectives: 'off' },
    rules: {
      // `no-restricted-imports` with `importNames: ['z']` also rejects `import * as z`, so the
      // named specifier is matched by syntax instead.
      'no-restricted-syntax': ['error', {
        selector: "ImportDeclaration[source.value='zod'] > ImportSpecifier[imported.name='z']",
        message: "Use `import * as z from 'zod'`. Turbopack doesn't tree-shake the named `z` import and bundles all of zod, its 63 locales included.",
      }],
    },
  },
]
