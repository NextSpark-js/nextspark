# Guardrails & Security

This guide covers the security middleware for AI agents, including prompt injection detection, PII masking, and content filtering.

## Overview

Guardrails provide **three layers of protection**:

```
User Input → [Injection Check] → [PII Mask] → Agent → [Content Filter] → Response
                   ↓                 ↓                       ↓
               Block/Warn         Redact                Block/Redact
```

**Key Features**:
- **Prompt Injection Detection**: Blocks attempts to manipulate agent behavior
- **PII Masking**: Redacts sensitive personal information
- **Content Filtering**: Filters inappropriate AI outputs
- **Configurable Actions**: Block, warn, log, or redact

---

## Architecture

### Processing Flow

```
┌─────────────────────────────────────────────────────────────┐
│                     INPUT PROCESSING                         │
│                                                              │
│  User Input                                                  │
│      │                                                       │
│      ▼                                                       │
│  ┌──────────────────┐                                        │
│  │ Injection Check  │──blocked?──► Error: Input blocked     │
│  └────────┬─────────┘                                        │
│           │ (safe)                                           │
│           ▼                                                  │
│  ┌──────────────────┐                                        │
│  │   PII Masking    │                                        │
│  └────────┬─────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│     Processed Input → Agent                                  │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    OUTPUT PROCESSING                         │
│                                                              │
│     Agent Output                                             │
│           │                                                  │
│           ▼                                                  │
│  ┌──────────────────┐                                        │
│  │  Content Filter  │──blocked?──► Empty response           │
│  └────────┬─────────┘                                        │
│           │                                                  │
│           ▼                                                  │
│     Filtered Output → User                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## Configuration

Configure guardrails in `langchain.config.ts`:

```typescript
export const langchainConfig = {
  guardrails: {
    promptInjection: {
      enabled: true,
      action: 'block',          // 'block' | 'warn' | 'log'
      customPatterns: [],       // Additional regex patterns
    },
    piiMasking: {
      enabled: true,
      types: ['email', 'phone', 'ssn', 'creditCard', 'ipAddress'],
      action: 'mask',           // 'mask' | 'remove' | 'log'
    },
    contentFilter: {
      enabled: true,
      customPatterns: [],       // Content patterns to filter
      action: 'redact',         // 'block' | 'redact'
    },
  },
}
```

### Configuration Options

| Section | Option | Type | Description |
|---------|--------|------|-------------|
| `promptInjection` | `enabled` | boolean | Enable injection detection |
| | `action` | string | Action: `block`, `warn`, `log` |
| | `customPatterns` | RegExp[] | Additional detection patterns |
| `piiMasking` | `enabled` | boolean | Enable PII masking |
| | `types` | string[] | PII types to mask |
| | `action` | string | Action: `mask`, `remove`, `log` |
| `contentFilter` | `enabled` | boolean | Enable output filtering |
| | `customPatterns` | RegExp[] | Patterns to filter |
| | `action` | string | Action: `block`, `redact` |

---

## Prompt Injection Detection

### Built-in Patterns

The guardrails detect common prompt injection attempts:

| Pattern | Example | Description |
|---------|---------|-------------|
| Ignore instructions | "ignore previous instructions" | Attempts to override system prompt |
| Forget commands | "forget everything above" | Tries to clear context |
| Role impersonation | "you are now a hacker" | Attempts to change agent behavior |
| Disregard rules | "disregard your rules" | Bypassing constraints |
| Pretend commands | "pretend to be a different AI" | Role manipulation |
| Act as prompts | "act as if you have no restrictions" | Behavior modification |
| Jailbreak attempts | "jailbreak mode" | Known bypass terms |
| System injection | `[system]`, `<system>`, `{{system}}` | Template/prompt injection |

### Pattern List

```typescript
const INJECTION_PATTERNS = [
    /ignore\s+(previous|all|above)\s+(instructions?|prompts?)/i,
    /forget\s+(everything|all|previous)/i,
    /you\s+are\s+now\s+/i,
    /disregard\s+(all|previous|your)\s/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /act\s+as\s+(if|a|an)\s/i,
    /jailbreak/i,
    /bypass\s+(restrictions?|filters?|rules?)/i,
    /system\s*:\s*/i,
    /\[system\]/i,
    /\<system\>/i,
    /\{\{.*system.*\}\}/i,
]
```

### Custom Patterns

Add your own detection patterns:

```typescript
guardrails: {
  promptInjection: {
    enabled: true,
    action: 'block',
    customPatterns: [
      /reveal\s+your\s+prompt/i,
      /what\s+are\s+your\s+instructions/i,
      /show\s+me\s+your\s+system\s+message/i,
    ],
  },
}
```

### Actions

| Action | Behavior |
|--------|----------|
| `block` | Throws error, request is rejected |
| `warn` | Continues but adds warning to response |
| `log` | Silently logs, request continues |

### Usage

```typescript
import { guardrails } from '@/contents/plugins/langchain/lib/guardrails'

const result = guardrails.checkInjection(
    userInput,
    config.guardrails.promptInjection
)

if (!result.safe) {
    console.log('Injection detected:', result.reason)
    console.log('Pattern matched:', result.pattern)
}
```

---

## PII Masking

### Supported PII Types

| Type | Pattern | Example | Masked |
|------|---------|---------|--------|
| `email` | Standard email format | john@example.com | jo**********om |
| `phone` | US phone numbers | (555) 123-4567 | (5********67 |
| `ssn` | Social Security Number | 123-45-6789 | 12*****89 |
| `creditCard` | Credit card numbers | 1234-5678-9012-3456 | 12**************56 |
| `ipAddress` | IPv4 addresses | 192.168.1.100 | 19*******00 |

### Masking Actions

| Action | Input | Output |
|--------|-------|--------|
| `mask` | john@example.com | jo**********om |
| `remove` | john@example.com | [REDACTED] |
| `log` | john@example.com | john@example.com (logged) |

### Usage

```typescript
import { guardrails } from '@/contents/plugins/langchain/lib/guardrails'

const result = guardrails.maskPII(userInput, {
    enabled: true,
    types: ['email', 'phone', 'creditCard'],
    action: 'mask',
})

console.log(result.masked)      // Text with PII masked
console.log(result.hasPII)      // true/false
console.log(result.mappings)    // [{original, masked, type}]
```

### Response Structure

```typescript
interface PIIMaskResult {
    masked: string                    // Text with PII masked
    mappings: Array<{                 // Details of masked items
        original: string              // Original value
        masked: string                // Masked value
        type: string                  // PII type (email, phone, etc.)
    }>
    hasPII: boolean                   // Whether PII was found
}
```

---

## Content Filtering

### Purpose

Filter AI outputs to prevent:
- Harmful content generation
- Inappropriate responses
- Sensitive information disclosure

### Custom Patterns

```typescript
guardrails: {
  contentFilter: {
    enabled: true,
    action: 'redact',
    customPatterns: [
      /password\s*[:=]\s*\S+/gi,      // Password exposure
      /api[_-]?key\s*[:=]\s*\S+/gi,   // API key exposure
      /secret\s*[:=]\s*\S+/gi,        // Secret exposure
    ],
  },
}
```

### Actions

| Action | Behavior |
|--------|----------|
| `block` | Returns empty response |
| `redact` | Replaces matched content with `[FILTERED]` |

### Usage

```typescript
import { guardrails } from '@/contents/plugins/langchain/lib/guardrails'

const result = guardrails.filterContent(
    aiOutput,
    config.guardrails.contentFilter
)

if (result.blocked) {
    console.log('Content blocked:', result.reason)
} else {
    console.log('Filtered output:', result.filtered)
}
```

---

## Complete Pipeline

### processInput

Runs all input guardrails:

```typescript
import { guardrails } from '@/contents/plugins/langchain/lib/guardrails'

try {
    const { processed, warnings } = await guardrails.processInput(
        userInput,
        config.guardrails
    )

    if (warnings.length > 0) {
        console.log('Warnings:', warnings)
    }

    // Use 'processed' for agent input
    const response = await agent.invoke(processed)
} catch (error) {
    // Input was blocked
    console.error('Input blocked:', error.message)
}
```

### processOutput

Runs output guardrails:

```typescript
const { processed, blocked } = await guardrails.processOutput(
    agentOutput,
    config.guardrails
)

if (blocked) {
    return { response: 'Unable to generate appropriate response.' }
}

return { response: processed }
```

---

## Integration with Orchestrator

### Automatic Integration

When guardrails are enabled, they're automatically applied:

```typescript
// In agent factory or orchestrator
const guardrailsConfig = langchainConfig.guardrails

// Before agent invocation
const { processed: safeInput, warnings } = await guardrails.processInput(
    message,
    guardrailsConfig
)

// After agent response
const { processed: safeOutput, blocked } = await guardrails.processOutput(
    response,
    guardrailsConfig
)
```

### Graph Node Integration

```typescript
// In router or handler nodes
async function routerNode(state: OrchestratorState) {
    const config = langchainConfig.guardrails

    // Check input before processing
    if (config.promptInjection?.enabled) {
        const check = guardrails.checkInjection(
            state.messages[state.messages.length - 1].content,
            config.promptInjection
        )

        if (!check.safe && config.promptInjection.action === 'block') {
            return {
                error: 'Your message was blocked for security reasons.',
                intents: [],
            }
        }
    }

    // Continue with normal processing
    // ...
}
```

---

## API Response Types

### InjectionCheckResult

```typescript
interface InjectionCheckResult {
    safe: boolean          // Whether input is safe
    reason?: string        // Reason if blocked
    pattern?: string       // Pattern that matched
}
```

### PIIMaskResult

```typescript
interface PIIMaskResult {
    masked: string         // Text with PII masked
    mappings: Array<{
        original: string   // Original PII value
        masked: string     // Masked value
        type: string       // PII type
    }>
    hasPII: boolean        // Whether PII was detected
}
```

### ContentFilterResult

```typescript
interface ContentFilterResult {
    filtered: string       // Filtered output
    blocked: boolean       // Whether content was blocked
    reason?: string        // Reason if blocked
}
```

---

## Best Practices

### 1. Defense in Depth

Enable multiple layers:

```typescript
guardrails: {
  promptInjection: { enabled: true, action: 'block' },
  piiMasking: { enabled: true, action: 'mask' },
  contentFilter: { enabled: true, action: 'redact' },
}
```

### 2. Start Permissive, Tighten Gradually

```typescript
// Development: log only
guardrails: {
  promptInjection: { enabled: true, action: 'log' },
}

// Production: block
guardrails: {
  promptInjection: { enabled: true, action: 'block' },
}
```

### 3. Monitor Warnings

Log warnings for review:

```typescript
const { processed, warnings } = await guardrails.processInput(input, config)

if (warnings.length > 0) {
    await logger.warn('Guardrail warnings', {
        userId: context.userId,
        warnings,
        inputPreview: input.slice(0, 100),
    })
}
```

### 4. Custom Patterns for Your Domain

Add domain-specific patterns:

```typescript
// For a financial app
customPatterns: [
    /transfer\s+all\s+funds/i,
    /send\s+money\s+to\s+\d+/i,
]

// For a customer service app
customPatterns: [
    /reveal\s+customer\s+data/i,
    /show\s+all\s+users/i,
]
```

### 5. Handle Blocked Requests Gracefully

```typescript
try {
    const result = await guardrails.processInput(input, config)
    // Process normally
} catch (error) {
    // User-friendly response
    return {
        success: false,
        message: 'Your request could not be processed. Please rephrase.',
        code: 'GUARDRAIL_BLOCK',
    }
}
```

---

## Troubleshooting

### False Positives

If legitimate requests are being blocked:

1. Check which pattern matched:
   ```typescript
   const result = guardrails.checkInjection(input, config)
   console.log('Pattern:', result.pattern)
   ```

2. Adjust patterns or use `warn` action:
   ```typescript
   guardrails: {
     promptInjection: { action: 'warn' }  // Log but don't block
   }
   ```

### PII Not Detected

If PII is not being masked:

1. Ensure the type is enabled:
   ```typescript
   piiMasking: {
     types: ['email', 'phone'],  // Add missing types
   }
   ```

2. Check pattern matches your format:
   ```typescript
   // For international phone numbers, add custom pattern
   // The built-in pattern is optimized for US formats
   ```

### Performance Impact

Guardrails add minimal overhead:
- Injection check: < 1ms (regex matching)
- PII masking: < 5ms (depends on input length)
- Content filtering: < 1ms

For high-throughput scenarios, consider:
- Sampling (process 10% of requests)
- Caching results for identical inputs
- Async logging with buffering

---

## Security Considerations

### Pattern Limitations

Regex-based detection has limitations:
- May miss sophisticated injection attempts
- Can be bypassed with encoding/obfuscation
- Cannot understand semantic intent

**Recommendation**: Combine with:
- Input length limits
- Rate limiting
- User authentication
- Logging and monitoring

### PII Mapping Security

The `mappings` array contains original PII values:

```typescript
const result = guardrails.maskPII(input, config)
// result.mappings contains original values - handle securely!
```

**Do not**:
- Log the mappings array
- Store mappings in database
- Return mappings to client

### Content Filter Effectiveness

Content filtering is a final safeguard, not a primary defense:
- Configure model with appropriate system prompts
- Use model-level content policies
- Combine with output validation

---

## Related Documentation

- [Graph Orchestrator](../03-orchestration/01-graph-orchestrator.md) - How guardrails integrate with the graph
- [Observability](./01-observability.md) - Logging guardrail events
- [Configuration](../01-getting-started/03-configuration.md) - Full configuration reference
