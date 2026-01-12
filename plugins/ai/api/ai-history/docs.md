# AI History API

Manage AI operation history and link AI interactions to entities.

## Endpoint

```
PATCH /api/v1/plugin/ai/ai-history/:id
```

## Authentication

Requires session authentication.

**Headers:**
```
Authorization: Bearer <session-token>
```

## PATCH - Link AI History to Entity

Update the related entity information for an AI history record. Used to link AI operations (e.g., analysis results) to entities created afterward.

### Path Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | AI history record ID |

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `relatedEntityType` | string | Yes | Entity type (e.g., "clients", "projects") |
| `relatedEntityId` | string | Yes | Entity ID to link |

### Example Request

```
PATCH /api/v1/plugin/ai/ai-history/hist_abc123
```

```json
{
  "relatedEntityType": "clients",
  "relatedEntityId": "client_xyz789"
}
```

### Success Response (200)

```json
{
  "success": true,
  "message": "AI history record linked to entity successfully",
  "data": {
    "historyId": "hist_abc123",
    "relatedEntityType": "clients",
    "relatedEntityId": "client_xyz789"
  }
}
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Missing history ID | No ID provided in URL |
| 400 | Missing required fields | relatedEntityType or relatedEntityId missing |
| 401 | Unauthorized | Not authenticated |
| 403 | Forbidden | Record belongs to another user |
| 404 | Not found | AI history record doesn't exist |
| 500 | Internal server error | Database or server error |

### Example Error (403)

```json
{
  "error": "Forbidden - this record belongs to another user"
}
```

### Example Error (400)

```json
{
  "error": "Missing required fields",
  "details": "Both relatedEntityType and relatedEntityId are required"
}
```

## Use Cases

1. **Brief Analysis Linking**: After analyzing a client brief with AI, link the analysis to the client record created from it
2. **Content Generation Tracking**: Link generated content to the project or campaign it was created for
3. **Audit Trail**: Maintain a complete audit trail of AI operations and their resulting entities

## Workflow Example

```typescript
// 1. Generate AI analysis
const analysis = await fetch('/api/v1/plugin/ai/generate', {
  method: 'POST',
  body: JSON.stringify({
    prompt: 'Analyze this client brief...',
    saveExample: true
  })
})

// 2. Create entity from analysis
const client = await fetch('/api/v1/clients', {
  method: 'POST',
  body: JSON.stringify({ name: 'New Client', ... })
})

// 3. Link AI history to created entity
await fetch(`/api/v1/plugin/ai/ai-history/${analysis.historyId}`, {
  method: 'PATCH',
  body: JSON.stringify({
    relatedEntityType: 'clients',
    relatedEntityId: client.id
  })
})
```

## Security

- Users can only update their own AI history records
- Record ownership is verified before any modification
- All operations are logged for audit purposes

## Related APIs

- [AI Generate](/api/v1/plugin/ai/generate) - Generate AI responses
- [AI Embeddings](/api/v1/plugin/ai/embeddings) - Generate text embeddings
