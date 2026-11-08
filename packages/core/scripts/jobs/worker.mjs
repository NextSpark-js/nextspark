/**
 * Entry of `nextspark worker` (#275). The CLI starts it with tsx (the project's handlers and registries are
 * TypeScript behind the project tsconfig paths) and `--conditions=react-server` (so `server-only` is empty).
 */
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const coreDir = process.env.NEXTSPARK_CORE_DIR ?? path.resolve(import.meta.dirname, '..', '..')
const { runWorkerProcess } = await import(pathToFileURL(path.join(coreDir, 'dist', 'lib', 'jobs', 'run.js')).href)

try {
  await runWorkerProcess()
} catch (error) {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}
