/**
 * #561: the API Explorer's JSON editor (CodeMirror) and the test viewer's renderers (markdown, highlighting, diagrams) are most
 * of the JavaScript of /devtools/api and /devtools/tests, and no first paint needs them: they load through next/dynamic.
 * A static import of one of them puts it back in the route chunk.
 */
import { describe, test, expect } from '@jest/globals'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const DEVTOOLS = path.join(__dirname, '../../../src/components/devtools')
const read = (file: string) => readFileSync(path.join(DEVTOOLS, file), 'utf8')
const staticImports = (source: string) => [...source.matchAll(/^import\s[^'"\n]*from\s+['"]([^'"]+)['"]/gm)].map(m => m[1])

describe('devtools heavy viewers load lazily (#561)', () => {
  test.each([
    ['api-tester/PayloadEditor.tsx', ['JsonEditor']],
    ['TestCasesViewer.tsx', ['MarkdownViewer']],
  ])('%s imports %j only through next/dynamic', (file, heavy) => {
    const source = read(file)
    expect(source).toMatch(/from ['"]next\/dynamic['"]/)
    for (const name of heavy) {
      expect(staticImports(source).filter(spec => spec.includes(name))).toEqual([])
      expect(source).toMatch(new RegExp(`dynamic\\(\\(\\) => import\\(['"][^'"]*${name}`))
    }
  })

  test('the code editor stays out of the response panel and the explorer shell', () => {
    for (const file of ['api-explorer/ApiExplorer.tsx', 'api-explorer/ApiRequestPanel.tsx', 'api-explorer/ApiResponsePanel.tsx']) {
      expect(staticImports(read(file)).filter(spec => spec.includes('JsonEditor') || spec.includes('codemirror'))).toEqual([])
    }
  })

  test('the API Explorer page imports the explorer from its own module, not the folder index that also exports the editor', () => {
    const page = readFileSync(path.join(__dirname, '../../../src/routes/devtools/api/[[...endpoint]]/page.tsx'), 'utf8')
    expect(staticImports(page)).not.toContain('@nextsparkjs/core/components/devtools/api-explorer')
    expect(staticImports(page)).toContain('@nextsparkjs/core/components/devtools/api-explorer/ApiExplorer')
  })
})
