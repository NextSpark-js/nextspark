/**
 * Input Sanitization Utilities
 *
 * Protects against prompt injection and malicious input in AI interactions
 */

/**
 * Dangerous patterns that could be used for prompt injection
 * Note: Using 'i' flag only (case-insensitive), not 'g' (global) to avoid lastIndex issues with .test()
 */
const DANGEROUS_PATTERNS = [
  /ignore\s+(all\s+)?(previous|above|prior)\s+(instructions?|commands?|prompts?)/i,
  /forget\s+(everything|all|previous)/i,
  /system\s*:\s*/i,
  /new\s+instructions?\s*:/i,
  /you\s+are\s+now/i,
  /pretend\s+to\s+be/i,
  /jailbreak/i,
  /DAN\s+mode/i,
  /developer\s+mode/i,
  /\[SYSTEM\]/i,
  /\[ADMIN\]/i,
  /\[ROOT\]/i,
  /<\|endoftext\|>/i,
  /<\|im_start\|>/i,
  /<\|im_end\|>/i,
]

/**
 * Suspicious patterns that warrant extra scrutiny
 * Note: Using 'i' flag only for .test(), not 'g' to avoid lastIndex issues
 */
const SUSPICIOUS_PATTERNS = [
  /\{\{.*?\}\}/,    // Template injection patterns
  /\$\{.*?\}/,      // String interpolation
  /<script/i,       // Script tags
  /javascript:/i,   // JavaScript protocol
  /on\w+\s*=/i,     // Event handlers
]

/**
 * Sanitize user input for AI prompts
 */
export function sanitizeUserInput(input: string, options: {
  maxLength?: number
  allowHtml?: boolean
  strict?: boolean
} = {}): string {
  const {
    maxLength = 1000,
    allowHtml = false,
    strict = false
  } = options

  if (!input || typeof input !== 'string') {
    throw new Error('Input must be a non-empty string')
  }

  // 1. Trim whitespace
  let sanitized = input.trim()

  // 2. Enforce length limit
  if (sanitized.length > maxLength) {
    sanitized = sanitized.substring(0, maxLength)
  }

  // 3. Check for dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (pattern.test(sanitized)) {
      throw new Error('Input contains potentially malicious content')
    }
  }

  // 4. In strict mode, check suspicious patterns
  if (strict) {
    for (const pattern of SUSPICIOUS_PATTERNS) {
      if (pattern.test(sanitized)) {
        throw new Error('Input contains suspicious patterns')
      }
    }
  }

  // 5. Remove HTML if not allowed
  if (!allowHtml) {
    sanitized = sanitized.replace(/<[^>]*>/g, '')
  }

  // 6. Convert carriage returns to spaces (CRLF becomes space+newline, then normalized)
  sanitized = sanitized.replace(/\r/g, ' ')

  // 7. Normalize whitespace (preserve newlines for structured content)
  sanitized = sanitized
    .split('\n')
    .map(line => line.replace(/[ \t]+/g, ' ').trim()) // Normalize spaces within lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n') // Max 2 consecutive newlines

  // 8. Remove control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '')

  // 8. Escape special characters that could break prompt structure
  sanitized = sanitized
    .replace(/\\n\\n/g, ' ') // Prevent prompt structure manipulation
    .replace(/\\r/g, '')

  return sanitized
}

/**
 * Validate that input is safe for use in AI prompts
 */
export function validatePromptSafety(input: string): {
  isSafe: boolean
  reason?: string
  sanitized?: string
} {
  try {
    const sanitized = sanitizeUserInput(input, { strict: true })
    return {
      isSafe: true,
      sanitized
    }
  } catch (error) {
    return {
      isSafe: false,
      reason: error instanceof Error ? error.message : 'Unknown validation error'
    }
  }
}

/**
 * Sanitize refinement instructions specifically
 */
export function sanitizeRefinementInstruction(instruction: string): string {
  // Use strict mode for refinement instructions
  return sanitizeUserInput(instruction, {
    maxLength: 500,
    allowHtml: false,
    strict: true
  })
}

/**
 * Sanitize content for AI generation
 */
export function sanitizeContentInput(content: string): string {
  // Less strict for content, but still safe
  return sanitizeUserInput(content, {
    maxLength: 5000,
    allowHtml: false,
    strict: false
  })
}
