/**
 * eslint-config-next 16 publishes flat config arrays on these subpaths. Version 15 declares no
 * `exports` at all, so importing them throws ERR_MODULE_NOT_FOUND and takes the whole lint run
 * with it -- which is what a Next 15 project gets when `nextspark init` drops this file next to
 * its existing eslint-config-next. Losing Next's presets there is better than losing every rule,
 * so the project still lints, with the zod rule below.
 */
async function nextPresets() {
  try {
    const [coreWebVitals, typescript] = await Promise.all([
      import("eslint-config-next/core-web-vitals"),
      import("eslint-config-next/typescript"),
    ]);

    return [...coreWebVitals.default, ...typescript.default];
  } catch {
    return [];
  }
}

// `eslint .` walks the whole project, so the block schemas under
// contents/themes/<theme>/blocks/*/schema.ts are linted like any other source. The `next lint`
// this replaces only ever walked app, pages, components, lib and src, which left every schema --
// the files the zod rule below exists for -- unchecked.
//
// eslint-config-next 16 publishes flat config arrays on its subpaths. Reaching them through
// FlatCompat instead throws `Converting circular structure to JSON` before a single file is read.
const eslintConfig = [
  ...(await nextPresets()),
  {
    ignores: [".next/**", ".nextspark/**"],
  },
  {
    // A .cjs file is CommonJS by definition, so `require` is the only spelling it has.
    files: ["**/*.cjs"],
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // Spelled out rather than inherited: without Next's presets there is no other block naming
    // these extensions, and ESLint would then leave every .ts file unlinted.
    files: ["**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}"],
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
