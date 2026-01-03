# Text Generation

## Overview

The **Generate Endpoint** (`/api/plugin/ai/generate`) provides flexible text generation capabilities using any configured AI provider. It's a general-purpose endpoint for creating content, answering questions, analyzing text, and more.

**Key Features:**
- Multi-provider support (OpenAI, Anthropic, Ollama)
- Automatic model selection
- Cost tracking
- Token usage monitoring
- History tracking (optional)
- Error handling
- Flexible parameters

## Endpoint

```
POST /api/plugin/ai/generate
```

**Authentication:** Required (session or API key)

## Request Schema

### Basic Request

```typescript
{
  "prompt": string          // Required: Your text prompt
}
```

### Full Request Options

```typescript
{
  "prompt": string,         // Required: Text prompt (1-10,000 chars)
  "model": string,          // Optional: AI model to use
  "maxTokens": number,      // Optional: Max response length (1-10,000)
  "temperature": number,    // Optional: Creativity (0-1)
  "saveExample": boolean    // Optional: Save to history (default: false)
}
```

### Parameter Details

**prompt** (required)
- Type: `string`
- Min length: 1 character
- Max length: 10,000 characters
- Description: Your instruction or question for the AI

**model** (optional)
- Type: `string`
- Default: From `DEFAULT_MODEL` in `.env`
- Options:
  - **Ollama:** `llama3.2:3b`, `llama3.2`, `llama3.1`, `qwen2.5`, `mistral`
  - **OpenAI:** `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`
  - **Anthropic:** `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`
- Description: AI model to use for generation

**maxTokens** (optional)
- Type: `number`
- Min: 1
- Max: 10,000
- Default: From `MAX_TOKENS` in `.env` (typically 2000)
- Description: Maximum tokens in response (affects cost and length)

**temperature** (optional)
- Type: `number`
- Min: 0 (deterministic, focused)
- Max: 1 (creative, varied)
- Default: From `DEFAULT_TEMPERATURE` in `.env` (typically 0.7)
- Description: Controls response randomness

**saveExample** (optional)
- Type: `boolean`
- Default: `false`
- Description: Save interaction to AI History (opt-in for examples)

## Response Format

### Success Response

```json
{
  "success": true,
  "response": "AI-generated text here...",
  "model": "llama3.2:3b",
  "provider": "ollama",
  "isLocal": true,
  "cost": 0,
  "tokens": {
    "input": 15,
    "output": 42,
    "total": 57
  },
  "userId": "user-id-here",
  "exampleSaved": false
}
```

### Response Fields

**success** - `boolean` - Always `true` on success

**response** - `string` - Generated text from AI

**model** - `string` - Model used for generation

**provider** - `string` - Provider used (`openai`, `anthropic`, `ollama`)

**isLocal** - `boolean` - `true` if using Ollama (local), `false` for cloud

**cost** - `number` - Estimated cost in USD (0 for local models)

**tokens** - `object` - Token usage breakdown
- `input` - Tokens in prompt
- `output` - Tokens in response
- `total` - Total tokens used

**userId** - `string` - ID of authenticated user

**exampleSaved** - `boolean` - Whether interaction was saved to history

### Error Response

```json
{
  "error": "Error type",
  "message": "Detailed error message"
}
```

**HTTP Status Codes:**
- `400` - Bad request (validation failed)
- `401` - Unauthorized (no session/API key)
- `404` - Model not found
- `429` - Rate limit exceeded
- `503` - Service unavailable (provider down, plugin disabled)
- `500` - Internal server error

## Usage Examples

### Example 1: Basic Text Generation

```bash
curl -X POST http://localhost:5173/api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Explain quantum computing in simple terms"
  }'
```

**Response:**
```json
{
  "success": true,
  "response": "Quantum computing is a type of computing that uses quantum-mechanical phenomena...",
  "model": "llama3.2:3b",
  "provider": "ollama",
  "isLocal": true,
  "cost": 0,
  "tokens": {
    "input": 8,
    "output": 156,
    "total": 164
  }
}
```

### Example 2: With Specific Model

```bash
curl -X POST http://localhost:5173/api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Write a professional email requesting a meeting",
    "model": "gpt-4o-mini",
    "maxTokens": 300,
    "temperature": 0.7
  }'
```

### Example 3: Creative Writing

```bash
curl -X POST http://localhost:5173/api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Write a short story about a robot learning to paint",
    "temperature": 0.9,
    "maxTokens": 500
  }'
```

### Example 4: Deterministic Analysis

```bash
curl -X POST http://localhost:5173/api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "List the pros and cons of remote work",
    "temperature": 0.2,
    "maxTokens": 400
  }'
```

### Example 5: Save to History

```bash
curl -X POST http://localhost:5173/api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -H "Cookie: your-session-cookie" \
  -d '{
    "prompt": "Generate a product description for wireless headphones",
    "saveExample": true
  }'
```

## JavaScript/TypeScript Examples

### Using Fetch API

```typescript
async function generateText(prompt: string, model?: string) {
  const response = await fetch('/api/plugin/ai/generate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      prompt,
      model,
      maxTokens: 500,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.message)
  }

  const data = await response.json()
  return data.response
}

// Usage
const text = await generateText('Explain machine learning')
console.log(text)
```

### React Hook

```typescript
import { useState } from 'react'

export function useAIGenerate() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = async (prompt: string, options?: {
    model?: string
    maxTokens?: number
    temperature?: number
  }) => {
    setLoading(true)
    setError(null)

    try {
      const response = await fetch('/api/plugin/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, ...options })
      })

      if (!response.ok) {
        const err = await response.json()
        throw new Error(err.message)
      }

      const data = await response.json()
      return data.response
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error'
      setError(message)
      throw err
    } finally {
      setLoading(false)
    }
  }

  return { generate, loading, error }
}

// Usage in component
function MyComponent() {
  const { generate, loading, error } = useAIGenerate()
  const [result, setResult] = useState('')

  const handleGenerate = async () => {
    try {
      const text = await generate('Write a tagline for a SaaS product')
      setResult(text)
    } catch (err) {
      console.error('Generation failed:', err)
    }
  }

  return (
    <div>
      <button onClick={handleGenerate} disabled={loading}>
        {loading ? 'Generating...' : 'Generate'}
        </button>
      {error && <p>Error: {error}</p>}
      {result && <p>{result}</p>}
    </div>
  )
}
```

## Supported Models

### Ollama (Local, Free)

| Model | Size | Speed | Quality | Use Case |
|-------|------|-------|---------|----------|
| `llama3.2:3b` | 3B | ⚡⚡⚡ | ⭐⭐⭐ | Development, testing |
| `llama3.2` | 11B | ⚡⚡ | ⭐⭐⭐⭐ | General purpose |
| `llama3.1` | 8B/70B | ⚡⚡ | ⭐⭐⭐⭐ | Production quality |
| `qwen2.5` | 7B | ⚡⚡ | ⭐⭐⭐⭐ | Multilingual |
| `mistral` | 7B | ⚡⚡ | ⭐⭐⭐⭐ | European model |

**Setup:** `ollama pull llama3.2:3b`

### OpenAI (Cloud, Paid)

| Model | Context | Speed | Quality | Cost (per 1K tokens) |
|-------|---------|-------|---------|----------------------|
| `gpt-4o` | 128K | ⚡⚡ | ⭐⭐⭐⭐⭐ | $0.0025 in / $0.01 out |
| `gpt-4o-mini` | 128K | ⚡⚡⚡ | ⭐⭐⭐⭐ | $0.00015 in / $0.0006 out |
| `gpt-3.5-turbo` | 16K | ⚡⚡⚡ | ⭐⭐⭐ | $0.0005 in / $0.0015 out |

**Setup:** Set `OPENAI_API_KEY` in `.env`

### Anthropic (Cloud, Paid)

| Model | Context | Speed | Quality | Cost (per 1K tokens) |
|-------|---------|-------|---------|----------------------|
| `claude-3-5-sonnet-20241022` | 200K | ⚡⚡ | ⭐⭐⭐⭐⭐ | $0.003 in / $0.015 out |
| `claude-3-5-haiku-20241022` | 200K | ⚡⚡⚡ | ⭐⭐⭐⭐ | $0.00025 in / $0.00125 out |

**Setup:** Set `ANTHROPIC_API_KEY` in `.env`

## Cost Tracking

The endpoint automatically calculates costs based on token usage:

```json
{
  "cost": 0.00045,  // $0.00045 USD
  "tokens": {
    "input": 100,   // 100 input tokens
    "output": 200   // 200 output tokens
  },
  "model": "gpt-4o-mini"
}
```

**Cost Formula:**
```
cost = (input_tokens / 1000 * input_price) + (output_tokens / 1000 * output_price)
```

**Example (GPT-4o Mini):**
```
Input: 100 tokens × $0.00015 = $0.000015
Output: 200 tokens × $0.0006 = $0.00012
Total: $0.000135
```

## Error Handling

### Common Errors

**1. Authentication Error**
```json
{
  "error": "Authentication required"
}
```
Solution: Include session cookie or API key

**2. Provider Not Configured**
```json
{
  "error": "OpenAI authentication failed",
  "message": "Check your OPENAI_API_KEY in contents/plugins/ai/.env"
}
```
Solution: Add API key to `.env` file

**3. Ollama Connection Failed**
```json
{
  "error": "Ollama connection failed",
  "message": "Make sure Ollama is running (ollama serve)"
}
```
Solution: Start Ollama service

**4. Model Not Found**
```json
{
  "error": "Model not found",
  "message": "The specified model is not available or not installed"
}
```
Solution: For Ollama, run `ollama pull model-name`

**5. Rate Limit**
```json
{
  "error": "Rate limit exceeded",
  "message": "API rate limit reached. Try again later."
}
```
Solution: Wait and retry, or upgrade provider tier

## Best Practices

### 1. Choose Appropriate Model

```typescript
// Development: Use free local models
const devPrompt = {
  prompt: "test",
  model: "llama3.2:3b"
}

// Production: Use quality cloud models for customer-facing features
const prodPrompt = {
  prompt: userInput,
  model: "gpt-4o-mini"  // Or claude-3-5-haiku-20241022
}
```

### 2. Optimize Token Usage

```typescript
// Set appropriate max tokens
{
  prompt: "Write a short tagline",
  maxTokens: 50  // Don't use 2000 for short outputs
}

// Be concise in prompts
{
  prompt: "List 3 benefits of X",  // Clear, specific
  // Not: "Can you please help me understand what the benefits might be..."
}
```

### 3. Use Temperature Wisely

```typescript
// Deterministic tasks (analysis, extraction)
{
  prompt: "Extract key points from this text",
  temperature: 0.2
}

// Creative tasks (writing, brainstorming)
{
  prompt: "Write a creative story",
  temperature: 0.9
}

// Balanced (most use cases)
{
  prompt: "Generate a product description",
  temperature: 0.7
}
```

### 4. Handle Errors Gracefully

```typescript
try {
  const result = await fetch('/api/plugin/ai/generate', {
    method: 'POST',
    body: JSON.stringify({ prompt })
  })
  
  if (!result.ok) {
    const error = await result.json()
    // Show user-friendly message
    showError('AI generation failed. Please try again.')
    // Log for debugging
    console.error('AI Error:', error)
    return
  }
  
  const data = await result.json()
  return data.response
} catch (err) {
  // Network error
  showError('Connection failed. Check your internet.')
}
```

## Next Steps

- **[Embeddings](./02-embeddings.md)** - Generate semantic embeddings
- **[AI History](./03-ai-history.md)** - Track AI operations
- **[API Reference](../03-api-reference/02-generate-endpoint.md)** - Detailed API docs
- **[Custom Endpoints](../04-advanced-usage/02-custom-endpoints.md)** - Build your own