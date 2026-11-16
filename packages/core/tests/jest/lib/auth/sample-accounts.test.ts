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

  it('logs one line, with the error code, or the class name and the plain words of the message, when the query fails, and never throws', async () => {
    const secret = 'postgresql://user:hunter2@db.example:5432/app'
    const withCode = Object.assign(new Error(`connect ECONNREFUSED ${secret}`), { code: 'ECONNREFUSED' })
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(withCode))).resolves.toBeUndefined()
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(new TypeError(secret)))).resolves.toBeUndefined()
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(null))).resolves.toBeUndefined()
    await expect(warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'a\nb' })))).resolves.toBeUndefined()
    expect(warn).toHaveBeenCalledTimes(4)
    for (const call of warn.mock.calls) expect(call).toHaveLength(1)
    expect(warn.mock.calls[0][0]).toContain('query failed: ECONNREFUSED')
    expect(warn.mock.calls[1][0]).toContain('query failed: TypeError: …);')
    expect(warn.mock.calls[2][0]).toContain('query failed: unknown error')
    expect(warn.mock.calls[3][0]).toContain('query failed: Error: x)')
    for (const [line] of warn.mock.calls) expect(line).not.toMatch(/hunter2|postgresql:|db\.example|5432|\n/)
  })

  it('an error without a code says what happened, not only Error (#480)', async () => {
    const cut = new Error('Connection terminated unexpectedly')
    const timeout = new Error('timeout exceeded when trying to connect')
    const leaky = new Error('getaddrinfo failed for db.internal.example at 10.0.0.7:5432 as "app_user" with user:pw@host')
    for (const error of [cut, timeout, leaky]) await warnSampleAccountsAtStartup({ NODE_ENV: 'production' }, jest.fn().mockRejectedValue(error))
    expect(warn.mock.calls[0][0]).toContain('query failed: Error: Connection terminated unexpectedly)')
    expect(warn.mock.calls[1][0]).toContain('query failed: Error: timeout exceeded when trying to connect)')
    expect(warn.mock.calls[2][0]).toContain('query failed: Error: getaddrinfo failed for … at … as … with …)')
    expect(warn.mock.calls[2][0]).not.toMatch(/internal|10\.0|5432|app_user|pw@/)
  })

  it('checks the same hashes the disabling migration removes', () => {
    const sql = fs.readFileSync(path.join(__dirname, '../../../../migrations/029_sample_accounts_outside_development.sql'), 'utf8')
    for (const hash of SAMPLE_PASSWORD_HASHES) expect(sql).toContain(`'${hash}'`)
  })
})
