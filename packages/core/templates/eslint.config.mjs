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

const SOURCE_FILES = "**/*.{ts,tsx,mts,cts,js,jsx,mjs,cjs}";

// Tests and fixtures, the project's own and those local plugins bring:
// they mock, stub and cast by design, so Next's presets skip them and only the zod rule reaches
// them. Everything else -- src/app, root project source and plugins -- gets the presets.
const TEST_FILES = [
  "**/tests/**",
  "**/__tests__/**",
  "**/__mocks__/**",
  "**/fixtures/**",
  "**/cypress/**",
  "**/*.{test,spec,cy}.{ts,tsx,mts,cts,js,jsx,mjs,cjs}",
  "**/{jest,cypress}.{config,setup}.{ts,mts,cts,js,mjs,cjs}",
];

/** "error", 2 or ["error", ...]. */
const isError = (setting) => [setting, setting?.[0]].some((level) => level === "error" || level === 2);

/**
 * The severity this project gives the rules Next's presets configure.
 *
 * `@next/next/no-img-element` is an error: the presets only warn, which leaves `eslint .` passing,
 * and next/image is what serves an image resized and in a modern format.
 *
 * eslint-plugin-react-hooks 7, which Next 16's presets load, adds to rules-of-hooks and
 * exhaustive-deps the rules that flag code the React Compiler cannot compile. A NextSpark project
 * does not build with the React Compiler, and the components NextSpark ships in src/app, root project source,
 * and plugins break several of those rules, so they report as warnings. Version 5, which Next 15
 * loads, has none of them.
 */
function projectSeverity(rule, setting) {
  if (rule === "@next/next/no-img-element") return "error";
  const compilerRule = rule.startsWith("react-hooks/") && !["react-hooks/rules-of-hooks", "react-hooks/exhaustive-deps"].includes(rule);
  return compilerRule && isError(setting) ? "warn" : setting;
}

const eslintConfig = [
  {
    // Next writes next-env.d.ts itself; version 16's presets ignore it and version 15's do not.
    ignores: [".next/**", ".nextspark/**", "next-env.d.ts"],
  },
  ...presets.map((config) =>
    isGlobalIgnore(config)
      ? config
      : {
          ...config,
          ignores: [...(config.ignores ?? []), ...TEST_FILES],
          ...(config.rules && {
            rules: Object.fromEntries(Object.entries(config.rules).map(([rule, setting]) => [rule, projectSeverity(rule, setting)])),
          }),
        },
  ),
  {
    // A .cjs file is CommonJS by definition, so `require` is the only spelling it has.
    files: ["**/*.cjs"],
    ignores: TEST_FILES,
    rules: { "@typescript-eslint/no-require-imports": "off" },
  },
  {
    // The presets would have supplied the parser here. Their plugins are registered so the disable
    // comments in tests resolve the rules they name, without turning any of those rules on.
    files: TEST_FILES,
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
