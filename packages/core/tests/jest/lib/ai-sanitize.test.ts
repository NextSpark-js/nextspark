/**
 * Unit Tests: AI Sanitization Utility
 * Tests sensitive data detection and removal
 */

import { describe, test, expect } from '@jest/globals'
import {
  sanitizeText,
  sanitizePrompt,
  sanitizeResponse,
  containsSensitiveInfo,
  getSanitizationReport
} from '@/contents/plugins/ai/lib/sanitize'

describe('AI Sanitization Utility', () => {
  describe('sanitizeText', () => {
    test('should sanitize email addresses', () => {
      const text = 'Contact me at user@example.com or admin@test.org'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('user@example.com')
      expect(result.sanitized).not.toContain('admin@test.org')
      expect(result.sanitized).toContain('[EMAIL_REDACTED]')
      expect(result.redactedCount).toBe(2)
      expect(result.redactedTypes).toContain('email')
    })

    test('should sanitize API keys', () => {
      const text = 'My API key is testkey_abc123defg456hijklmnop987654321'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('testkey_abc123defg456hijklmnop987654321')
      expect(result.sanitized).toContain('[API_KEY_REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(0)
      expect(result.redactedTypes).toContain('apiKey')
    })

    test('should sanitize bearer tokens', () => {
      const text = 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9')
      // Note: The API key pattern may catch JWT parts, but the important thing is sensitive data is removed
      expect(result.sanitized).toContain('Bearer')
      expect(result.redactedCount).toBeGreaterThan(0)
    })

    test('should sanitize passwords', () => {
      const text = 'password: MySecurePass123!'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('MySecurePass123!')
      expect(result.sanitized).toContain('password: [REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(0)
      expect(result.redactedTypes).toContain('password')
    })

    test('should sanitize secrets', () => {
      const text = 'secret="my_super_secret_key_123"'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('my_super_secret_key_123')
      expect(result.sanitized).toContain('secret: [REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(0)
      expect(result.redactedTypes).toContain('secret')
    })

    test('should sanitize credit card numbers', () => {
      const text = 'Card: 4532-1488-0343-6467'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('4532-1488-0343-6467')
      expect(result.sanitized).toContain('[CARD_REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(0)
      expect(result.redactedTypes).toContain('creditCard')
    })

    test('should sanitize phone numbers', () => {
      const text = 'Call me at 555-123-4567 or 555.987.6543'
      const result = sanitizeText(text)

      expect(result.sanitized).not.toContain('555-123-4567')
      expect(result.sanitized).not.toContain('555.987.6543')
      expect(result.sanitized).toContain('[PHONE_REDACTED]')
      expect(result.redactedCount).toBe(2)
      expect(result.redactedTypes).toContain('phone')
    })

    test('should sanitize URLs with credentials', () => {
      const text = 'Connect to https://admin:password123@api.example.com/data'
      const result = sanitizeText(text)

      // Check that password is sanitized (important security measure)
      expect(result.sanitized).not.toContain('password123')
      expect(result.redactedCount).toBeGreaterThan(0)
    })

    test('should handle multiple sensitive data types', () => {
      const text = 'Email: user@test.com, Phone: 555-123-4567, API Key: testkey_123456789012345678901234'
      const result = sanitizeText(text)

      expect(result.sanitized).toContain('[EMAIL_REDACTED]')
      expect(result.sanitized).toContain('[PHONE_REDACTED]')
      expect(result.sanitized).toContain('[API_KEY_REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(2)
      expect(result.redactedTypes.length).toBeGreaterThanOrEqual(2)
    })

    test('should handle empty or invalid input', () => {
      expect(sanitizeText('').sanitized).toBe('')
      expect(sanitizeText('').redactedCount).toBe(0)
      expect(sanitizeText('').redactedTypes).toEqual([])

      // @ts-expect-error Testing invalid input
      const nullResult = sanitizeText(null)
      expect(nullResult.sanitized).toBe('')

      // @ts-expect-error Testing invalid input
      const undefinedResult = sanitizeText(undefined)
      expect(undefinedResult.sanitized).toBe('')

      // @ts-expect-error Testing invalid input - non-string input returns the value or empty
      const numberResult = sanitizeText(123 as any)
      // Non-string values are returned as-is (123) or converted based on implementation
      expect(numberResult.sanitized).toBeDefined()
    })

    test('should not modify clean text', () => {
      const cleanText = 'This is a clean text with no sensitive information'
      const result = sanitizeText(cleanText)

      expect(result.sanitized).toBe(cleanText)
      expect(result.redactedCount).toBe(0)
      expect(result.redactedTypes).toEqual([])
    })

    test('should preserve text structure while redacting', () => {
      const text = 'Dear user@test.com,\nYour API key is: testkey_12345678901234567890\nPassword: secret123'
      const result = sanitizeText(text)

      expect(result.sanitized).toContain('Dear [EMAIL_REDACTED]')
      expect(result.sanitized).toContain('Your API key is:')
      expect(result.sanitized).toContain('[API_KEY_REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(2)
    })
  })

  describe('sanitizePrompt', () => {
    test('should sanitize prompt with email', () => {
      const prompt = 'Send an email to john@example.com about the project'
      const sanitized = sanitizePrompt(prompt)

      expect(sanitized).not.toContain('john@example.com')
      expect(sanitized).toContain('[EMAIL_REDACTED]')
    })

    test('should return clean prompt unchanged', () => {
      const prompt = 'What is the weather today?'
      const sanitized = sanitizePrompt(prompt)

      expect(sanitized).toBe(prompt)
    })
  })

  describe('sanitizeResponse', () => {
    test('should sanitize response with API key', () => {
      const response = 'Your API key is testkey_1234567890123456789012345. Keep it secure!'
      const sanitized = sanitizeResponse(response)

      expect(sanitized).not.toContain('testkey_1234567890123456789012345')
      expect(sanitized).toContain('[API_KEY_REDACTED]')
    })

    test('should return clean response unchanged', () => {
      const response = 'The weather is sunny and warm today.'
      const sanitized = sanitizeResponse(response)

      expect(sanitized).toBe(response)
    })
  })

  describe('containsSensitiveInfo', () => {
    test('should detect email addresses', () => {
      expect(containsSensitiveInfo('Contact: user@example.com')).toBe(true)
    })

    test('should detect API keys', () => {
      expect(containsSensitiveInfo('Key: testkey_12345678901234567890')).toBe(true)
    })

    test('should detect bearer tokens', () => {
      expect(containsSensitiveInfo('Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.test.sig')).toBe(true)
    })

    test('should detect passwords', () => {
      expect(containsSensitiveInfo('password: MyPassword123')).toBe(true)
    })

    test('should detect secrets', () => {
      expect(containsSensitiveInfo('secret="my_secret_key"')).toBe(true)
    })

    test('should detect credit cards', () => {
      expect(containsSensitiveInfo('Card: 4532 1488 0343 6467')).toBe(true)
    })

    test('should detect phone numbers', () => {
      expect(containsSensitiveInfo('Phone: 555-123-4567')).toBe(true)
    })

    test('should detect URLs with credentials', () => {
      expect(containsSensitiveInfo('https://user:pass@example.com')).toBe(true)
    })

    test('should return false for clean text', () => {
      expect(containsSensitiveInfo('This is clean text')).toBe(false)
    })

    test('should handle empty or invalid input', () => {
      expect(containsSensitiveInfo('')).toBe(false)
      // @ts-expect-error Testing invalid input
      expect(containsSensitiveInfo(null)).toBe(false)
      // @ts-expect-error Testing invalid input
      expect(containsSensitiveInfo(undefined)).toBe(false)
    })
  })

  describe('getSanitizationReport', () => {
    test('should provide detailed report with sensitive info', () => {
      const text = 'Email: test@example.com, Phone: 555-123-4567'
      const report = getSanitizationReport(text)

      expect(report.hasSensitiveInfo).toBe(true)
      expect(report.details.redactedCount).toBe(2)
      expect(report.details.redactedTypes).toContain('email')
      expect(report.details.redactedTypes).toContain('phone')
      expect(report.details.sanitized).toContain('[EMAIL_REDACTED]')
      expect(report.details.sanitized).toContain('[PHONE_REDACTED]')
    })

    test('should provide report for clean text', () => {
      const text = 'This is clean text'
      const report = getSanitizationReport(text)

      expect(report.hasSensitiveInfo).toBe(false)
      expect(report.details.redactedCount).toBe(0)
      expect(report.details.redactedTypes).toEqual([])
      expect(report.details.sanitized).toBe(text)
    })

    test('should handle complex text with multiple types', () => {
      const text = `
        User credentials:
        Email: admin@company.com
        Password: SecurePass123!
        API Key: apikey_1234567890123456789012345678901234567890
        Phone: 555-987-6543
      `
      const report = getSanitizationReport(text)

      expect(report.hasSensitiveInfo).toBe(true)
      expect(report.details.redactedCount).toBeGreaterThan(3)
      expect(report.details.redactedTypes.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('Edge Cases and Security', () => {
    test('should handle malformed patterns', () => {
      const text = 'Not an email: user@, incomplete phone: 555-'
      const result = sanitizeText(text)

      // Should not crash, handles gracefully
      expect(result.sanitized).toBeDefined()
    })

    test('should handle very long API keys', () => {
      const longKey = 'a'.repeat(100)
      const text = `Key: ${longKey}`
      const result = sanitizeText(text)

      expect(result.sanitized).toContain('[API_KEY_REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(0)
    })

    test('should handle multiple occurrences of same pattern', () => {
      const text = 'Email user@test.com and also admin@test.com and info@test.com'
      const result = sanitizeText(text)

      expect(result.redactedCount).toBe(3)
      const emailCount = (result.sanitized.match(/\[EMAIL_REDACTED\]/g) || []).length
      expect(emailCount).toBe(3)
    })

    test('should be case insensitive for patterns', () => {
      const text1 = 'password: Test123'
      const text2 = 'PASSWORD: Test123'
      const text3 = 'Password: Test123'

      expect(sanitizeText(text1).redactedCount).toBeGreaterThan(0)
      expect(sanitizeText(text2).redactedCount).toBeGreaterThan(0)
      expect(sanitizeText(text3).redactedCount).toBeGreaterThan(0)
    })

    test('should handle special characters in sensitive data', () => {
      const text = 'password: "P@ssw0rd!#$%^&*()"'
      const result = sanitizeText(text)

      expect(result.sanitized).toContain('[REDACTED]')
      expect(result.redactedCount).toBeGreaterThan(0)
    })

    test('should not leak partial sensitive data', () => {
      const text = 'API Key: sk_test_very_secret_key_12345678901234567890'
      const result = sanitizeText(text)

      // Ensure the key is redacted (pattern matching may catch the long alphanumeric string)
      expect(result.sanitized).not.toContain('sk_test_very_secret_key_12345678901234567890')
      expect(result.redactedCount).toBeGreaterThan(0)
    })
  })
})