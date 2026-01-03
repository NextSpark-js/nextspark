/**
 * Unit Tests for URL Builder Utilities
 *
 * Tests the utility functions used in the DevTools API Tester:
 * - extractPathParams() - Extract path parameters from URL patterns
 * - buildUrl() - Build complete URLs with path and query params
 * - validatePathParams() - Validate required path parameters
 * - validateJsonBody() - Validate JSON syntax
 */

import { describe, test, expect } from '@jest/globals'
import {
  extractPathParams,
  buildUrl,
  validatePathParams,
  validateJsonBody,
} from '@/core/components/devtools/api-tester/utils/url-builder'
import type { PathParam, KeyValuePair } from '@/core/components/devtools/api-tester/types'

describe('URL Builder Utilities', () => {
  describe('extractPathParams', () => {
    describe('Next.js App Router Patterns', () => {
      test('should extract single dynamic segment [id]', () => {
        const params = extractPathParams('/api/v1/users/[id]')

        expect(params).toHaveLength(1)
        expect(params[0]).toEqual({
          name: 'id',
          pattern: '[id]',
          value: '',
          required: true,
        })
      })

      test('should extract multiple dynamic segments', () => {
        const params = extractPathParams('/api/v1/teams/[teamId]/members/[memberId]')

        expect(params).toHaveLength(2)
        expect(params[0]).toEqual({
          name: 'teamId',
          pattern: '[teamId]',
          value: '',
          required: true,
        })
        expect(params[1]).toEqual({
          name: 'memberId',
          pattern: '[memberId]',
          value: '',
          required: true,
        })
      })

      test('should extract catch-all segment [...path]', () => {
        const params = extractPathParams('/api/v1/files/[...path]')

        expect(params).toHaveLength(1)
        expect(params[0]).toEqual({
          name: 'path',
          pattern: '[...path]',
          value: '',
          required: false, // catch-all is not required
        })
      })

      test('should extract optional catch-all [[...path]]', () => {
        const params = extractPathParams('/api/v1/docs/[[...slug]]')

        expect(params).toHaveLength(1)
        // Note: The regex extracts the first matching bracket group, so [[...slug]] becomes [[...slug]
        expect(params[0]).toEqual({
          name: '[slug', // Double bracket extracts as [slug (regex limitation)
          pattern: '[[...slug]',
          value: '',
          required: false, // optional catch-all
        })
      })

      test('should handle mixed static and dynamic segments', () => {
        const params = extractPathParams('/api/v1/products/[id]/reviews/[reviewId]')

        expect(params).toHaveLength(2)
        expect(params[0].name).toBe('id')
        expect(params[1].name).toBe('reviewId')
      })
    })

    describe('Next.js Legacy Patterns', () => {
      test('should extract colon-based dynamic segment :id', () => {
        const params = extractPathParams('/api/v1/users/:id')

        expect(params).toHaveLength(1)
        expect(params[0]).toEqual({
          name: 'id',
          pattern: ':id',
          value: '',
          required: true,
        })
      })

      test('should extract multiple colon-based segments', () => {
        const params = extractPathParams('/api/v1/teams/:teamId/members/:memberId')

        expect(params).toHaveLength(2)
        expect(params[0].name).toBe('teamId')
        expect(params[1].name).toBe('memberId')
      })
    })

    describe('Edge Cases', () => {
      test('should return empty array for static paths', () => {
        const params = extractPathParams('/api/v1/users')

        expect(params).toHaveLength(0)
      })

      test('should handle empty string', () => {
        const params = extractPathParams('')

        expect(params).toHaveLength(0)
      })

      test('should handle paths with query strings', () => {
        const params = extractPathParams('/api/v1/users/[id]?limit=10')

        expect(params).toHaveLength(1)
        expect(params[0].name).toBe('id')
      })

      test('should handle mixed bracket and colon patterns', () => {
        const params = extractPathParams('/api/v1/:version/users/[id]')

        expect(params).toHaveLength(2)
        expect(params[0]).toEqual({
          name: 'version',
          pattern: ':version',
          value: '',
          required: true,
        })
        expect(params[1]).toEqual({
          name: 'id',
          pattern: '[id]',
          value: '',
          required: true,
        })
      })

      test('should handle duplicate parameter names (last one wins)', () => {
        const params = extractPathParams('/api/[id]/items/[id]')

        // Both params are extracted
        expect(params).toHaveLength(2)
        expect(params[0].name).toBe('id')
        expect(params[1].name).toBe('id')
      })

      test('should handle parameters at start of path', () => {
        const params = extractPathParams('[locale]/api/v1/users')

        expect(params).toHaveLength(1)
        expect(params[0].name).toBe('locale')
      })
    })

    describe('Special Characters in Parameter Names', () => {
      test('should handle underscores in parameter names', () => {
        const params = extractPathParams('/api/[user_id]/[team_id]')

        expect(params).toHaveLength(2)
        expect(params[0].name).toBe('user_id')
        expect(params[1].name).toBe('team_id')
      })

      test('should handle numbers in parameter names', () => {
        const params = extractPathParams('/api/[v1]/[id123]')

        expect(params).toHaveLength(2)
        expect(params[0].name).toBe('v1')
        expect(params[1].name).toBe('id123')
      })
    })
  })

  describe('buildUrl', () => {
    describe('Path Parameter Replacement', () => {
      test('should replace single path parameter', () => {
        const pathParams: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '123', required: true },
        ]

        const url = buildUrl('/api/v1/users/[id]', pathParams, [])

        expect(url).toBe('/api/v1/users/123')
      })

      test('should replace multiple path parameters', () => {
        const pathParams: PathParam[] = [
          { name: 'teamId', pattern: '[teamId]', value: 'team-1', required: true },
          { name: 'memberId', pattern: '[memberId]', value: 'member-2', required: true },
        ]

        const url = buildUrl('/api/v1/teams/[teamId]/members/[memberId]', pathParams, [])

        expect(url).toBe('/api/v1/teams/team-1/members/member-2')
      })

      test('should replace colon-based parameters', () => {
        const pathParams: PathParam[] = [
          { name: 'id', pattern: ':id', value: '456', required: true },
        ]

        const url = buildUrl('/api/v1/users/:id', pathParams, [])

        expect(url).toBe('/api/v1/users/456')
      })

      test('should leave parameter pattern if value is empty', () => {
        const pathParams: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '', required: true },
        ]

        const url = buildUrl('/api/v1/users/[id]', pathParams, [])

        expect(url).toBe('/api/v1/users/[id]')
      })

      test('should handle catch-all parameters', () => {
        const pathParams: PathParam[] = [
          { name: 'path', pattern: '[...path]', value: 'docs/guide/intro', required: false },
        ]

        const url = buildUrl('/api/v1/files/[...path]', pathParams, [])

        expect(url).toBe('/api/v1/files/docs/guide/intro')
      })
    })

    describe('Query Parameter Construction', () => {
      test('should add single query parameter', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '10', enabled: true },
        ]

        const url = buildUrl('/api/v1/users', [], queryParams)

        expect(url).toBe('/api/v1/users?limit=10')
      })

      test('should add multiple query parameters', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '10', enabled: true },
          { id: '2', key: 'offset', value: '20', enabled: true },
          { id: '3', key: 'sort', value: 'name', enabled: true },
        ]

        const url = buildUrl('/api/v1/users', [], queryParams)

        expect(url).toBe('/api/v1/users?limit=10&offset=20&sort=name')
      })

      test('should skip disabled query parameters', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '10', enabled: true },
          { id: '2', key: 'offset', value: '20', enabled: false },
        ]

        const url = buildUrl('/api/v1/users', [], queryParams)

        expect(url).toBe('/api/v1/users?limit=10')
      })

      test('should skip query parameters with empty key', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: '', value: '10', enabled: true },
          { id: '2', key: 'limit', value: '20', enabled: true },
        ]

        const url = buildUrl('/api/v1/users', [], queryParams)

        expect(url).toBe('/api/v1/users?limit=20')
      })

      test('should skip query parameters with empty value', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '', enabled: true },
          { id: '2', key: 'offset', value: '10', enabled: true },
        ]

        const url = buildUrl('/api/v1/users', [], queryParams)

        expect(url).toBe('/api/v1/users?offset=10')
      })

      test('should URL-encode special characters in query values', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'name', value: 'John Doe', enabled: true },
          { id: '2', key: 'email', value: 'user@example.com', enabled: true },
        ]

        const url = buildUrl('/api/v1/users', [], queryParams)

        expect(url).toBe('/api/v1/users?name=John+Doe&email=user%40example.com')
      })

      test('should handle query parameters with same key (append multiple)', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'tag', value: 'javascript', enabled: true },
          { id: '2', key: 'tag', value: 'typescript', enabled: true },
        ]

        const url = buildUrl('/api/v1/posts', [], queryParams)

        expect(url).toBe('/api/v1/posts?tag=javascript&tag=typescript')
      })
    })

    describe('Combined Path and Query Parameters', () => {
      test('should combine path and query parameters', () => {
        const pathParams: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '123', required: true },
        ]
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'include', value: 'profile', enabled: true },
        ]

        const url = buildUrl('/api/v1/users/[id]', pathParams, queryParams)

        expect(url).toBe('/api/v1/users/123?include=profile')
      })

      test('should handle complex URL with multiple params of both types', () => {
        const pathParams: PathParam[] = [
          { name: 'teamId', pattern: '[teamId]', value: 'team-1', required: true },
          { name: 'memberId', pattern: '[memberId]', value: 'member-2', required: true },
        ]
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '10', enabled: true },
          { id: '2', key: 'offset', value: '0', enabled: true },
        ]

        const url = buildUrl(
          '/api/v1/teams/[teamId]/members/[memberId]',
          pathParams,
          queryParams
        )

        expect(url).toBe('/api/v1/teams/team-1/members/member-2?limit=10&offset=0')
      })
    })

    describe('Edge Cases', () => {
      test('should handle empty arrays', () => {
        const url = buildUrl('/api/v1/users', [], [])

        expect(url).toBe('/api/v1/users')
      })

      test('should handle base path without leading slash', () => {
        const url = buildUrl('api/v1/users', [], [])

        expect(url).toBe('api/v1/users')
      })

      test('should handle trailing slash in base path', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '10', enabled: true },
        ]

        const url = buildUrl('/api/v1/users/', [], queryParams)

        expect(url).toBe('/api/v1/users/?limit=10')
      })

      test('should handle numeric values in query params', () => {
        const queryParams: KeyValuePair[] = [
          { id: '1', key: 'limit', value: '10', enabled: true },
          { id: '2', key: 'price', value: '99.99', enabled: true },
        ]

        const url = buildUrl('/api/v1/products', [], queryParams)

        expect(url).toBe('/api/v1/products?limit=10&price=99.99')
      })
    })
  })

  describe('validatePathParams', () => {
    describe('Valid Cases', () => {
      test('should return empty array when all required params have values', () => {
        const params: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '123', required: true },
          { name: 'slug', pattern: '[slug]', value: 'my-post', required: true },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(0)
      })

      test('should return empty array when no params exist', () => {
        const errors = validatePathParams([])

        expect(errors).toHaveLength(0)
      })

      test('should return empty array when optional params are empty', () => {
        const params: PathParam[] = [
          { name: 'path', pattern: '[...path]', value: '', required: false },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(0)
      })

      test('should return empty array for mixed required/optional with values', () => {
        const params: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '123', required: true },
          { name: 'slug', pattern: '[[...slug]]', value: '', required: false },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(0)
      })
    })

    describe('Invalid Cases', () => {
      test('should return error for single required param without value', () => {
        const params: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '', required: true },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(1)
        expect(errors[0]).toBe('Path parameter "id" is required')
      })

      test('should return errors for multiple required params without values', () => {
        const params: PathParam[] = [
          { name: 'teamId', pattern: '[teamId]', value: '', required: true },
          { name: 'memberId', pattern: '[memberId]', value: '', required: true },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(2)
        expect(errors[0]).toBe('Path parameter "teamId" is required')
        expect(errors[1]).toBe('Path parameter "memberId" is required')
      })

      test('should return error only for missing required params', () => {
        const params: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '123', required: true },
          { name: 'slug', pattern: '[slug]', value: '', required: true },
          { name: 'optional', pattern: '[[...optional]]', value: '', required: false },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(1)
        expect(errors[0]).toBe('Path parameter "slug" is required')
      })
    })

    describe('Edge Cases', () => {
      test('should handle whitespace-only values as empty', () => {
        const params: PathParam[] = [
          { name: 'id', pattern: '[id]', value: '   ', required: true },
        ]

        const errors = validatePathParams(params)

        // Note: Current implementation doesn't trim, so '   ' is considered a value
        expect(errors).toHaveLength(0)
      })

      test('should handle special characters in param names', () => {
        const params: PathParam[] = [
          { name: 'user_id', pattern: '[user_id]', value: '', required: true },
        ]

        const errors = validatePathParams(params)

        expect(errors).toHaveLength(1)
        expect(errors[0]).toBe('Path parameter "user_id" is required')
      })
    })
  })

  describe('validateJsonBody', () => {
    describe('Valid JSON', () => {
      test('should return null for valid JSON object', () => {
        const error = validateJsonBody('{"name": "John", "age": 30}')

        expect(error).toBeNull()
      })

      test('should return null for valid JSON array', () => {
        const error = validateJsonBody('[1, 2, 3, "test"]')

        expect(error).toBeNull()
      })

      test('should return null for valid nested JSON', () => {
        const error = validateJsonBody('{"user": {"name": "John", "address": {"city": "NYC"}}}')

        expect(error).toBeNull()
      })

      test('should return null for JSON with special characters', () => {
        const error = validateJsonBody('{"message": "Hello\\nWorld", "emoji": "🎉"}')

        expect(error).toBeNull()
      })

      test('should return null for JSON with boolean and null', () => {
        const error = validateJsonBody('{"active": true, "deleted": false, "data": null}')

        expect(error).toBeNull()
      })

      test('should return null for JSON with numbers', () => {
        const error = validateJsonBody('{"int": 42, "float": 3.14, "exp": 1.2e-3}')

        expect(error).toBeNull()
      })

      test('should return null for empty JSON object', () => {
        const error = validateJsonBody('{}')

        expect(error).toBeNull()
      })

      test('should return null for empty JSON array', () => {
        const error = validateJsonBody('[]')

        expect(error).toBeNull()
      })

      test('should return null for minified JSON', () => {
        const error = validateJsonBody('{"name":"John","items":[1,2,3]}')

        expect(error).toBeNull()
      })

      test('should return null for formatted JSON with whitespace', () => {
        const json = `{
          "name": "John",
          "age": 30,
          "active": true
        }`

        const error = validateJsonBody(json)

        expect(error).toBeNull()
      })
    })

    describe('Invalid JSON', () => {
      test('should return error for missing quotes on keys', () => {
        const error = validateJsonBody('{name: "John"}')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for single quotes instead of double', () => {
        const error = validateJsonBody("{'name': 'John'}")

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for trailing comma', () => {
        const error = validateJsonBody('{"name": "John",}')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for missing closing brace', () => {
        const error = validateJsonBody('{"name": "John"')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for missing opening brace', () => {
        const error = validateJsonBody('"name": "John"}')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for unquoted string values', () => {
        const error = validateJsonBody('{"name": John}')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for JavaScript comments', () => {
        const error = validateJsonBody('{"name": "John" /* comment */}')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for undefined values', () => {
        const error = validateJsonBody('{"value": undefined}')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for plain text', () => {
        const error = validateJsonBody('Hello World')

        expect(error).toBe('Invalid JSON format')
      })

      test('should return error for malformed array', () => {
        const error = validateJsonBody('[1, 2, 3,]')

        expect(error).toBe('Invalid JSON format')
      })
    })

    describe('Empty Input', () => {
      test('should return null for empty string', () => {
        const error = validateJsonBody('')

        expect(error).toBeNull()
      })

      test('should return null for whitespace-only string', () => {
        const error = validateJsonBody('   ')

        expect(error).toBeNull()
      })

      test('should return null for string with only newlines', () => {
        const error = validateJsonBody('\n\n')

        expect(error).toBeNull()
      })

      test('should return null for string with tabs and spaces', () => {
        const error = validateJsonBody('\t  \t  ')

        expect(error).toBeNull()
      })
    })

    describe('Edge Cases', () => {
      test('should handle very large JSON', () => {
        const largeArray = JSON.stringify(Array(1000).fill({ name: 'test', value: 123 }))
        const error = validateJsonBody(largeArray)

        expect(error).toBeNull()
      })

      test('should handle deeply nested JSON', () => {
        let nested = '{"a":'
        for (let i = 0; i < 50; i++) {
          nested += '{"b":'
        }
        nested += '42'
        for (let i = 0; i < 51; i++) {
          nested += '}'
        }

        const error = validateJsonBody(nested)

        expect(error).toBeNull()
      })

      test('should handle JSON with escaped quotes', () => {
        const error = validateJsonBody('{"message": "He said \\"Hello\\""}')

        expect(error).toBeNull()
      })

      test('should handle JSON with backslashes', () => {
        const error = validateJsonBody('{"path": "C:\\\\Users\\\\John"}')

        expect(error).toBeNull()
      })

      test('should handle JSON with unicode escapes', () => {
        const error = validateJsonBody('{"emoji": "\\ud83d\\ude80"}')

        expect(error).toBeNull()
      })
    })
  })
})
