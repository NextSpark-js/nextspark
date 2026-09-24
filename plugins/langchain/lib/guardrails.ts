/**
 * Guardrails Service
 *
 * Security middleware for AI agents:
 * - Prompt injection detection
 * - PII masking
 * - Content filtering
 */

// Injection detection patterns
const INJECTION_PATTERNS = [
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/i,
    /forget\s+(everything|all|previous)/i,
    /you\s+are\s+now\s+/i,
    /disregard\s+(all|previous|your)\s/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /act\s+as\s+(if|a|an)\s/i,
    /jailbreak/i,
    /bypass\s+(restrictions?|filters?|rules?)/i,
    /system\s*:\s*/i,  // Attempting to inject system prompt
    /\[system\]/i,
    /\<system\>/i,
    /\{\{.*system.*\}\}/i,  // Template injection
]

// PII patterns
const PII_PATTERNS = {
    email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    phone: /\b(\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
    ssn: /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g,
    creditCard: /\b(?:\d{4}[-.\s]?){3}\d{4}\b/g,
    ipAddress: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g,
}

// Content filter patterns (examples - should be customizable)
const CONTENT_FILTER_PATTERNS: RegExp[] = [
    // Add patterns for harmful content
    // These are placeholders - real implementation should be customizable
]

export interface InjectionCheckResult {
    safe: boolean
    reason?: string
    pattern?: string
}

export interface PIIMaskResult {
    masked: string
    mappings: Array<{ original: string; masked: string; type: string }>
    hasPII: boolean
}

export interface ContentFilterResult {
    filtered: string
    blocked: boolean
    reason?: string
}

export interface GuardrailsConfig {
    promptInjection?: {
        enabled: boolean
        action: 'block' | 'warn' | 'log'
        customPatterns?: RegExp[]
    }
    piiMasking?: {
        enabled: boolean
        types: Array<'email' | 'phone' | 'ssn' | 'creditCard' | 'ipAddress'>
        action: 'mask' | 'remove' | 'log'
    }
    contentFilter?: {
        enabled: boolean
        customPatterns?: RegExp[]
        action: 'block' | 'redact'
    }
}

export const guardrails = {
    /**
     * Check input for prompt injection attempts
     */
    checkInjection(
        input: string,
        config?: GuardrailsConfig['promptInjection']
    ): InjectionCheckResult {
        if (!config?.enabled) {
            return { safe: true }
        }

        const patterns = [
            ...INJECTION_PATTERNS,
            ...(config.customPatterns || []),
        ]

        for (const pattern of patterns) {
            if (pattern.test(input)) {
                return {
                    safe: false,
                    reason: 'Potential prompt injection detected',
                    pattern: pattern.toString(),
                }
            }
        }

        return { safe: true }
    },

    /**
     * Mask PII in input text
     */
    maskPII(
        input: string,
        config?: GuardrailsConfig['piiMasking']
    ): PIIMaskResult {
        if (!config?.enabled) {
            return { masked: input, mappings: [], hasPII: false }
        }

        let masked = input
        const mappings: PIIMaskResult['mappings'] = []

        for (const type of config.types) {
            const pattern = PII_PATTERNS[type]
            if (!pattern) continue

            // Reset lastIndex for global patterns
            pattern.lastIndex = 0

            const matches = input.matchAll(new RegExp(pattern))
            for (const match of matches) {
                const original = match[0]
                const maskChar = '*'
                const maskedValue = config.action === 'remove'
                    ? '[REDACTED]'
                    : original.slice(0, 2) + maskChar.repeat(original.length - 4) + original.slice(-2)

                mappings.push({ original, masked: maskedValue, type })
                masked = masked.replace(original, maskedValue)
            }
        }

        return {
            masked,
            mappings,
            hasPII: mappings.length > 0,
        }
    },

    /**
     * Filter content from AI output
     */
    filterContent(
        output: string,
        config?: GuardrailsConfig['contentFilter']
    ): ContentFilterResult {
        if (!config?.enabled) {
            return { filtered: output, blocked: false }
        }

        const patterns = [
            ...CONTENT_FILTER_PATTERNS,
            ...(config.customPatterns || []),
        ]

        for (const pattern of patterns) {
            if (pattern.test(output)) {
                if (config.action === 'block') {
                    return {
                        filtered: '',
                        blocked: true,
                        reason: 'Content blocked by filter',
                    }
                } else {
                    // Redact matching content
                    output = output.replace(pattern, '[FILTERED]')
                }
            }
        }

        return { filtered: output, blocked: false }
    },

    /**
     * Run all guardrails on input
     * Returns processed input or throws if blocked
     */
    async processInput(
        input: string,
        config?: GuardrailsConfig
    ): Promise<{ processed: string; warnings: string[] }> {
        const warnings: string[] = []
        let processed = input

        // Check injection
        if (config?.promptInjection?.enabled) {
            const injectionResult = this.checkInjection(input, config.promptInjection)
            if (!injectionResult.safe) {
                if (config.promptInjection.action === 'block') {
                    throw new Error(`Input blocked: ${injectionResult.reason}`)
                }
                warnings.push(injectionResult.reason || 'Potential injection detected')
            }
        }

        // Mask PII
        if (config?.piiMasking?.enabled) {
            const piiResult = this.maskPII(processed, config.piiMasking)
            processed = piiResult.masked
            if (piiResult.hasPII) {
                warnings.push(`PII detected and masked: ${piiResult.mappings.length} items`)
            }
        }

        return { processed, warnings }
    },

    /**
     * Run content filter on output
     */
    async processOutput(
        output: string,
        config?: GuardrailsConfig
    ): Promise<{ processed: string; blocked: boolean }> {
        if (!config?.contentFilter?.enabled) {
            return { processed: output, blocked: false }
        }

        const result = this.filterContent(output, config.contentFilter)
        return { processed: result.filtered, blocked: result.blocked }
    },
}
