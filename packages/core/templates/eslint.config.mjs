import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// `eslint .` walks the whole project, so the block schemas under
// contents/themes/<theme>/blocks/*/schema.ts are linted like any other source. The `next lint`
// this replaces only ever walked app, pages, components, lib and src, which left every schema --
// the files the zod rule below exists for -- unchecked.
//
// eslint-config-next 16 publishes flat config arrays on its subpaths. Reaching them through
// FlatCompat instead throws `Converting circular structure to JSON` before a single file is read.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", ".nextspark/**"],
  },
  {
    rules: {
      // `no-restricted-imports` with `importNames: ["z"]` also rejects `import * as z`, so the
      // named specifier is matched by syntax instead.
      "no-restricted-syntax": [
        "error",
        {
          // `imported` is an Identifier for `{ z }` and a Literal for `{ "z" as zod }`, so the
          // name lives under a different property in each.
          selector:
            "ImportDeclaration[source.value='zod'] > ImportSpecifier:matches([imported.name='z'], [imported.value='z'])",
          message:
            "Use `import * as z from 'zod'`. Turbopack doesn't tree-shake the named `z` import and bundles all of zod, its 63 locales included.",
        },
      ],
    },
  },
];

export default eslintConfig;
