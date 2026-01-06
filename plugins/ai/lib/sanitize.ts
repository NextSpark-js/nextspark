/**
 * Data sanitization utilities for AI examples
 * Removes sensitive information before storing examples
 */

const SENSITIVE_PATTERNS = {
  // Email addresses
  email: /[\w.-]+@[\w.-]+\.\w+/gi,

  // API keys and tokens
  apiKey: /[a-zA-Z0-9]{20,}/g,
  bearerToken: /Bearer\s+[\w-]+\.[\w-]+\.[\w-]+/gi,

  // Common secret patterns
  password: /password['":\s=]+[\w!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/gi,
  secret: /secret['":\s=]+[\w!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/gi,

  // Credit card numbers (basic pattern)
  creditCard: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,

  // Phone numbers (basic pattern)
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,

  // URLs with credentials
  urlWithCredentials: /https?:\/\/[^:]+:[^@]+@[^\s]+/gi,
}

const REPLACEMENTS = {
  email: '[EMAIL_REDACTED]',
  apiKey: '[API_KEY_REDACTED]',
  bearerToken: 'Bearer [TOKEN_REDACTED]',
  password: 'password: [REDACTED]',
  secret: 'secret: [REDACTED]',
  creditCard: '[CARD_REDACTED]',
  phone: '[PHONE_REDACTED]',
  urlWithCredentials: 'https://[CREDENTIALS_REDACTED]',
}

export interface SanitizationResult {
  sanitized: string
  redactedCount: number
  redactedTypes: string[]
}

/**
 * Sanitize text by removing sensitive information
 */
export function sanitizeText(text: string): SanitizationResult {
  if (!text || typeof text !== 'string') {
    return {
      sanitized: text || '',
      redactedCount: 0,
      redactedTypes: []
    }
  }

  let sanitized = text
  let redactedCount = 0
  const redactedTypes: string[] = []

  for (const [type, pattern] of Object.entries(SENSITIVE_PATTERNS)) {
    const matches = sanitized.match(pattern)
    if (matches && matches.length > 0) {
      const replacement = REPLACEMENTS[type as keyof typeof REPLACEMENTS]
      sanitized = sanitized.replace(pattern, replacement)
      redactedCount += matches.length
      redactedTypes.push(type)
    }
  }

  return {
    sanitized,
    redactedCount,
    redactedTypes
  }
}

/**
 * Sanitize prompt before saving as example
 */
export function sanitizePrompt(prompt: string): string {
  return sanitizeText(prompt).sanitized
}

/**
 * Sanitize response before saving as example
 */
export function sanitizeResponse(response: string): string {
  return sanitizeText(response).sanitized
}

/**
 * Check if text contains sensitive information
 */
export function containsSensitiveInfo(text: string): boolean {
  if (!text || typeof text !== 'string') {
    return false
  }

  for (const pattern of Object.values(SENSITIVE_PATTERNS)) {
    if (pattern.test(text)) {
      return true
    }
  }

  return false
}

/**
 * Get sanitization report for a text
 */
export function getSanitizationReport(text: string): {
  hasSensitiveInfo: boolean
  details: SanitizationResult
} {
  const details = sanitizeText(text)

  return {
    hasSensitiveInfo: details.redactedCount > 0,
    details
  }
}