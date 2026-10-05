import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkConfigs } from '../src/doctor/checks/config.js'

async function checkTsconfig(content: string) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-config-'))
  const previous = process.cwd()
  fs.writeFileSync(path.join(dir, 'tsconfig.json'), content)
  process.chdir(dir)
  try {
    return await checkConfigs()
  } finally {
    process.chdir(previous)
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor accepts the JSONC a generated tsconfig.json is written in', async () => {
  const result = await checkTsconfig(`{
  // a comment, and a URL inside a string that is not one: "https://nextspark.dev"
  "compilerOptions": { "baseUrl": "https://example.test/a//b", /* inline */ "strict": true, },
  "exclude": [
    "node_modules",
  ]
}`)
  assert.equal(result.status, 'pass', result.message)
})

test('doctor still fails a tsconfig.json that is not JSON at all', async () => {
  const result = await checkTsconfig('{ "compilerOptions": ')
  assert.equal(result.status, 'fail')
  assert.match(result.message, /tsconfig\.json/)
})
