# Social Media Disconnect API

Disconnect (deactivate) a social media account.

## Endpoint

```
POST   /api/v1/plugin/social-media-publisher/social/disconnect
DELETE /api/v1/plugin/social-media-publisher/social/disconnect/:accountId
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

## POST - Disconnect Account

Marks a social media account as inactive (soft delete).

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | string | Yes | Social account UUID |

### Example Request

```json
{
  "accountId": "123e4567-e89b-12d3-a456-426614174000"
}
```

### Success Response (200)

```json
{
  "success": true,
  "accountId": "123e4567-e89b-12d3-a456-426614174000",
  "message": "Successfully disconnected @myaccount (instagram_business)"
}
```

## DELETE - Disconnect Account (Alternative)

Alternative method using account ID in URL path.

### Example Request

```
DELETE /api/v1/plugin/social-media-publisher/social/disconnect/123e4567-e89b-12d3-a456-426614174000
```

### Success Response (200)

Same as POST method.

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation failed | Invalid request body |
| 400 | Invalid account ID format | UUID format invalid |
| 400 | Account already disconnected | Account is already inactive |
| 401 | Authentication required | Not authenticated |
| 404 | Account not found | Account doesn't exist or no access |
| 500 | Failed to disconnect | Server error during operation |

### Example Error

```json
{
  "error": "Account already disconnected",
  "message": "This account is already inactive."
}
```

## Behavior

1. **Soft Delete**: Account is marked as `isActive = false`, not deleted
2. **Tokens Preserved**: Encrypted tokens remain in database for potential reconnection
3. **Audit Log**: Disconnect event logged with timestamp and user info
4. **Idempotent**: Returns error if already disconnected

## Audit Logging

Disconnect events are logged:

```json
{
  "action": "account_disconnected",
  "details": {
    "platform": "instagram_business",
    "accountName": "@myaccount",
    "success": true,
    "disconnectedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Reconnecting

To reconnect a disconnected account:
1. Use the [Connect](/api/v1/plugin/social-media-publisher/social/connect) endpoint
2. OAuth flow will update the existing record
3. Account becomes active again with fresh tokens

## Related APIs

- [Connect](/api/v1/plugin/social-media-publisher/social/connect) - Connect accounts
- [Publish](/api/v1/plugin/social-media-publisher/social/publish) - Publish content
