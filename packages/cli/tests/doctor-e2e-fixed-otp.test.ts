import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { checkE2eFixedOtp } from '../src/doctor/checks/e2e-fixed-otp.js'

/** The doctor's result for a project holding `files` (name to content). */
async function doctor(files: Record<string, string>) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nextspark-doctor-e2e-otp-'))
  for (const [name, content] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), content)
  try {
    return await checkE2eFixedOtp(dir)
  } finally {
    fs.rmSync(dir, { recursive: true, force: true })
  }
}

test('doctor warns when a file a production build loads sets NEXTSPARK_E2E_FIXED_OTP, without its value (#460)', async () => {
  for (const file of ['.env', '.env.local', '.env.production', '.env.production.local']) {
    const result = await doctor({ [file]: 'DATABASE_URL=postgres://x\nNEXTSPARK_E2E_FIXED_OTP="482913"\n' })
    assert.equal(result.status, 'warn', file)
    assert.equal(result.code, 'NS_E2E_FIXED_OTP_IN_ENV_FILE')
    assert.match(result.message, new RegExp(`^NS_E2E_FIXED_OTP_IN_ENV_FILE: ${file.replace(/\./g, '\\.')} sets`))
    assert.match(result.fix ?? '', /\.env\.development\.local/)
    assert.ok(!JSON.stringify(result).includes('482913'), file)
  }
  const both = await doctor({ '.env': 'NEXTSPARK_E2E_FIXED_OTP=482913\n', '.env.local': 'NEXTSPARK_E2E_FIXED_OTP=482913\n' })
  assert.match(both.message, /^NS_E2E_FIXED_OTP_IN_ENV_FILE: \.env, \.env\.local set/)
})

test('doctor passes with the variable in .env.development.local, commented out, empty, or nowhere (#460)', async () => {
  for (const files of [
    { '.env.development.local': 'NEXTSPARK_E2E_FIXED_OTP=482913\n', '.env': 'DATABASE_URL=postgres://x\n' },
    { '.env': '# NEXTSPARK_E2E_FIXED_OTP=482913\n' },
    { '.env': 'NEXTSPARK_E2E_FIXED_OTP=\n' },
    {},
  ]) {
    assert.equal((await doctor(files)).status, 'pass', JSON.stringify(files))
  }
})
