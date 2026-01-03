# Core Utilities

## Overview

The AI plugin provides a set of **core utility functions** that you can import and use in your own custom endpoints. These utilities handle model selection, cost calculation, validation, token extraction, and error handling.

**Philosophy:** Instead of providing rigid, pre-built solutions, the plugin gives you powerful building blocks to create exactly what you need.

## Import Path

```typescript
import {
  selectModel,
  calculateCost,
  validatePlugin,
  extractTokens,
  handleAIError,
  COST_CONFIG
} from '@/contents/plugins/ai/lib/core-utils'
```

## Core Functions

### `selectModel()`

Automatically selects and configures the appropriate AI model and provider.

**Signature:**
```typescript
async function selectModel(
  modelName: string,
  provider?: AIProvider
): Promise<ModelSelection>
```

**Parameters:**
- `modelName` - Model identifier (e.g., `'gpt-4o-mini'`, `'llama3.2:3b'`)
- `provider` (optional) - Force specific provider (`'openai' | 'anthropic' | 'ollama'`)

**Returns:**
```typescript
{
  provider: AIProvider,        // 'openai' | 'anthropic' | 'ollama'
  model: LanguageModel,        // Vercel AI SDK model instance
  modelName: string,           // Original model name
  isLocal: boolean,            // true for Ollama, false for cloud
  costConfig: {
    input: number,             // Cost per 1K input tokens
    output: number             // Cost per 1K output tokens
  }
}
```

**Usage:**
```typescript
// Auto-detect provider from model name
const selection = await selectModel('gpt-4o-mini')
console.log(selection.provider)  // 'openai'
console.log(selection.isLocal)   // false

// Use with Vercel AI SDK
import { generateText } from 'ai'

const result = await generateText({
  model: selection.model,
  prompt: 'Hello world'
})
```

**Provider Auto-Detection:**
```typescript
// OpenAI models (start with 'gpt-')
await selectModel('gpt-4o')         // provider: 'openai'
await selectModel('gpt-4o-mini')    // provider: 'openai'

// Anthropic models (start with 'claude-')
await selectModel('claude-3-5-haiku-20241022')  // provider: 'anthropic'

// Ollama models (everything else)
await selectModel('llama3.2:3b')    // provider: 'ollama'
await selectModel('mistral')        // provider: 'ollama'
```

**Manual Provider Override:**
```typescript
// Force Ollama provider
const selection = await selectModel('custom-model', 'ollama')
```

---

### `calculateCost()`

Calculate the cost of an AI operation based on token usage.

**Signature:**
```typescript
function calculateCost(
  tokens: { input: number; output: number },
  costConfig: { input: number; output: number }
): number
```

**Parameters:**
- `tokens` - Token usage breakdown
  - `input` - Input/prompt tokens
  - `output` - Output/completion tokens
- `costConfig` - Cost per 1K tokens (from `selectModel()` or `COST_CONFIG`)

**Returns:** `number` - Cost in USD (5 decimal precision)

**Usage:**
```typescript
const tokens = { input: 100, output: 200 }
const costConfig = { input: 0.00015, output: 0.0006 }

const cost = calculateCost(tokens, costConfig)
console.log(cost)  // 0.00013
```

**With Model Selection:**
```typescript
const selection = await selectModel('gpt-4o-mini')
const result = await generateText({ model: selection.model, prompt: '...' })

const tokens = extractTokens(result)
const cost = calculateCost(tokens, selection.costConfig)

console.log(`Cost: $${cost.toFixed(5)}`)
```

---

### `validatePlugin()`

Validate that the plugin is properly configured and ready to use.

**Signature:**
```typescript
async function validatePlugin(): Promise<PluginValidation>
```

**Returns:**
```typescript
{
  valid: boolean,
  error?: string  // Present if valid is false
}
```

**Usage:**
```typescript
const validation = await validatePlugin()

if (!validation.valid) {
  return Response.json(
    { error: validation.error },
    { status: 503 }
  )
}

// Plugin is ready, proceed with AI operation
```

**Validation Checks:**
- Plugin is enabled (`AI_PLUGIN_ENABLED=true`)
- At least one provider is configured
- Environment variables are valid

**Example Errors:**
```typescript
{ valid: false, error: 'AI plugin disabled. Set AI_PLUGIN_ENABLED=true' }
{ valid: false, error: 'No AI provider configured' }
{ valid: false, error: 'Plugin configuration invalid: missing OPENAI_API_KEY' }
```

---

### `extractTokens()`

Extract token usage from Vercel AI SDK result.

**Signature:**
```typescript
function extractTokens(result: AIResult): TokenUsage
```

**Parameters:**
- `result` - Result from `generateText()` or similar AI SDK function

**Returns:**
```typescript
{
  input: number,   // Input/prompt tokens
  output: number,  // Output/completion tokens
  total: number    // Total tokens used
}
```

**Usage:**
```typescript
import { generateText } from 'ai'

const result = await generateText({
  model: selectedModel.model,
  prompt: 'Hello'
})

const tokens = extractTokens(result)
console.log(tokens)
// { input: 5, output: 12, total: 17 }
```

**Handles Missing Data:**
```typescript
// If result.usage is undefined, returns zeros
extractTokens({ text: 'response' })
// { input: 0, output: 0, total: 0 }
```

---

### `handleAIError()`

Common error handler that provides user-friendly error messages.

**Signature:**
```typescript
function handleAIError(error: Error): AIErrorResult
```

**Parameters:**
- `error` - Error object from AI operation

**Returns:**
```typescript
{
  error: string,    // Error type
  message: string,  // User-friendly message
  status: number    // HTTP status code
}
```

**Usage:**
```typescript
try {
  const result = await generateText({ ... })
} catch (error) {
  const errorInfo = handleAIError(error as Error)
  return Response.json(
    { error: errorInfo.error, message: errorInfo.message },
    { status: errorInfo.status }
  )
}
```

**Error Detection:**
```typescript
// OpenAI errors
handleAIError(new Error('openai authentication failed'))
// → { error: 'OpenAI authentication failed', 
//     message: 'Check your OPENAI_API_KEY...', 
//     status: 401 }

// Ollama connection errors
handleAIError(new Error('ECONNREFUSED'))
// → { error: 'Ollama connection failed', 
//     message: 'Make sure Ollama is running...', 
//     status: 503 }

// Rate limits
handleAIError(new Error('rate limit exceeded'))
// → { error: 'Rate limit exceeded', 
//     message: 'Try again later', 
//     status: 429 }

// Model not found
handleAIError(new Error('model not found'))
// → { error: 'Model not found', 
//     message: 'Model not available...', 
//     status: 404 }

// Generic errors
handleAIError(new Error('Unknown error'))
// → { error: 'AI generation failed', 
//     message: 'Unknown error', 
//     status: 500 }
```

---

### `COST_CONFIG`

Pre-configured cost data for all supported models.

**Type:**
```typescript
const COST_CONFIG: {
  [modelName: string]: {
    input: number   // Cost per 1K input tokens (USD)
    output: number  // Cost per 1K output tokens (USD)
  }
}
```

**Available Models:**
```typescript
// OpenAI
COST_CONFIG['gpt-4o']          // { input: 0.0025, output: 0.01 }
COST_CONFIG['gpt-4o-mini']     // { input: 0.00015, output: 0.0006 }
COST_CONFIG['gpt-3.5-turbo']   // { input: 0.0005, output: 0.0015 }

// Anthropic
COST_CONFIG['claude-3-5-sonnet-20241022']  // { input: 0.003, output: 0.015 }
COST_CONFIG['claude-3-5-haiku-20241022']   // { input: 0.00025, output: 0.00125 }

// Ollama (all free)
COST_CONFIG['llama3.2:3b']     // { input: 0, output: 0 }
COST_CONFIG['llama3.2']        // { input: 0, output: 0 }
COST_CONFIG['qwen2.5']         // { input: 0, output: 0 }
```

**Usage:**
```typescript
const modelCosts = COST_CONFIG['gpt-4o-mini']
console.log(`Input: $${modelCosts.input}/1K tokens`)
console.log(`Output: $${modelCosts.output}/1K tokens`)
```

## Complete Example: Custom Endpoint

```typescript
// app/api/custom/summarize/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { generateText } from 'ai'
import {
  selectModel,
  calculateCost,
  validatePlugin,
  extractTokens,
  handleAIError
} from '@/contents/plugins/ai/lib/core-utils'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'

export async function POST(request: NextRequest) {
  try {
    // 1. Authenticate
    const authResult = await authenticateRequest(request)
    if (!authResult.success) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }

    // 2. Validate plugin
    const validation = await validatePlugin()
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 503 }
      )
    }

    // 3. Parse request
    const { text, model = 'gpt-4o-mini' } = await request.json()

    // 4. Select model
    const selectedModel = await selectModel(model)

    // 5. Generate summary
    const result = await generateText({
      model: selectedModel.model,
      system: 'You are a concise summarizer. Provide key points only.',
      prompt: `Summarize this text:\n\n${text}`,
      maxOutputTokens: 300
    })

    // 6. Calculate metrics
    const tokens = extractTokens(result)
    const cost = calculateCost(tokens, selectedModel.costConfig)

    // 7. Return response
    return NextResponse.json({
      success: true,
      summary: result.text,
      model: selectedModel.modelName,
      provider: selectedModel.provider,
      cost,
      tokens
    })

  } catch (error) {
    console.error('Summarize error:', error)
    const errorInfo = handleAIError(error as Error)
    return NextResponse.json(
      { error: errorInfo.error, message: errorInfo.message },
      { status: errorInfo.status }
    )
  }
}
```

## TypeScript Types

Import types for full type safety:

```typescript
import type {
  AIProvider,
  ModelSelection,
  AIResult,
  TokenUsage,
  PluginValidation,
  AIErrorResult
} from '@/contents/plugins/ai/types/ai.types'

// Use in function signatures
async function myCustomFunction(
  model: string
): Promise<ModelSelection> {
  return await selectModel(model)
}

function calculateOperationCost(
  result: AIResult,
  costConfig: { input: number; output: number }
): number {
  const tokens: TokenUsage = extractTokens(result)
  return calculateCost(tokens, costConfig)
}
```

## Best Practices

### 1. Always Validate Plugin

```typescript
// ✅ Good: Validate before any AI operation
const validation = await validatePlugin()
if (!validation.valid) {
  return error response
}

// ❌ Bad: Skip validation
const result = await generateText({ ... })  // May fail unexpectedly
```

### 2. Use selectModel() for Consistency

```typescript
// ✅ Good: Use selectModel utility
const selection = await selectModel(modelName)
const result = await generateText({ model: selection.model, ... })

// ❌ Bad: Manually configure providers
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY })
const model = openai('gpt-4o-mini')
```

### 3. Always Calculate Cost

```typescript
// ✅ Good: Track all costs
const tokens = extractTokens(result)
const cost = calculateCost(tokens, selection.costConfig)
await saveToHistory({ cost, tokens })

// ❌ Bad: Ignore costs
const result = await generateText({ ... })
// No cost tracking
```

### 4. Handle Errors Gracefully

```typescript
// ✅ Good: Use handleAIError
try {
  // AI operation
} catch (error) {
  const errorInfo = handleAIError(error as Error)
  return Response.json(
    { error: errorInfo.error, message: errorInfo.message },
    { status: errorInfo.status }
  )
}

// ❌ Bad: Generic error handling
try {
  // AI operation
} catch (error) {
  return Response.json({ error: 'Failed' }, { status: 500 })
}
```

## Next Steps

- **[Custom Endpoints](./02-custom-endpoints.md)** - Build your own AI endpoints
- **[Text Generation](../02-features/01-text-generation.md)** - Use the generate endpoint
- **[AI History](../02-features/03-ai-history.md)** - Track operations
