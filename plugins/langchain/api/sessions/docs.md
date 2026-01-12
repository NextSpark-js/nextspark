# Sessions API

Manage AI conversation sessions with message history, pinning, and per-user limits.

## Overview

The Sessions API allows you to create, read, update, and delete AI conversation sessions. Sessions store message history for LangChain-powered chatbots and AI assistants. Each user is limited to 50 conversations per team.

## Authentication

All endpoints require authentication via:
- **Session cookie** (for browser-based requests)
- **API Key** header (for server-to-server requests)

**Required Header:**
- `x-team-id` (string): Team context for multi-tenancy

## Endpoints

### List Conversations
`GET /api/langchain/sessions`

Returns all conversations for the current user in the team context.

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessions": [
      {
        "sessionId": "sess_abc123",
        "name": "Project Planning",
        "messageCount": 24,
        "firstMessage": "Help me plan my new project...",
        "isPinned": true,
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-15T14:45:00Z"
      }
    ],
    "count": 12,
    "maxAllowed": 50
  }
}
```

### Get Single Conversation
`GET /api/langchain/sessions?id=[sessionId]`

Returns a specific conversation by ID.

**Query Parameters:**
- `id` (string, required): Session ID

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "name": "Project Planning",
    "messageCount": 24,
    "firstMessage": "Help me plan my new project...",
    "isPinned": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T14:45:00Z"
  }
}
```

### Create Conversation
`POST /api/langchain/sessions`

Create a new conversation session. Limited to 50 conversations per user per team.

**Request Body:**
```json
{
  "name": "My New Conversation"
}
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_xyz789",
    "name": "My New Conversation",
    "createdAt": "2024-01-15T16:00:00Z"
  }
}
```

**Limit Reached Response (400):**
```json
{
  "success": false,
  "error": "CONVERSATION_LIMIT_REACHED",
  "message": "Maximum of 50 conversations reached. Delete an existing conversation to create a new one.",
  "data": {
    "currentCount": 50,
    "maxAllowed": 50,
    "oldestSession": {
      "sessionId": "sess_old123",
      "name": "Old Conversation",
      "updatedAt": "2024-01-01T10:00:00Z"
    }
  }
}
```

### Update Conversation
`PATCH /api/langchain/sessions`

Update a conversation's name or pinned status.

**Request Body:**
```json
{
  "sessionId": "sess_abc123",
  "name": "Renamed Conversation",
  "isPinned": true
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| sessionId | string | Yes | Session ID to update |
| name | string | No | New name for the conversation |
| isPinned | boolean | No | Pin/unpin the conversation |

**Example Response:**
```json
{
  "success": true,
  "data": {
    "sessionId": "sess_abc123",
    "name": "Renamed Conversation",
    "messageCount": 24,
    "firstMessage": "Help me plan my new project...",
    "isPinned": true,
    "createdAt": "2024-01-15T10:30:00Z",
    "updatedAt": "2024-01-15T16:30:00Z"
  }
}
```

### Delete Conversation
`DELETE /api/langchain/sessions`

Delete a conversation and all its message history.

**Request Body:**
```json
{
  "sessionId": "sess_abc123"
}
```

**Example Response:**
```json
{
  "success": true,
  "message": "Conversation deleted successfully",
  "sessionId": "sess_abc123"
}
```

## Fields

| Field | Type | Description |
|-------|------|-------------|
| sessionId | string | Unique session identifier |
| name | string | User-defined conversation name |
| messageCount | number | Number of messages in the conversation |
| firstMessage | string | Preview of the first message |
| isPinned | boolean | Whether the conversation is pinned |
| createdAt | datetime | When the conversation was created |
| updatedAt | datetime | When the conversation was last updated |

## Limits

| Limit | Value | Description |
|-------|-------|-------------|
| MAX_CONVERSATIONS | 50 | Maximum conversations per user per team |

## Error Responses

| Status | Code | Description |
|--------|------|-------------|
| 400 | TEAM_CONTEXT_REQUIRED | Missing x-team-id header |
| 400 | CONVERSATION_LIMIT_REACHED | User has reached 50 conversation limit |
| 400 | - | Session ID is required (for PATCH/DELETE) |
| 401 | Unauthorized | Missing or invalid authentication |
| 404 | - | Conversation not found |
| 500 | - | Internal server error |

## Related APIs

- **[Observability](/api/langchain/observability)** - Monitor AI traces and metrics
- **[Teams](/api/v1/teams)** - Team management
