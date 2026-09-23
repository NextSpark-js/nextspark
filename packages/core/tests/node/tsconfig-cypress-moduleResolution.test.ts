import { test } from 'node:test'
import assert from 'node:assert/strict'
import path from 'node:path'
import fs from 'node:fs'
import os from 'node:os'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const TSCONFIG_CYPRESS = path.join(CORE, 'templates', 'tsconfig.cypress.json')

test('packages/core/templates/tsconfig.cypress.json ships module=preserve + moduleResolution=bundler', () => {
  const raw = fs.readFileSync(TSCONFIG_CYPRESS, 'utf-8')
  const config = JSON.parse(raw)
  const opts = config.compilerOptions

  assert.ok(opts, 'compilerOptions is required')
  assert.equal(opts.module, 'preserve', 'module must be "preserve"')
  assert.equal(opts.moduleResolution, 'bundler', 'moduleResolution must be "bundler"')
})

test('module=preserve with moduleResolution=node16 is rejected by tsc (TS5110)', () => {
  assert.throws(
    () => {
      simulateTypeCheck({
        module: ts.ModuleKind.Preserve,
        moduleResolution: ts.ModuleResolutionKind.Node16,
      })
    },
    /TS5110/,
    'preserve + node16 should emit TS5110'
  )
})

test('module=preserve with moduleResolution=nodenext is rejected by tsc', () => {
  assert.throws(
    () => {
      simulateTypeCheck({
        module: ts.ModuleKind.Preserve,
        moduleResolution: ts.ModuleResolutionKind.NodeNext,
      })
    },
    /TS5110/,
    'preserve + nodenext should emit TS5110'
  )
})

test('template tsconfig compiles a subpath-exports fixture successfully', () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-cypress-test-'))
  try {
    const nodeModules = path.join(tmpDir, 'node_modules', 'exporter')
    fs.mkdirSync(nodeModules, { recursive: true })

    fs.writeFileSync(
      path.join(nodeModules, 'package.json'),
      JSON.stringify({
        name: 'exporter',
        version: '1.0.0',
        exports: {
          './sub': { default: './dist/sub.js' },
        },
      })
    )

    fs.mkdirSync(path.join(nodeModules, 'dist'))
    fs.writeFileSync(path.join(nodeModules, 'dist', 'sub.js'), '')
    fs.writeFileSync(path.join(nodeModules, 'dist', 'sub.d.ts'), 'export declare const greet: string\n')

    fs.writeFileSync(
      path.join(tmpDir, 'index.ts'),
      `import { greet } from 'exporter/sub'\nconsole.log(greet)\n`
    )

    const tsconfig = JSON.parse(fs.readFileSync(TSCONFIG_CYPRESS, 'utf-8'))
    tsconfig.compilerOptions.baseUrl = '.'
    delete tsconfig.compilerOptions.paths
    delete tsconfig.compilerOptions.types
    tsconfig.include = ['index.ts']
    tsconfig.exclude = []

    const configPath = path.join(tmpDir, 'tsconfig.json')
    fs.writeFileSync(configPath, JSON.stringify(tsconfig, null, 2))

    const parsedCommandLine = ts.getParsedCommandLineOfConfigFile(
      configPath,
      {},
      {
        ...ts.sys,
        readDirectory: ts.sys.readDirectory,
        fileExists: ts.sys.fileExists,
        readFile: ts.sys.readFile,
        getCurrentDirectory: () => tmpDir,
        onUnRecoverableConfigFileDiagnostic: () => {},
      }
    )

    assert.ok(parsedCommandLine, 'failed to parse tsconfig')
    assert.equal(
      parsedCommandLine!.errors.length,
      0,
      ts.formatDiagnosticsWithColorAndContext(parsedCommandLine!.errors, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: () => tmpDir,
        getNewLine: () => '\n',
      })
    )

    const program = ts.createProgram({
      options: parsedCommandLine!.options,
      rootNames: parsedCommandLine!.fileNames,
    })

    const diagnostics = ts.getPreEmitDiagnostics(program)
    const errors = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => tmpDir,
      getNewLine: () => '\n',
    })

    assert.equal(diagnostics.length, 0, `Compile errors:\n${errors}`)
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
})

function simulateTypeCheck(baseOptions: ts.CompilerOptions) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tsconfig-cypress-invalid-'))
  try {
    fs.writeFileSync(path.join(tmpDir, 'empty.ts'), 'export const x: number = 1\n')

    const options: ts.CompilerOptions = {
      ...baseOptions,
      target: ts.ScriptTarget.ES2020,
      noEmit: true,
      strict: true,
      skipLibCheck: true,
    }

    const program = ts.createProgram({ options, rootNames: [path.join(tmpDir, 'empty.ts')] })
    const diagnostics = ts.getPreEmitDiagnostics(program)

    if (diagnostics.length === 0) {
      return
    }

    const errorText = ts.formatDiagnosticsWithColorAndContext(diagnostics, {
      getCanonicalFileName: (f) => f,
      getCurrentDirectory: () => tmpDir,
      getNewLine: () => '\n',
    })

    if (/TS5110|TS5111/.test(errorText)) {
      throw new TypeError(errorText)
    }
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  }
}