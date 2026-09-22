/**
 * The root-level .ts files under packages/core/templates/ (proxy.ts, i18n.ts,
 * instrumentation.ts) are copied verbatim into every generated project by the
 * wizard (packages/cli/src/wizard/generators/index.ts's PROJECT_ROOT_ITEMS and
 * writeProxyFile), so `next build`'s mandatory type-check runs each of them
 * with the strict TypeScript config the template tsconfig.json ships
 * (packages/core/templates/tsconfig.json). None of the existing template
 * checks (proxy-matcher.test.ts parses the AST only; docs-access-contract.test.ts
 * greps source text; apps-dev-proxy.test.ts only diffs the re-export) actually
 * type-checks these files, so a strict-null error like TS18047 in a themeResponse
 * access (see themeRequestHeaders in proxy.ts) reaches every generated project
 * and fails its build without failing anything in this repo's own CI, since
 * apps/dev/proxy.ts only re-exports the already-compiled function and its own
 * tsc run does not re-diagnose the template source under the generated
 * project's `@nextsparkjs/core/*` package-boundary resolution.
 *
 * This compiles each file in isolation the way a generated project's
 * tsconfig.json resolves it: `@nextsparkjs/core/*` to core's own `src/*`
 * (the same mapping apps/dev/tsconfig.json uses for the monorepo dev app,
 * itself type-checked in CI) and `@nextsparkjs/registries/docs-registry` to a
 * minimal in-memory stand-in for the registry the wizard's registry build
 * generates per project, typed against the same DocsRegistryStructure core
 * ships. Only diagnostics reported in the template file itself count: a
 * diagnostic from core's own src/ would be a pre-existing core bug, not a
 * template-copy regression, and is covered by packages/core's own `tsc --noEmit`.
 *
 * IMPORTANT: this is NOT a full generated-host type-check. It compiles only
 * the template file named in each test, in isolation, against a minimal stub
 * for the one import (`@nextsparkjs/registries/docs-registry`) a real project
 * only has after its own registry build runs; diagnostics from anywhere else
 * (core's src/, the stub, imported .d.ts files) are deliberately filtered
 * out. A real generated project's app/, contents/, themes/ and plugins/ are
 * not part of this program at all, so this test proves nothing about whether
 * a complete generated host type-checks -- only that these specific template
 * files, on their own, do not carry a diagnostic like TS18047 into every
 * project that copies them.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TEMPLATES = path.join(CORE, 'templates')

/** Root-level template .ts files the wizard copies into every generated project. */
const ROOT_TEMPLATE_TS_FILES = ['proxy.ts', 'i18n.ts', 'instrumentation.ts']

/** A virtual path standing in for the per-project generated registry module. */
const REGISTRY_STUB = path.join(CORE, '.templates-typecheck-registry-stub.ts')
const REGISTRY_STUB_SOURCE = `
import type { DocsRegistryStructure } from './src/types/docs'

export const DOCS_REGISTRY: DocsRegistryStructure = { public: [], superadmin: [], all: [] }
`

function diagnosticsFor(entryFile: string): readonly ts.Diagnostic[] {
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.esnext.d.ts'],
    allowJs: true,
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    esModuleInterop: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: ts.JsxEmit.ReactJSX,
    baseUrl: CORE,
    paths: {
      '@nextsparkjs/core': ['./src/index.ts'],
      '@nextsparkjs/core/*': ['./src/*'],
      '@nextsparkjs/registries/docs-registry': ['./.templates-typecheck-registry-stub.ts'],
    },
  }

  const host = ts.createCompilerHost(options)

  const fileExists = host.fileExists.bind(host)
  host.fileExists = (fileName) => path.resolve(fileName) === REGISTRY_STUB || fileExists(fileName)

  const readFile = host.readFile.bind(host)
  host.readFile = (fileName) => (path.resolve(fileName) === REGISTRY_STUB ? REGISTRY_STUB_SOURCE : readFile(fileName))

  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === REGISTRY_STUB
      ? ts.createSourceFile(REGISTRY_STUB, REGISTRY_STUB_SOURCE, languageVersion, true)
      : getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)

  const program = ts.createProgram([entryFile], options, host)
  return ts.getPreEmitDiagnostics(program).filter((diagnostic) => diagnostic.file?.fileName === entryFile)
}

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => CORE,
    getNewLine: () => '\n',
  })
}

for (const file of ROOT_TEMPLATE_TS_FILES) {
  test(`packages/core/templates/${file} type-checks strictly the way a generated project's tsconfig resolves it`, () => {
    const entryFile = path.join(TEMPLATES, file)
    const diagnostics = diagnosticsFor(entryFile)
    assert.equal(diagnostics.length, 0, formatDiagnostics(diagnostics))
  })
}
