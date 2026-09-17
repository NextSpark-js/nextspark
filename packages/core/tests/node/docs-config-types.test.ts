import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const ENTRY = path.join(CORE, 'tests/node/docs-config-types.fixture.ts')

function diagnosticsFor(source: string): readonly ts.Diagnostic[] {
  const options: ts.CompilerOptions = {
    strict: true,
    noEmit: true,
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    skipLibCheck: true,
  }
  const host = ts.createCompilerHost(options)
  const getSourceFile = host.getSourceFile.bind(host)
  host.getSourceFile = (fileName, languageVersion, onError, shouldCreateNewSourceFile) =>
    path.resolve(fileName) === ENTRY
      ? ts.createSourceFile(ENTRY, source, languageVersion, true)
      : getSourceFile(fileName, languageVersion, onError, shouldCreateNewSourceFile)

  return ts.getPreEmitDiagnostics(ts.createProgram([ENTRY], options, host))
}

const VALID_CONFIGS = `
import type { AppConfig } from '../../src/lib/config/types'

// Theme app.config.ts files declare this block under their app configuration.
type ThemeAppConfig = Pick<AppConfig, 'docs'>

const legacyPrivate: ThemeAppConfig = { docs: { public: false } }
const legacyPublic: ThemeAppConfig = { docs: { public: true } }
const current: ThemeAppConfig = {
  docs: {
    publicAccess: false,
    public: { enabled: true, open: false, label: 'Documentation' },
  },
}

// These compatibility settings type-check both when present and when absent.
const noEffectSettingsPresent: ThemeAppConfig = {
  docs: {
    enabled: false,
    searchEnabled: false,
    breadcrumbs: false,
    public: { enabled: true, open: true, label: 'Documentation' },
    superadmin: { enabled: false, open: false, label: 'Admin Docs' },
  },
}
const noEffectSettingsAbsent: ThemeAppConfig = { docs: {} }

void [legacyPrivate, legacyPublic, current, noEffectSettingsPresent, noEffectSettingsAbsent]
`

test('DocsConfig accepts legacy access booleans and current sidebar settings', () => {
  const diagnostics = diagnosticsFor(VALID_CONFIGS)
  assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => CORE,
    getNewLine: () => '\n',
  }))
})

test('DocsConfig rejects a non-boolean legacy public value', () => {
  const diagnostics = diagnosticsFor(`
import type { AppConfig } from '../../src/lib/config/types'

const invalid: Pick<AppConfig, 'docs'> = { docs: { public: 'yes' } }
void invalid
`)

  assert.ok(diagnostics.some(diagnostic => diagnostic.code === 2322), ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: fileName => fileName,
    getCurrentDirectory: () => CORE,
    getNewLine: () => '\n',
  }))
})
