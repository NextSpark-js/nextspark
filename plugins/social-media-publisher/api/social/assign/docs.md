# Assign Social Accounts API

Link accounts the user has connected to an entity of the project.

## Endpoint

```
POST /api/plugins/social-media-publisher/social/assign
```

## Authentication

Requires dual authentication (session or API key with the `social:write` scope) and the project's adapter (501 without one).

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `entityId` | string | Yes | The entity to link the accounts to (`clientId` is accepted as a legacy name) |
| `accounts` | array | Yes | `{ platformAccountId, platform? }` for each account, as [accounts](../accounts/docs.md) lists them |

```json
{
  "entityId": "123e4567-e89b-12d3-a456-426614174000",
  "accounts": [{ "platformAccountId": "123456789", "platform": "facebook_page" }]
}
```

The route reads only `platformAccountId` and `platform`. It finds the account among the user's own (as the accounts route lists them) and takes its token and details on the server: from the user's `social_accounts` row, or, for a Page or Instagram account that Graph returns for a stored Meta token, from Graph, storing it in a new `social_accounts` row of the user. Any other field, such as an `accessToken` sent by an older client, is ignored. The adapter's `saveAssignment()` receives the account with that token.

## Success Response (200)

```json
{
  "success": true,
  "message": "Assigned 1 of 1 accounts",
  "entitySlug": "projects",
  "entityId": "123e4567-e89b-12d3-a456-426614174000",
  "results": [{ "platformAccountId": "123456789", "username": "My Page", "success": true }],
  "stats": { "total": 1, "success": 1, "failed": 0 }
}
```

An account that is not among the user's own fails in `results` with `Account not found among your connected accounts`; `success` is `false` when no account was assigned.

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | entityId is required / accounts array is required | Invalid request body |
| 401 | Authentication required | Not authenticated |
| 404 | Entity not found or access denied | The adapter denied access to `entityId` |
| 501 | `SOCIAL_ADAPTER_NOT_REGISTERED` | No adapter registered |
| 500 | Failed to assign accounts | Server error |
