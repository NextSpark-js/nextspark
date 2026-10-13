import { actionErrorMessage } from '@/core/lib/actions/errors'

describe('actionErrorMessage', () => {
  test.each([
    ['a database error', new Error('new row for relation "teams" violates check constraint "valid_slug"')],
    ['a runtime error', new TypeError("Cannot read properties of undefined (reading 'trim')")],
    ['a system error', Object.assign(new Error('connect ECONNREFUSED 127.0.0.1:5432'), { code: 'ECONNREFUSED' })],
    ['a non-error', 'index row size 3000 exceeds btree maximum'],
  ])('answers the fixed message for %s', (_name, error) => {
    expect(actionErrorMessage(error, 'Failed to do it')).toBe('Failed to do it')
  })

  test('keeps the message of the errors thrown for the user', () => {
    expect(actionErrorMessage(Object.assign(new Error('Only the current owner can transfer ownership'), { code: 'NOT_OWNER' }), 'x'))
      .toBe('Only the current owner can transfer ownership')
    expect(actionErrorMessage(new Error('Validation failed: title is required'), 'x')).toBe('Validation failed: title is required')
    expect(actionErrorMessage(new Error('Permission denied'), 'x')).toBe('Permission denied')
  })
})
