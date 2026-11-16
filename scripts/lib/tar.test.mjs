import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { tarCreate, tarRead } from './tar.mjs'

test('tar refuses an absolute path in its arguments, drive paths included', () => {
  for (const bad of ['/tmp/x', 'G:\\tmp\\x', 'G:/tmp/x']) {
    assert.throws(() => tarCreate('unused.tgz', ['-C', bad, 'package']), /absolute path/)
    assert.throws(() => tarRead('unused.tgz', 'xz', ['-C', bad]), /absolute path/)
  }
})

test('tarCreate and tarRead round-trip through cwd', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tar-lib-'))
  try {
    mkdirSync(join(dir, 'src', 'package'), { recursive: true })
    writeFileSync(join(dir, 'src', 'package', 'a.txt'), 'hi')
    const archive = join(dir, 'a.tgz')
    assert.equal(tarCreate(archive, ['package'], { cwd: join(dir, 'src') }).status, 0)
    mkdirSync(join(dir, 'out'))
    assert.equal(tarRead(archive, 'xz', [], { cwd: join(dir, 'out') }).status, 0)
    assert.equal(readFileSync(join(dir, 'out', 'package', 'a.txt'), 'utf8'), 'hi')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
})
