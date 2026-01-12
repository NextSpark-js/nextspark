# AI Generate API

Simple AI assistant endpoint for generating text responses using multiple providers (OpenAI, Anthropic, Ollama).

## Endpoint

```
POST /api/v1/plugin/ai/generate
GET  /api/v1/plugin/ai/generate
```

## Authentication

Requires dual authentication (session or API key).

**Headers:**
```
Authorization: Bearer <session-token>
# OR
x-api-key: <api-key>
x-team-id: <team-id>
```

## POST - Generate AI Response

Generate an AI response to a prompt using the configured model.

### Request Body

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `prompt` | string | Yes | - | Your question or request (1-10,000 chars) |
| `model` | string | No | Config default | AI model to use |
| `maxTokens` | number | No | Config default | Max response length (1-10,000) |
| `temperature` | number | No | Config default | Response creativity (0-1) |
| `saveExample` | boolean | No | false | Save interaction as example |

### Available Models

**Local (Ollama):**
- `llama3.2:3b`, `llama3.2`, `llama3.1`
- `qwen2.5`, `mistral`

**OpenAI:**
- `gpt-4o`, `gpt-4o-mini`, `gpt-3.5-turbo`

**Anthropic:**
- `claude-3-5-sonnet-20241022`, `claude-3-5-haiku-20241022`

### Example Request

```json
{
  "prompt": "Explain quantum computing in simple terms",
  "model": "gpt-4o-mini",
  "maxTokens": 500,
  "temperature": 0.7
}
```

### Success Response (200)

```json
{
  "success": true,
  "response": "Quantum computing is...",
  "model": "gpt-4o-mini",
  "provider": "openai",
  "isLocal": false,
  "cost": 0.00015,
  "tokens": {
    "prompt": 12,
    "completion": 150,
    "total": 162
  },
  "userId": "user_xxx",
  "exampleSaved": false
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `response` | string | AI-generated text response |
| `model` | string | Model used for generation |
| `provider` | string | Provider (openai, anthropic, ollama) |
| `isLocal` | boolean | Whether using local model |
| `cost` | number | Estimated cost in USD |
| `tokens` | object | Token usage breakdown |
| `exampleSaved` | boolean | Whether interaction was saved |

## GET - Endpoint Info

Returns endpoint documentation with available models and setup instructions.

### Success Response (200)

```json
{
  "endpoint": "/api/plugin/ai/generate",
  "description": "Simple AI assistant endpoint",
  "usage": { ... },
  "example": { ... },
  "models": {
    "local": ["llama3.2:3b", "llama3.2", ...],
    "openai": ["gpt-4o", "gpt-4o-mini", ...],
    "anthropic": ["claude-3-5-sonnet-20241022", ...]
  },
  "setup": { ... }
}
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation failed | Invalid request parameters |
| 401 | Authentication required | Missing or invalid credentials |
| 503 | Plugin not configured | API keys not set |

## Setup

Configure API keys in the plugin's environment file:

```bash
# plugins/ai/.env

# For OpenAI models
OPENAI_API_KEY=sk-...

# For Anthropic models
ANTHROPIC_API_KEY=sk-ant-...

# For local models (Ollama)
# Run: ollama serve && ollama pull llama3.2
```

## Use Cases

1. **Content Generation**: Generate blog posts, descriptions, summaries
2. **Code Assistance**: Generate code snippets, explain code
3. **Customer Support**: Automated responses, FAQ handling
4. **Analysis**: Analyze text, extract insights

## Cost Configuration

The plugin tracks costs based on model pricing:
- OpenAI GPT-4o: ~$0.01/1K tokens
- OpenAI GPT-4o-mini: ~$0.00015/1K tokens
- Anthropic Claude: ~$0.003/1K tokens
- Local Ollama: Free

## Related APIs

- [AI Embeddings](/api/v1/plugin/ai/embeddings) - Generate text embeddings
- [AI History](/api/v1/plugin/ai/ai-history) - Track AI operations
