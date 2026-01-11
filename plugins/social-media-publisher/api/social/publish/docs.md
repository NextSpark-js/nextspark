# Social Media Publish API

Publish content to connected Instagram Business or Facebook Page accounts.

## Endpoint

```
POST /api/v1/plugin/social-media-publisher/social/publish
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

## Request Body

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `accountId` | string | Yes | Social platform account ID |
| `platform` | string | Yes | Platform type (instagram_business, facebook_page) |
| `imageUrl` | string | No* | Single image URL |
| `imageUrls` | string[] | No* | Multiple image URLs for carousel (2-10) |
| `caption` | string | No | Post caption/message |

*Instagram requires at least one image. Facebook supports text-only posts.

### Example: Single Image Post

```json
{
  "accountId": "acc_123",
  "platform": "instagram_business",
  "imageUrl": "https://example.com/photo.jpg",
  "caption": "Check out our new product! #launch"
}
```

### Example: Carousel Post

```json
{
  "accountId": "acc_123",
  "platform": "instagram_business",
  "imageUrls": [
    "https://example.com/photo1.jpg",
    "https://example.com/photo2.jpg",
    "https://example.com/photo3.jpg"
  ],
  "caption": "Swipe through our collection!"
}
```

### Example: Text-Only Post (Facebook)

```json
{
  "accountId": "acc_456",
  "platform": "facebook_page",
  "caption": "Exciting news coming soon!"
}
```

## Success Response (200)

```json
{
  "success": true,
  "platform": "instagram_business",
  "postId": "17895695668004550",
  "postUrl": "https://www.instagram.com/p/ABC123/",
  "message": "Successfully published to instagram_business"
}
```

## Error Responses

| Status | Error | Description |
|--------|-------|-------------|
| 400 | Validation failed | Invalid request body |
| 400 | Platform requires image | Instagram requires at least one image |
| 400 | Invalid image URL | Image URL format invalid |
| 400 | Invalid caption | Caption exceeds platform limit |
| 401 | Authentication required | Not authenticated |
| 403 | Account inactive | Account disconnected, needs reconnection |
| 403 | Token expired | Token refresh failed, reconnect account |
| 404 | Account not found | Account doesn't exist or no access |
| 500 | Publishing failed | API error during publishing |

### Example Error

```json
{
  "error": "Publishing failed",
  "platform": "instagram_business",
  "details": "Invalid image URL",
  "errorDetails": { ... }
}
```

## Platform Requirements

### Instagram Business

- **Image Required**: Yes (single or carousel)
- **Carousel**: 2-10 images
- **Caption Limit**: 2,200 characters
- **Image Formats**: JPEG, PNG
- **Image Size**: Max 8MB per image
- **Aspect Ratio**: 4:5 to 1.91:1

### Facebook Page

- **Image Required**: No (text-only allowed)
- **Carousel**: 2-10 images
- **Caption Limit**: 63,206 characters
- **Image Formats**: JPEG, PNG, GIF
- **Image Size**: Max 4MB per image

## Token Auto-Refresh

The endpoint automatically handles token refresh:

1. Checks token expiration before publishing
2. If expiring within 10 minutes, refreshes token
3. Uses Meta's fb_exchange_token endpoint
4. Re-encrypts new token in database
5. Blocks publish if refresh fails (prevents wasted API calls)

## Audit Logging

All publish attempts are logged to `audit_logs` table:

```json
{
  "action": "post_published",
  "details": {
    "platform": "instagram_business",
    "accountName": "@myaccount",
    "success": true,
    "postId": "17895695668004550",
    "postType": "carousel",
    "imageCount": 3,
    "caption": "...",
    "publishedAt": "2024-01-15T10:30:00Z"
  }
}
```

## Image URL Requirements

Image URLs must be:
- Publicly accessible
- HTTPS protocol
- Valid image extension or content-type
- Not behind authentication
- Reachable from Meta's servers

## Related APIs

- [Connect](/api/v1/plugin/social-media-publisher/social/connect) - Connect accounts
- [Disconnect](/api/v1/plugin/social-media-publisher/social/disconnect) - Disconnect accounts
