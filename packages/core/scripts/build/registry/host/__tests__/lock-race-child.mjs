// Child of the lock race test: waits for the shared start time and tries the lock once. The
// holder keeps it until the parent has seen every other child's answer (the `release` file), so
// "one holder per trial" never depends on how fast the runner starts processes.
import { existsSync } from 'node:fs'
import { join } from 'node:path'

import { acquireLock } from '../generation.mjs'

const [root, startText] = process.argv.slice(2)
while (Date.now() < Number(startText)) {}
try {
  const release = acquireLock(root)
  process.stdout.write('acquired\n')
  const deadline = Date.now() + 120_000
  while (!existsSync(join(root, 'release')) && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 10))
  release()
} catch (error) {
  process.stdout.write(`refused:${error?.diagnostics?.[0]?.code ?? error.code ?? error.message}\n`)
}
