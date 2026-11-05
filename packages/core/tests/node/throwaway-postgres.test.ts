/**
 * The throwaway cluster the database tests share (#402): a port another process takes between picking it and
 * binding it is retried on a new one, and a cluster that cannot start says why and leaves nothing behind. A stand-in
 * pg_ctl first to start fails the way the real one does, then hands over to the real one.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { HAS_POSTGRES, startCluster } from '../support/throwaway-postgres'

const skip = !HAS_POSTGRES && 'initdb/pg_ctl not on PATH'

type TestContext = { after: (fn: () => void) => void }

/**
 * Puts a pg_ctl first on the PATH that fails its first `failures` starts with `message` in the server log (the `-l`
 * file), and starts for real after that. Returns the ports it was asked to start on.
 */
function fakePgCtl(t: TestContext, failures: number, message: string) {
  const real = spawnSync('which', ['pg_ctl'], { encoding: 'utf8' }).stdout.trim()
  const bin = fs.mkdtempSync(path.join(os.tmpdir(), 'fake-pg-ctl-'))
  const ports = path.join(bin, 'ports')
  fs.writeFileSync(path.join(bin, 'pg_ctl'), `#!/bin/bash
args=("$@")
starting=no
for arg in "$@"; do [ "$arg" = start ] && starting=yes; done
if [ $starting = yes ]; then
  while [ $# -gt 0 ]; do
    case "$1" in -l) log=$2;; -o) options=$2;; esac
    shift
  done
  echo "$options" | sed -E 's/.*-p ([0-9]+).*/\\1/' >> ${JSON.stringify(ports)}
  if [ "$(wc -l < ${JSON.stringify(ports)})" -le ${failures} ]; then
    echo ${JSON.stringify(message)} > "$log"
    echo "pg_ctl: could not start server" >&2
    exit 1
  fi
fi
exec ${JSON.stringify(real)} "\${args[@]}"
`, { mode: 0o755 })
  const path0 = process.env.PATH
  process.env.PATH = `${bin}:${path0}`
  t.after(() => {
    process.env.PATH = path0
    fs.rmSync(bin, { recursive: true, force: true })
  })
  return () => fs.readFileSync(ports, 'utf8').trim().split('\n')
}

const clustersLeft = () => fs.readdirSync(os.tmpdir()).filter(name => name.startsWith('throwaway-test-'))

test('a port taken between picking it and binding it is retried on another port', { skip, timeout: 120000 }, async t => {
  const portsAsked = fakePgCtl(t, 1, 'FATAL:  could not create any TCP/IP sockets\nLOG:  could not bind IPv4 address "127.0.0.1": Address already in use')
  const cluster = await startCluster('throwaway-test')
  t.after(cluster.stop)
  const ports = portsAsked()
  assert.equal(ports.length, 2, 'one refused start and one that worked')
  assert.equal(ports[1], String(cluster.port))
})

test('a cluster that cannot start throws the server log, and leaves no directory behind', { skip, timeout: 120000 }, async t => {
  const before = clustersLeft().length
  fakePgCtl(t, 99, 'FATAL:  data directory has wrong ownership')
  await assert.rejects(startCluster('throwaway-test'), (error: Error) => {
    assert.match(error.message, /did not start/)
    assert.match(error.message, /data directory has wrong ownership/)
    return true
  })
  assert.equal(clustersLeft().length, before)
})

test('a start that fails for another reason than a taken port is not retried', { skip, timeout: 120000 }, async t => {
  const portsAsked = fakePgCtl(t, 99, 'FATAL:  data directory has wrong ownership')
  await assert.rejects(startCluster('throwaway-test'), /wrong ownership/)
  assert.equal(portsAsked().length, 1)
})
