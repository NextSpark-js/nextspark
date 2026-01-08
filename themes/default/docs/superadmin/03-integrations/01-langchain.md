---
title: Langchain Integration
description: Configure and manage the AI-powered Langchain plugin for your application.
---

# Langchain Integration

The Langchain plugin provides AI-powered capabilities to your application, including conversational agents, document processing, and intelligent automation.

## Overview

Langchain is integrated as a plugin that can be enabled per-theme. It provides:

- **Conversational AI**: Build chat interfaces with context-aware responses
- **Memory Management**: Persistent conversation history with PostgreSQL storage
- **Tool Integration**: Connect AI to your application's data and actions
- **Streaming Responses**: Real-time AI responses for better UX

## Configuration

### Environment Variables

Add the following to your `.env` file:

```bash
# OpenAI API Key (required)
OPENAI_API_KEY=sk-your-api-key-here

# Optional: Model configuration
LANGCHAIN_MODEL=gpt-4o-mini
LANGCHAIN_TEMPERATURE=0.7
LANGCHAIN_MAX_TOKENS=2000
```

### Plugin Activation

Enable the plugin in your theme configuration:

```typescript
// themes/{theme}/config/theme.config.ts
export const themeConfig = {
  plugins: ['langchain'],
  // ...
}
```

## Database Setup

The plugin requires a memory table for conversation persistence. Run the migration:

```bash
pnpm db:migrate
```

This creates the `langchain_memory` table with the following schema:

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| sessionId | varchar | Conversation session identifier |
| messages | jsonb | Array of message objects |
| metadata | jsonb | Additional context data |
| createdAt | timestamp | Creation timestamp |
| updatedAt | timestamp | Last update timestamp |

## Usage

### Basic Chat Endpoint

The plugin exposes an API endpoint for chat interactions:

```typescript
// POST /api/v1/ai/chat
{
  "message": "Hello, how can you help me?",
  "sessionId": "user-123-session-456"
}
```

Response:

```typescript
{
  "success": true,
  "data": {
    "response": "Hello! I'm here to help you with...",
    "sessionId": "user-123-session-456"
  }
}
```

### Streaming Responses

For real-time streaming:

```typescript
// POST /api/v1/ai/chat/stream
{
  "message": "Explain quantum computing",
  "sessionId": "user-123-session-456",
  "stream": true
}
```

## Security Considerations

- **API Key Protection**: Never expose your OpenAI API key in client-side code
- **Rate Limiting**: Consider implementing rate limits per user/team
- **Content Filtering**: The plugin includes basic content moderation
- **Session Isolation**: Conversations are isolated by sessionId

## Monitoring

View AI usage statistics in the Superadmin dashboard:

1. Navigate to **Superadmin > Analytics** (coming soon)
2. Select the **AI Usage** tab
3. Monitor token usage, response times, and error rates

## Troubleshooting

### Common Issues

**"OPENAI_API_KEY not configured"**
- Ensure the environment variable is set
- Restart the development server after adding the key

**"Rate limit exceeded"**
- OpenAI has per-minute and per-day limits
- Consider implementing request queuing

**"Memory not persisting"**
- Verify the database migration ran successfully
- Check that `sessionId` is being passed consistently

## Related Documentation

- [Plugin System](/docs/plugins/overview)
- [API Authentication](/docs/api/authentication)
