# OAuth Callback API

Handles OAuth redirect from Facebook after user authorization.

## Endpoint

```
GET /api/v1/plugin/social-media-publisher/social/connect/callback
```

## Description

This endpoint receives the OAuth redirect from Facebook, exchanges the authorization code for access tokens, encrypts them, and stores connected accounts in the database.

## Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `code` | string | Authorization code from Facebook |
| `state` | string | CSRF token with embedded clientId, platform, mode |
| `error` | string | (Optional) Error if user denied permission |
| `error_description` | string | (Optional) Error description |

### State Format

The state parameter contains embedded values:
```
{randomState}&platform={platform}&clientId={clientId}&mode={mode}
```

## Response

This endpoint returns HTML pages that communicate with the parent window via postMessage.

### Success Response

Returns HTML page that:
1. Displays success message
2. Sends postMessage to opener window:
```javascript
{
  type: 'oauth-success',
  platform: 'instagram_business',
  connectedCount: 1
}
```
3. Closes popup after 2 seconds

### Preview Mode Response

When `mode=preview` in state, returns account data without saving:
```javascript
{
  type: 'oauth-preview',
  platform: 'instagram_business',
  accounts: [
    {
      platform: 'instagram_business',
      platformAccountId: 'ig_123',
      username: '@myaccount',
      accessToken: '...',
      tokenExpiresAt: '2024-03-15T10:30:00Z',
      permissions: ['instagram_basic', 'instagram_content_publish'],
      accountMetadata: {
        followersCount: 5000,
        profilePictureUrl: '...'
      }
    }
  ]
}
```

### Error Response

Returns HTML page that:
1. Displays error message
2. Sends postMessage to opener:
```javascript
{
  type: 'oauth-error',
  error: 'user_cancelled',
  errorDescription: 'You cancelled the authorization process'
}
```
3. Closes popup after 3 seconds

## Error Types

| Error Type | Description |
|------------|-------------|
| `user_cancelled` | User cancelled OAuth flow |
| `app_not_authorized` | App not authorized by Facebook |
| `meta_server_error` | Facebook server temporarily unavailable |
| `missing_client` | Client ID not in state |
| `missing_code` | Authorization code not provided |
| `no_instagram_accounts` | No Instagram Business accounts found |
| `callback_exception` | Server error during processing |

## Account Types

### Instagram Business

Fetches Instagram accounts linked to Facebook Pages:
- Requires Facebook Page with linked Instagram Business Account
- Returns profile picture, followers count, media count
- Uses Page access token for Instagram Graph API

### Facebook Page

Fetches Facebook Pages the user manages:
- Returns page name, category, fan count
- Uses Page access token for publishing

## Token Handling

1. Authorization code exchanged for user access token
2. User token exchanged for long-lived Page tokens (60 days)
3. Tokens encrypted with AES-256-GCM before storage
4. Expiration tracked for auto-refresh on publish

## Database Storage

Accounts stored in `clients_social_platforms` table:
- Linked to client via `parentId`
- Upsert on `platformAccountId` conflict
- Audit log entry created for each connection

## Frontend Integration

```typescript
// Open OAuth popup
const popup = window.open(
  '/api/v1/plugin/social-media-publisher/social/connect?platform=instagram_business&clientId=xxx',
  'oauth',
  'width=600,height=700'
)

// Listen for callback
window.addEventListener('message', (event) => {
  if (event.origin !== window.location.origin) return

  if (event.data.type === 'oauth-success') {
    console.log(`Connected ${event.data.connectedCount} accounts`)
    refreshAccountList()
  } else if (event.data.type === 'oauth-error') {
    console.error(event.data.errorDescription)
  }
})
```

## Related APIs

- [Connect](/api/v1/plugin/social-media-publisher/social/connect) - Initiate OAuth flow
- [Publish](/api/v1/plugin/social-media-publisher/social/publish) - Publish content
- [Disconnect](/api/v1/plugin/social-media-publisher/social/disconnect) - Disconnect account
