import fs from 'fs'
import path from 'path'
import { SAMPLE_PASSWORD_HASHES, warnSampleAccountsAtStartup } from '@/core/lib/auth/sample-accounts'

describe('warnSampleAccountsAtStartup', () => {
  let warn: jest.SpyInstance
  beforeEach(() => { warn = jest.spyOn(console, 'warn').mockImplementation(() => {}) })
  afterEach(() => warn.mockRestore())

  it('warns in production when accounts still have a sample password', async () => {
    const queryRows = jest.fn().mockResolvedValue([{ count: 2 }])
    await warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, queryRows)
    expect(queryRows).toHaveBeenCalledWith(expect.stringContaining('"account"'), [SAMPLE_PASSWORD_HASHES])
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toMatch(/2 account\(s\) still have a sample-data password/)
  })

  it('says nothing when there are none or outside production', async () => {
    await warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockResolvedValue([{ count: 0 }]))
    const notCalled = jest.fn()
    await warnSampleAccountsAtStartup({ NODE_ENV: 'development' }, notCalled)
    expect(notCalled).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('logs one line, with the error code or class name only, when the query fails, and never throws', async () => {
    const secret = 'postgresql://user:hunter2@db.example:5432/app'
    const withCode = Object.assign(new Error(`connect ECONNREFUSED ${secret}`), { code: 'ECONNREFUSED' })
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(withCode))).resolves.toBeUndefined()
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(new TypeError(secret)))).resolves.toBeUndefined()
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(null))).resolves.toBeUndefined()
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'a\nb' })))).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(4)
    for (const call of warn.mock.calls) expect(call).toHaveLength(1)
    expect(warn.mock.calls[0][0]).toContain('query failed: ECONNREFUSED')
    expect(warn.mock.calls[1][0]).toContain('query failed: TypeError')
    expect(warn.mock.calls[2][0]).toContain('query failed: unknown error')
    expect(warn.mock.calls[3][0]).toContain('query failed: Error')
    for (const [line] of warn.mock.calls) expect(line).not.toMatch(/hunter2|postgresql:|\n/)
  })

  it('checks the same hashes the disabling migration removes', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../../../migrations/029_sample_accounts_outside_development.sql'), 'utf8')
    for (const hash of SAMPLE_PASSWORD_HASHES) expect(sql).toContain(`'${hash}'`)
  })
})
