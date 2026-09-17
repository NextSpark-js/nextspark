import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// The two package tests below deliberately empty generated templates in the
// real checkout. node --test gives files separate processes, so serialize that
// destructive setup and its restoration with a lock outside the checkout.
const lockPath = (repoRoot) => join(
  tmpdir(),
  `nextspark-template-app-tests-${createHash('sha256').update(repoRoot).digest('hex')}.lock`,
)

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

function ownerIsGone(path) {
  try {
    const { pid } = JSON.parse(readFileSync(join(path, 'owner.json'), 'utf8'))
    if (!Number.isInteger(pid) || pid <= 0) return false
    try {
      process.kill(pid, 0)
      return false
    } catch (error) {
      return error.code === 'ESRCH'
    }
  } catch {
    // Do not take over a malformed or unreadable lock: another process could
    // be in the small interval between mkdir and writing its owner file.
    return false
  }
}

async function acquire(repoRoot, timeoutMs = 60_000) {
  const path = lockPath(repoRoot)
  const deadline = Date.now() + timeoutMs

  while (true) {
    try {
      mkdirSync(path)
      writeFileSync(join(path, 'owner.json'), JSON.stringify({ pid: process.pid }))
      return () => rmSync(path, { recursive: true, force: true })
    } catch (error) {
      if (error.code !== 'EEXIST') throw error
      if (ownerIsGone(path)) {
        // Renaming is atomic: two waiters cannot both remove a stale lock and
        // accidentally delete the directory one of them has just acquired.
        try {
          const stalePath = `${path}.stale-${process.pid}-${Math.random().toString(16).slice(2)}`
          renameSync(path, stalePath)
          rmSync(stalePath, { recursive: true, force: true })
        } catch (staleError) {
          if (staleError.code !== 'ENOENT') throw staleError
        }
        continue
      }
      if (Date.now() >= deadline) {
        throw new Error(`Timed out waiting for generated-template test lock: ${path}`)
      }
      await delay(50)
    }
  }
}

export async function withTemplateAppTestLock(repoRoot, run) {
  const release = await acquire(repoRoot)
  try {
    return await run()
  } finally {
    release()
  }
}
