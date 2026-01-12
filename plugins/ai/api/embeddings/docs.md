# AI Embeddings API

Generate text embeddings using OpenAI's text-embedding-3-small model.

## Endpoint

```
POST /api/v1/plugin/ai/embeddings
GET  /api/v1/plugin/ai/embeddings
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

## POST - Generate Embedding

Convert text into a vector representation for semantic search, similarity comparison, or machine learning applications.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `text` | string | Yes | Text to convert to embedding (1-50,000 chars) |

### Example Request

```json
{
  "text": "Premium wireless headphones with noise cancellation"
}
```

### Success Response (200)

```json
{
  "success": true,
  "embedding": [0.123, -0.456, 0.789, ...],
  "model": "text-embedding-3-small",
  "dimensions": 1536,
  "tokens": 8,
  "userId": "user_xxx"
}
```

### Response Fields

| Field | Type | Description |
|-------|------|-------------|
| `embedding` | number[] | Vector representation (1536 dimensions) |
| `model` | string | Model used (text-embedding-3-small) |
| `dimensions` | number | Embedding dimensions (always 1536) |
| `tokens` | number | Tokens consumed |
| `userId` | string | Authenticated user ID |

## GET - Endpoint Info

Returns endpoint documentation and usage information.

### Success Response (200)

```json
{
  "endpoint": "/api/v1/plugin/ai/embeddings",
  "description": "Generate text embeddings using OpenAI",
  "usage": { ... },
  "response": { ... },
  "example": { ... },
  "model": {
    "name": "text-embedding-3-small",
    "dimensions": 1536,
    "maxTokens": 8191,
    "cost": "$0.00002 per 1K tokens"
  }
}
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation failed | Invalid or missing text field |
| 401 | Authentication required | Missing or invalid credentials |
| 503 | Plugin not configured | OpenAI API key not set |

### Example Error

```json
{
  "error": "Validation failed",
  "details": [
    {
      "code": "too_small",
      "minimum": 1,
      "path": ["text"],
      "message": "Text cannot be empty"
    }
  ]
}
```

## Setup

Add your OpenAI API key to the plugin's environment file:

```bash
# plugins/ai/.env
OPENAI_API_KEY=sk-...
```

## Use Cases

1. **Semantic Search**: Convert documents and queries to vectors for similarity search
2. **Content Recommendation**: Find similar content based on vector similarity
3. **Clustering**: Group similar texts together
4. **Classification**: Use embeddings as features for ML models

## Model Information

- **Model**: text-embedding-3-small
- **Dimensions**: 1536
- **Max Tokens**: 8,191
- **Cost**: $0.00002 per 1K tokens (5x cheaper than ada-002)

## Related APIs

- [AI Generate](/api/v1/plugin/ai/generate) - Generate AI text responses
- [AI History](/api/v1/plugin/ai/ai-history) - Track AI operations
