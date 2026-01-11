# Social Media Connect API

Initiate OAuth flow and connect Facebook Pages or Instagram Business accounts.

## Endpoints

```
GET  /api/v1/plugin/social-media-publisher/social/connect
POST /api/v1/plugin/social-media-publisher/social/connect (deprecated)
```

## GET - Initiate OAuth Flow

Redirects user to Facebook OAuth authorization page to connect their social media accounts.

### Query Parameters

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `platform` | string | No | instagram_business | Platform to connect |
| `clientId` | string | Yes | - | Client ID to associate accounts with |
| `state` | string | No | - | Random state for CSRF protection |
| `mode` | string | No | save | "preview" returns data without saving |

### Supported Platforms

- `instagram_business` - Instagram Business Account (requires linked Facebook Page)
- `facebook_page` - Facebook Page

### Example Request

```
GET /api/v1/plugin/social-media-publisher/social/connect?platform=instagram_business&clientId=client_123&state=abc123
```

### Response

Redirects to Facebook OAuth authorization URL:
```
https://www.facebook.com/v18.0/dialog/oauth?client_id=...&redirect_uri=...&scope=...&state=...
```

### OAuth Scopes Requested

**For Instagram Business:**
- `instagram_basic` - Basic account info
- `instagram_content_publish` - Publish content
- `instagram_manage_comments` - Manage comments
- `pages_show_list` - List Facebook Pages
- `pages_read_engagement` - Read engagement metrics

**For Facebook Pages:**
- `pages_show_list` - List Facebook Pages
- `pages_manage_posts` - Publish posts
- `pages_read_engagement` - Read engagement

## POST - Handle OAuth Callback (Deprecated)

Use `/api/v1/plugin/social-media-publisher/social/connect/callback` instead.

This endpoint receives the authorization code and exchanges it for access tokens.

### Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `code` | string | Yes | Authorization code from OAuth |
| `state` | string | No | State for CSRF validation |
| `platform` | string | Yes | Platform type |

### Success Response (200)

```json
{
  "success": true,
  "message": "Successfully connected 1 instagram_business account(s)",
  "accounts": [
    {
      "id": "acc_123",
      "platform": "instagram_business",
      "accountName": "@myaccount",
      "permissions": ["instagram_basic", "instagram_content_publish"],
      "metadata": {
        "followersCount": 5000,
        "mediaCount": 150
      },
      "connectedAt": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Missing clientId | clientId parameter required |
| 400 | Invalid platform | Platform must be facebook_page or instagram_business |
| 401 | Authentication required | User not logged in |
| 404 | No Instagram accounts | No Instagram Business accounts found |
| 500 | OAuth failed | Failed to exchange code for token |

## Setup

Configure Facebook OAuth credentials:

```bash
# plugins/social-media-publisher/.env
FACEBOOK_CLIENT_ID=your_app_id
FACEBOOK_CLIENT_SECRET=your_app_secret
NEXT_PUBLIC_APP_URL=https://your-app.com
```

## OAuth Flow

1. Frontend calls GET with clientId and platform
2. User redirected to Facebook OAuth
3. User authorizes requested permissions
4. Facebook redirects to callback endpoint
5. Callback exchanges code for tokens
6. Tokens encrypted and stored in database
7. Popup closes and parent window notified

## Security

- All access tokens are encrypted with AES-256-GCM
- CSRF protection via state parameter
- Token expiration tracked for auto-refresh
- Audit logs created for all connections

## Related APIs

- [OAuth Callback](/api/v1/plugin/social-media-publisher/social/connect/callback) - OAuth redirect handler
- [Publish](/api/v1/plugin/social-media-publisher/social/publish) - Publish content
- [Disconnect](/api/v1/plugin/social-media-publisher/social/disconnect) - Disconnect account
