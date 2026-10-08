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

  it('says nothing when there are none, outside production, or when the database cannot answer', async () => {
    await warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockResolvedValue([{ count: 0 }]))
    const notCalled = jest.fn()
    await warnSampleAccountsAtStartup({ NODE_ENV: 'development' }, notCalled)
    await warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(new Error('down')))
    expect(notCalled).not.toHaveBeenCalled()
    expect(warn).not.toHaveBeenCalled()
  })

  it('checks the same hashes the disabling migration removes', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../../../migrations/029_sample_accounts_outside_development.sql'), 'utf8')
    for (const hash of SAMPLE_PASSWORD_HASHES) expect(sql).toContain(`'${hash}'`)
  })
})
