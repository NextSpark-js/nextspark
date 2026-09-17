/**
 * Runs `copyFileSync` from a project's `projectFiles`, from a FIFO source into a
 * destination that the parent process swaps for a symlink while this process is
 * blocked opening that FIFO - after safe-fs's own check already ran.
 */
import { projectFiles } from '../../safe-fs.mjs'

const [, , root, source, destination] = process.argv
try {
  projectFiles(root).copyFileSync(source, destination)
  process.stdout.write(JSON.stringify({ ok: true }))
} catch (error) {
  process.stdout.write(JSON.stringify({ code: error.code }))
}
