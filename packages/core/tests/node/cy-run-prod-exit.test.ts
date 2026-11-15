import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawn, spawnSync } from 'node:child_process'
import { chmodSync, mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import net from 'node:net'
import os from 'node:os'
import path from 'node:path'

// cy-run-prod.cjs exits with Cypress's code and never kills itself freeing the port (#466)
const script = path.resolve(import.meta.dirname, '../../templates/scripts/cy-run-prod.cjs')
const posix = process.platform !== 'win32'

const freePort = () => new Promise<number>((resolve) => {
  const s = net.createServer().listen(0, () => { const { port } = s.address() as net.AddressInfo; s.close(() => resolve(port)) })
})
const holdPort = (port: number) => spawn(process.execPath, ['-e', `require('http').createServer((q,r)=>r.end('ok')).listen(${port},()=>console.log('up'))`], { stdio: ['ignore', 'pipe', 'inherit'] })
const up = (child: ReturnType<typeof spawn>) => new Promise<void>((resolve) => child.stdout!.once('data', () => resolve()))
const exited = (child: ReturnType<typeof spawn>) => new Promise<void>((resolve) => (child.exitCode !== null || child.signalCode ? resolve() : child.once('exit', () => resolve())))

// A fake pnpm: build passes, start serves PORT, exec cypress exits with FAKE_CYPRESS_EXIT
function project() {
  const dir = mkdtempSync(path.join(os.tmpdir(), 'cyprod-'))
  mkdirSync(path.join(dir, 'tests'))
  writeFileSync(path.join(dir, 'tests/cypress.config.ts'), '')
  mkdirSync(path.join(dir, 'bin'))
  writeFileSync(path.join(dir, 'bin/pnpm'), `#!${process.execPath}
const [cmd] = process.argv.slice(2)
if (cmd === 'start') require('http').createServer((q, r) => r.end('ok')).listen(Number(process.env.PORT))
else if (cmd === 'exec') process.exit(Number(process.env.FAKE_CYPRESS_EXIT))
`)
  chmodSync(path.join(dir, 'bin/pnpm'), 0o755)
  return dir
}
const run = (dir: string, exit: number, port: number) => spawnSync(process.execPath, [script], {
  cwd: dir, encoding: 'utf-8', timeout: 60000,
  env: { ...process.env, PATH: `${dir}/bin${path.delimiter}${process.env.PATH}`, PORT: String(port), FAKE_CYPRESS_EXIT: String(exit) },
})

test('a run whose Cypress fails ends with that code, and one that passes with 0', { skip: !posix }, async () => {
  const dir = project()
  try {
    const failed = run(dir, 3, await freePort())
    assert.equal(failed.status, 3, failed.stdout + failed.stderr)
    const passed = run(dir, 0, await freePort())
    assert.equal(passed.status, 0, passed.stdout + passed.stderr)
  } finally { rmSync(dir, { recursive: true, force: true }) }
})

test('freeing the port kills the process that holds it, not the script holding a socket to it', { skip: !posix }, async () => {
  const port = await freePort()
  const other = holdPort(port)
  await up(other)
  // A script with its own keep-alive socket on the port, as the health check once had
  const probe = spawnSync(process.execPath, ['-e', `
    const { killPort } = require(${JSON.stringify(script)})
    const agent = new (require('http').Agent)({ keepAlive: true })
    require('http').get({ port: ${port}, agent }, (res) => { res.resume(); res.on('end', () => { killPort(${port}); console.log('alive') }) })
  `], { encoding: 'utf-8', timeout: 30000 })
  try {
    assert.match(probe.stdout, /alive/, `signal ${probe.signal} status ${probe.status} ${probe.stderr}`)
    await Promise.race([exited(other), new Promise((r) => setTimeout(r, 5000))])
    assert.equal(other.signalCode, 'SIGKILL', 'the foreign process still holds the port')
  } finally { other.kill('SIGKILL') }
})
