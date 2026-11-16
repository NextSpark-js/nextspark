# Social Accounts API

List the social accounts the user can assign to an entity.

## Endpoint

```
GET /api/plugins/social-media-publisher/social/accounts
```

## Authentication

Requires dual authentication (session or API key with the `social:read` scope).

## Query Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `entityId` | string | No | Marks the accounts already assigned to this entity. Needs the project's adapter (501 without one) |
| `platform` | string | No | `instagram_business` or `facebook_page` |

## Description

Lists the user's active accounts in `social_accounts` whose token has not expired, plus the Facebook Pages and Instagram Business accounts that Graph returns for a stored Meta token. The response carries account and page details only, never a token: to link an account, send its `platformAccountId` to [assign](../assign/docs.md), which reads the token on the server.

## Success Response (200)

```json
{
  "success": true,
  "accounts": [
    {
      "platform": "facebook_page",
      "platformAccountId": "123456789",
      "username": "My Page",
      "tokenExpiresAt": "2026-03-15T10:30:00Z",
      "permissions": ["CREATE_CONTENT"],
      "accountMetadata": { "category": "Brand", "profilePictureUrl": "..." },
      "alreadyAssignedToEntity": false,
      "socialAccountId": "123e4567-e89b-12d3-a456-426614174000",
      "connectedClients": [{ "id": "...", "name": "Project One" }]
    }
  ],
  "hasValidToken": true,
  "assignedCount": 0,
  "entitySlug": "projects"
}
```

`connectedClients` comes from the adapter (empty without one); `entitySlug` is `null` without an adapter.

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 401 | Authentication required | Not authenticated |
| 404 | Entity not found or access denied | The adapter denied access to `entityId` |
| 501 | `SOCIAL_ADAPTER_NOT_REGISTERED` | `entityId` given and no adapter registered |
| 500 | Failed to fetch accounts | Server error |
