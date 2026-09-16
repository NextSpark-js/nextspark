import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

/**
 * Next's presets from the eslint-config-next the project installs, as flat config.
 *
 * Version 16 publishes flat config arrays on these subpaths; reaching them through FlatCompat
 * throws `Converting circular structure to JSON` before a single file is read. Version 15 declares
 * no `exports` and publishes eslintrc presets, which FlatCompat is the only way to read: importing
 * the subpaths throws ERR_MODULE_NOT_FOUND, or, under a loader that adds file extensions, returns
 * eslintrc objects. That is what a Next 15 project gets when `nextspark init` drops this file next
 * to its eslint-config-next. FlatCompat ships in @eslint/eslintrc, which ESLint itself depends on,
 * so it is resolved from there.
 */
async function nextPresets() {
  let presets;
  try {
    presets = await Promise.all([
      import("eslint-config-next/core-web-vitals"),
      import("eslint-config-next/typescript"),
    ]);
  } catch (error) {
    if (error?.code !== "ERR_MODULE_NOT_FOUND") throw error;
  }

  if (presets?.every((preset) => Array.isArray(preset.default))) {
    return presets.flatMap((preset) => preset.default);
  }

  const { FlatCompat } = createRequire(require.resolve("eslint"))("@eslint/eslintrc");
  return new FlatCompat({ baseDirectory: __dirname }).extends("next/core-web-vitals", "next/typescript");
}

/** A config object holding nothing but `ignores` applies to every other object in the array. */
const isGlobalIgnore = (config) =>
  Object.keys(config).every((key) => key === "ignores" || key === "name");

const presets = await nextPresets();

/** typescript-eslint's parser, which reads every syntax these trees use: JS, TS and JSX. */
const typescriptParser = presets
  .map((config) => config.languageOptions?.parser)
  .find((parser) => parser?.meta?.name === "typescript-eslint/parser");

// NextSpark writes app/ (sync:app regenerates it from core) and contents/ (the themes and plugins,
// their tests and fixtures included). The repo that code comes from lints it with the zod rule
// below and nothing else, and it does not meet Next's presets -- React Compiler rules in app/,
// `no-explicit-any` across themes and plugins -- so the presets check what the project adds around
// those trees, and the trees themselves get the repo's rules.
//
// `eslint .` still walks both trees, so the block schemas under contents/themes/<theme>/blocks/ are
// linted like any other source. The `next lint` this replaces only ever walked app, pages,
// components, lib and src, which left every schema -- the files the zod rule exists for -- unchecked.
const NEXTSPARK_TREES = ["app/**", "contents/**"];
const SOURCE_FILES = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

const eslintConfig = [
  {
    // Next writes next-env.d.ts itself; version 16's presets ignore it and version 15's do not.
    ignores: [".next/**", ".nextspark/**", "next-env.d.ts"],
  },
  ...presets.map((config) =>
    isGlobalIgnore(config) ? config : { ...config, ignores: [...(config.ignores ?? []), ...NEXTSPARK_TREES] },
  ),
  {
    // A .cjs file is CommonJS by definition, so `require` is the only spelling it has.
    files: ["**/*.cjs"],
    ignores: NEXTSPARK_TREES,
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // The presets would have supplied the parser here. Their plugins are registered so the disable
    // comments in this code resolve the rules they name, without turning any of those rules on.
    files: NEXTSPARK_TREES.map((tree) => `${tree}/${SOURCE_FILES}`),
    languageOptions: {
      parser: typescriptParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    plugins: Object.assign({}, ...presets.map((config) => config.plugins ?? {})),
    linterOptions: { reportUnusedDisableDirectives: "off" },
  },
  {
    // Spelled out rather than inherited: a block naming these extensions is what makes ESLint lint
    // a .ts file at all.
    files: [SOURCE_FILES],
    rules: {
      // `no-restricted-imports` with `importNames: ["z"]` also rejects `import * as z`, so the
      // named specifier is matched by syntax instead.
      "no-restricted-syntax": [
        "error",
        {
          // `imported` is an Identifier for `{ z }` and a Literal for `{ "z" as zod }`, so the
          // name lives under a different property in each.
          selector:
            "ImportDeclaration[source.value='zod'] > ImportSpecifier:matches([imported.name='z'], [imported.value='z']), ExportNamedDeclaration[source.value='zod'] > ExportSpecifier:matches([local.name='z'], [local.value='z'])",
          message:
            "Use `import * as z from 'zod'`. Turbopack doesn't tree-shake the named `z` import and bundles all of zod, its 63 locales included.",
        },
      ],
    },
  },
];

export default eslintConfig;
