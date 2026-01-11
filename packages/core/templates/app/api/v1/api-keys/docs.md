# API Keys API

Manage API keys for programmatic access to your team's resources.

## Overview

The API Keys API allows you to create, list, and revoke API keys. API keys provide server-to-server authentication and are scoped to a specific team.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)

Note: API key management requires session authentication for security.

## Endpoints

### List API Keys
`GET /api/v1/api-keys`

Returns all API keys for the current team.

**Example Response:**
```json
{
  "data": [
    {
      "id": "key_123",
      "name": "Production API Key",
      "prefix": "nsk_prod_",
      "lastUsedAt": "2024-01-20T15:30:00Z",
      "createdAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Create API Key
`POST /api/v1/api-keys`

Create a new API key. The full key is only returned once on creation.

**Request Body:**
```json
{
  "name": "My API Key"
}
```

**Response:**
```json
{
  "id": "key_456",
  "name": "My API Key",
  "key": "nsk_prod_abc123xyz...",
  "prefix": "nsk_prod_",
  "createdAt": "2024-01-21T10:30:00Z"
}
```

**Important:** Save the full `key` value immediately - it cannot be retrieved again.

### Delete API Key
`DELETE /api/v1/api-keys/[id]`

Revoke an API key. This action is immediate and irreversible.

**Path Parameters:**
- `id` (string, required): API Key ID

## Using API Keys

Include the API key in the `x-api-key` header:

```bash
curl -H "x-api-key: nsk_prod_abc123xyz..." \
     https://api.example.com/api/v1/customers
```

## Security Best Practices

- Store API keys securely (environment variables, secrets manager)
- Rotate keys periodically
- Use different keys for different environments
- Revoke keys immediately if compromised

## Error Responses

| Status | Description |
|--------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Session required |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - API key doesn't exist |
