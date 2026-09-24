import assert from 'node:assert/strict'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from 'node:test'
import ts from 'typescript'

/**
 * Code that uses the agent the langchain plugin creates has to type-check against LangChain's own
 * signatures: `getAgent()` hands back the LangGraph agent, whose `invoke` and `streamEvents` take
 * its messages state. The probe below is compiled in memory; only its own diagnostics count, since
 * the plugin compiled outside a project reports errors that have nothing to do with it.
 */

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const agentFactoryFile = path.join(REPO, 'plugins/langchain/lib/agent-factory.ts')
const streamingFile = path.join(REPO, 'plugins/langchain/lib/streaming.ts')

function formatDiagnostics(diagnostics: readonly ts.Diagnostic[]): string {
  return ts.formatDiagnosticsWithColorAndContext(diagnostics, {
    getCanonicalFileName: (fileName) => fileName,
    getCurrentDirectory: () => REPO,
    getNewLine: () => '\n',
  })
}

test('getAgent exposes LangChain inputs to invoke and streamEvents', () => {
  const probeFile = path.join(REPO, '.langchain-agent-types.probe.ts')
  const probe = `
import { createAgent } from ${JSON.stringify(agentFactoryFile)}
import { streamChat } from ${JSON.stringify(streamingFile)}

async function verifyAgentTypes() {
  const agent = (await createAgent({ sessionId: 's' })).getAgent()
  await agent.invoke({ messages: [] })
  for await (const event of agent.streamEvents({ messages: [] }, { version: 'v2' })) {
    void event
  }
  const stream = streamChat(agent, 'hello', { userId: 'user', teamId: 'team' }, {})
  for await (const chunk of stream) {
    void chunk
  }
}
void verifyAgentTypes
`
  const options: ts.CompilerOptions = {
    target: ts.ScriptTarget.ES2022,
    lib: ['lib.dom.d.ts', 'lib.dom.iterable.d.ts', 'lib.esnext.d.ts'],
    allowJs: true,
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
  host.readFile = (fileName) => path.resolve(fileName) === probeFile ? probe : readFile(fileName)
  const fileExists = host.fileExists.bind(host)
  host.fileExists = (fileName) => path.resolve(fileName) === probeFile || fileExists(fileName)

  const program = ts.createProgram([probeFile], options, host)
  const diagnostics = ts.getPreEmitDiagnostics(program)
  const probeDiagnostics = diagnostics.filter((diagnostic) => path.resolve(diagnostic.file?.fileName ?? '') === probeFile)
  const ignoredDiagnostics = diagnostics.filter((diagnostic) => path.resolve(diagnostic.file?.fileName ?? '') !== probeFile)

  assert.equal(
    probeDiagnostics.length,
    0,
    `Probe diagnostics: ${probeDiagnostics.length}; ignored diagnostics outside the probe: ${ignoredDiagnostics.length}\n${formatDiagnostics(probeDiagnostics)}`
  )
})
