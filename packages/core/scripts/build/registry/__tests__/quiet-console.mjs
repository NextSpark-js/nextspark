import { after, before, mock } from 'node:test'

/**
 * Keeps a test file's in-process console.log/info output off the test child's stdout. The Node test runner
 * reads that stdout for its own frames, and non-ASCII text on it (the build log's emoji) can make it fail with
 * "Unable to deserialize cloned data" (nodejs/node#64061, fixed on 24+ only; #65934 for 22).
 * Call once at the top of a file; a test that needs to read the output replaces console.log itself.
 */
export function silenceConsoleOutput() {
  before(() => {
    mock.method(console, 'log', () => {})
    mock.method(console, 'info', () => {})
  })
  after(() => {
    mock.restoreAll()
  })
}
