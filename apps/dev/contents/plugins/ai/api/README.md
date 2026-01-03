# AI Plugin - Generate Endpoint

Simple AI assistant endpoint for general assistance.

## Usage

**Endpoint:** `POST /api/plugin/ai/generate`

**Body:**
```json
{
  "prompt": "Your question or request",
  "model": "llama3.2:3b",
  "maxTokens": 1000,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "success": true,
  "response": "AI response here...",
  "model": "llama3.2:3b",
  "provider": "ollama",
  "isLocal": true,
  "cost": 0,
  "tokens": { "input": 15, "output": 42, "total": 57 },
  "userId": "user_123"
}
```

## Examples

### Basic Chat
```bash
curl -X POST /api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"prompt": "Explain machine learning in simple terms"}'
```

### With Custom Model
```bash
curl -X POST /api/plugin/ai/generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "Write a short poem about coding",
    "model": "claude-3-5-haiku-20241022",
    "maxTokens": 200
  }'
```

## Available Models

- **Local (Free):** llama3.2:3b, llama3.2, llama3.1, qwen2.5, mistral
- **OpenAI:** gpt-4o, gpt-4o-mini, gpt-3.5-turbo
- **Anthropic:** claude-3-5-sonnet-20241022, claude-3-5-haiku-20241022

## Authentication

Requires session authentication or API key with appropriate scope.

## Custom Endpoints

For specialized use cases, copy this endpoint to your `app/api/` directory and modify as needed. See `examples/app-api-examples/` for templates.