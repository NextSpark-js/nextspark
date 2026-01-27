/**
 * Tests for api/client.types.ts
 * ApiError class and type definitions
 */

import { ApiError } from '../../../src/api/client.types'

describe('ApiError', () => {
  it('should be instance of Error', () => {
    const error = new ApiError('Test error', 400)

    expect(error).toBeInstanceOf(Error)
  })

  it('should have message, status, and data properties', () => {
    const data = { field: 'email', reason: 'invalid' }
    const error = new ApiError('Validation failed', 422, data)

    expect(error.message).toBe('Validation failed')
    expect(error.status).toBe(422)
    expect(error.data).toEqual(data)
  })

  it('should have name property set to ApiError', () => {
    const error = new ApiError('Error', 500)

    expect(error.name).toBe('ApiError')
  })

  it('should work with default data (undefined)', () => {
    const error = new ApiError('Not found', 404)

    expect(error.message).toBe('Not found')
    expect(error.status).toBe(404)
    expect(error.data).toBeUndefined()
  })

  it('should be catchable as Error', () => {
    const throwApiError = () => {
      throw new ApiError('Test', 500)
    }

    expect(throwApiError).toThrow(Error)
    expect(throwApiError).toThrow(ApiError)
  })

  it('should support try/catch with instanceof check', () => {
    try {
      throw new ApiError('Server error', 500, { retry: true })
    } catch (e) {
      if (e instanceof ApiError) {
        expect(e.status).toBe(500)
        expect(e.data).toEqual({ retry: true })
      } else {
        fail('Should be ApiError instance')
      }
    }
  })
})
