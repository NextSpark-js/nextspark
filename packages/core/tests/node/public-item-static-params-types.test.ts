import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

/**
 * The generated item route wraps the template's `generateStaticParams` in `createPublicItemStaticParams`, and
 * `src/app` is part of the project's tsconfig, so the wrapper has to accept every shape of the function that
 * `next build` accepts (#370). The probe is compiled in memory with `strict`; only its own diagnostics count.
 */

const CORE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const helperFile = path.join(CORE, 'src/routes/_internal/public-item-route.tsx')

test('createPublicItemStaticParams accepts the shapes of generateStaticParams a template can have', () => {
  const probeFile = path.join(CORE, '.public-item-static-params.probe.ts')
  const probe = `
import { createPublicItemStaticParams } from ${JSON.stringify(helperFile)}

type AliasParams = { slug: string }
interface InterfaceParams { slug: string }

async function withAlias(): Promise<AliasParams[]> { return [{ slug: 'a' }] }
async function withInterface(): Promise<InterfaceParams[]> { return [{ slug: 'a/b' }] }
async function withProps({ params }: { params: Promise<Record<string, string>> }) { void params; return [{ slug: ['a'] }] }
function sync() { return [{ slug: 'a', locale: 'es' }] }

export const probes = [
  createPublicItemStaticParams(withAlias, true),
  createPublicItemStaticParams(withInterface, false),
  createPublicItemStaticParams(withProps, true),
  createPublicItemStaticParams(sync, false),
]
`
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.esnext.d.ts'],
    skipLibCheck: true,
    strict: true,
    noEmit: true,
    allowImportingTsExtensions: true,
    esModuleInterop: true,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.Bundler,
    resolveJsonModule: true,
    isolatedModules: true,
    jsx: ts.JsxEmit.ReactJSX,
  }
  const host = ts.createCompilerHost(options)
  const readFile = host.readFile.bind(host)
  host.readFile = (fileName) => (path.resolve(fileName) === probeFile ? probe : readFile(fileName))
  const fileExists = host.fileExists.bind(host)
  host.fileExists = (fileName) => path.resolve(fileName) === probeFile || fileExists(fileName)

  const program = ts.createProgram([probeFile], options, host)
  const own = ts.getPreEmitDiagnostics(program).filter((diagnostic) => path.resolve(diagnostic.file?.fileName ?? '') === probeFile)
  const text = ts.formatDiagnostics(own, { getCanonicalFileName: (f) => f, getCurrentDirectory: () => CORE, getNewLine: () => '\n' })
  assert.equal(own.length, 0, text)
})
