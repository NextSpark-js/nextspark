# Publishing

## Overview

The Social Media Publisher plugin provides a unified endpoint for publishing content to Instagram Business and Facebook Pages. Publishing includes automatic token validation, token refresh if needed, and comprehensive audit logging.

**Endpoint:** `POST /api/v1/plugin/social-media-publisher/social/publish`

**Supported Platforms:**
- Instagram Business (photos and videos)
- Facebook Pages (text, photos, and links)

## Publish Endpoint

### Request Schema

```typescript
{
  accountId: string         // UUID of social platform account
  platform: string          // 'instagram_business' | 'facebook_page'
  imageUrl?: string         // Public HTTPS URL to image
  videoUrl?: string         // Public HTTPS URL to video
  caption?: string          // Post caption/message
  link?: string             // Link URL (Facebook only)
}
```

### Response Schema

**Success:**
```json
{
  "success": true,
  "platform": "instagram_business",
  "postId": "17899618652010220",
  "postUrl": "https://www.instagram.com/p/ABC123",
  "message": "Successfully published to instagram_business"
}
```

**Error:**
```json
{
  "error": "Publishing failed",
  "platform": "instagram_business",
  "details": "Image URL must be publicly accessible",
  "errorDetails": {
    "code": 100,
    "message": "Invalid parameter"
  }
}
```

## Instagram Business Publishing

### Photo Posts

Instagram uses a **2-step container process**:

1. **Create Media Container** - Upload image URL and caption
2. **Publish Container** - Make post live on profile

**Request:**
```typescript
{
  accountId: "550e8400-e29b-41d4-a716-446655440000",
  platform: "instagram_business",
  imageUrl: "https://example.com/image.jpg",
  caption: "Check out our new product! 🚀 #launch"
}
```

**Process Flow:**
```
1. Validate request
2. Get account from database (via RLS)
3. Check token expiration
4. Auto-refresh if < 10 minutes until expiry
5. Decrypt access token
6. Create media container (Instagram API)
7. Wait 2 seconds (Instagram processing)
8. Publish container (Instagram API)
9. Create audit log
10. Return post URL
```

**Code Example:**
```typescript
// Using fetch API
const response = await fetch('/api/v1/plugin/social-media-publisher/social/publish', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    accountId: 'account-uuid-here',
    platform: 'instagram_business',
    imageUrl: 'https://cdn.example.com/photo.jpg',
    caption: 'My awesome post! #instagram'
  })
})

const result = await response.json()

if (result.success) {
  console.log('Posted to Instagram:', result.postUrl)
} else {
  console.error('Failed:', result.error)
}
```

**Image Requirements:**
- **Format:** JPG or PNG
- **Size:** Max 8MB
- **Dimensions:** 320px to 1080px (width)
- **Aspect Ratio:** 4:5 to 1.91:1
- **Accessibility:** Must be publicly accessible via HTTPS
- **No Redirects:** Direct image URL only

**Caption Requirements:**
- **Length:** Max 2,200 characters
- **Hashtags:** Up to 30 per post
- **Mentions:** Up to 20 per post (@username)
- **Emojis:** Supported ✅
- **Line Breaks:** Supported (`\n`)

### Video Posts

Similar to photos but with **longer processing time**:

**Request:**
```typescript
{
  accountId: "account-uuid",
  platform: "instagram_business",
  videoUrl: "https://example.com/video.mp4",
  caption: "Check out this video! 🎬"
}
```

**Process Flow:**
```
1-5. Same as photo posts
6. Create video container
7. Poll for video processing (up to 30 seconds)
8. Publish when status = 'FINISHED'
9. Create audit log
10. Return post URL
```

**Video Requirements:**
- **Format:** MP4 or MOV
- **Size:** Max 100MB
- **Duration:** 3 seconds to 60 seconds
- **Dimensions:** Min 600px (any dimension)
- **Aspect Ratio:** 4:5 to 1.91:1
- **Frame Rate:** Max 30fps
- **Accessibility:** Must be publicly accessible via HTTPS

**Processing Time:**
- Small videos (< 10MB): 5-10 seconds
- Medium videos (10-50MB): 15-30 seconds
- Large videos (50-100MB): 30-60 seconds

## Facebook Pages Publishing

### Text Posts

**Request:**
```typescript
{
  accountId: "account-uuid",
  platform: "facebook_page",
  caption: "Just a text post on Facebook!"
}
```

**Process:**
```
POST https://graph.facebook.com/v18.0/{PAGE_ID}/feed
{
  message: "Post text here",
  access_token: "{PAGE_TOKEN}"
}
```

### Photo Posts

**Request:**
```typescript
{
  accountId: "account-uuid",
  platform: "facebook_page",
  imageUrl: "https://example.com/image.jpg",
  caption: "Check out this photo!"
}
```

**Process:**
```
POST https://graph.facebook.com/v18.0/{PAGE_ID}/photos
{
  url: "https://example.com/image.jpg",
  message: "Photo caption",
  access_token: "{PAGE_TOKEN}"
}
```

**Image Requirements:**
- **Format:** JPG, PNG, GIF, BMP
- **Size:** Max 4MB (recommended), up to 15MB
- **Dimensions:** No strict limits, but 1200x630px recommended
- **Accessibility:** Must be publicly accessible

### Link Posts

**Request:**
```typescript
{
  accountId: "account-uuid",
  platform: "facebook_page",
  link: "https://example.com/article",
  caption: "Read our latest article!"
}
```

**Process:**
```
POST https://graph.facebook.com/v18.0/{PAGE_ID}/feed
{
  message: "Check this out!",
  link: "https://example.com/article",
  access_token: "{PAGE_TOKEN}"
}
```

**Link Requirements:**
- **Protocol:** Must be HTTPS (HTTP not allowed)
- **Preview:** Facebook auto-generates preview (Open Graph)
- **Meta Tags:** Use Open Graph tags for better preview

## Validation

### Image URL Validation

```typescript
function validateImageUrl(url: string): { valid: boolean; error?: string } {
  // Must be HTTPS
  if (!url.startsWith('https://')) {
    return { valid: false, error: 'Image URL must use HTTPS' }
  }

  // Must end with image extension
  const validExtensions = ['.jpg', '.jpeg', '.png', '.gif']
  const hasValidExtension = validExtensions.some(ext => 
    url.toLowerCase().includes(ext)
  )
  
  if (!hasValidExtension) {
    return { valid: false, error: 'URL must point to an image file' }
  }

  // Must be publicly accessible (checked at runtime by platform)
  return { valid: true }
}
```

### Caption Validation

```typescript
function validateCaption(
  caption: string,
  platform: 'instagram_business' | 'facebook_page'
): { valid: boolean; error?: string } {
  // Instagram: Max 2,200 characters
  if (platform === 'instagram_business' && caption.length > 2200) {
    return { 
      valid: false, 
      error: 'Instagram captions must be under 2,200 characters' 
    }
  }

  // Facebook: Max 63,206 characters
  if (platform === 'facebook_page' && caption.length > 63206) {
    return { 
      valid: false, 
      error: 'Facebook posts must be under 63,206 characters' 
    }
  }

  return { valid: true }
}
```

## Automatic Token Refresh

Before every publish operation, the plugin checks if the token expires soon and automatically refreshes it if needed.

**Refresh Logic:**
```typescript
const now = new Date()
const expiresAt = new Date(account.tokenExpiresAt)
const minutesUntilExpiry = (expiresAt.getTime() - now.getTime()) / (1000 * 60)

// Refresh if < 10 minutes until expiration
if (minutesUntilExpiry < 10) {
  const refreshResult = await refreshAccountToken(accountId, platform, decryptedToken)
  
  if (refreshResult.success) {
    // Use refreshed token for this request
    decryptedToken = refreshResult.newAccessToken
  } else {
    // Fail publish operation
    return error('Token expired and refresh failed')
  }
}
```

**Benefits:**
- ✅ No publish failures due to expired tokens
- ✅ Transparent to users
- ✅ Automatic for all accounts
- ✅ Logged in audit trail

## Usage Examples

### React Component

```typescript
'use client'

import { useState } from 'react'

export function PublishForm({ accountId, platform }: {
  accountId: string
  platform: 'instagram_business' | 'facebook_page'
}) {
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  const handlePublish = async () => {
    setLoading(true)
    setResult(null)

    try {
      const response = await fetch('/api/v1/plugin/social-media-publisher/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId,
          platform,
          imageUrl,
          caption
        })
      })

      const data = await response.json()
      setResult(data)

      if (data.success) {
        alert(`Published successfully! View at: ${data.postUrl}`)
      }
    } catch (error) {
      setResult({ error: 'Network error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div>
      <input
        type="url"
        placeholder="Image URL (https://...)"
        value={imageUrl}
        onChange={(e) => setImageUrl(e.target.value)}
      />
      
      <textarea
        placeholder="Caption..."
        value={caption}
        onChange={(e) => setCaption(e.target.value)}
        maxLength={platform === 'instagram_business' ? 2200 : 63206}
      />

      <button 
        onClick={handlePublish} 
        disabled={loading || !imageUrl}
      >
        {loading ? 'Publishing...' : 'Publish'}
      </button>

      {result && (
        <div>
          {result.success ? (
            <a href={result.postUrl} target="_blank">
              View Post →
            </a>
          ) : (
            <p>Error: {result.error}</p>
          )}
        </div>
      )}
    </div>
  )
}
```

### Batch Publishing

Publish to multiple accounts:

```typescript
async function publishToMultipleAccounts(
  accounts: Array<{ id: string; platform: string }>,
  imageUrl: string,
  caption: string
) {
  const results = await Promise.allSettled(
    accounts.map(account =>
      fetch('/api/v1/plugin/social-media-publisher/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountId: account.id,
          platform: account.platform,
          imageUrl,
          caption
        })
      }).then(r => r.json())
    )
  )

  const successful = results.filter(r => r.status === 'fulfilled')
  const failed = results.filter(r => r.status === 'rejected')

  return {
    total: accounts.length,
    successful: successful.length,
    failed: failed.length,
    results
  }
}
```

## Error Handling

### Common Errors

**1. Token Expired**
```json
{
  "error": "Token expired and refresh failed",
  "details": "Meta API error: Invalid OAuth 2.0 Access Token",
  "suggestion": "Please reconnect your social media account"
}
```
**Solution:** User must reconnect account via OAuth

**2. Image Not Accessible**
```json
{
  "error": "Publishing failed",
  "details": "Image URL must be publicly accessible",
  "errorDetails": {
    "code": 100,
    "message": "Invalid parameter"
  }
}
```
**Solution:** Ensure image URL is publicly accessible via HTTPS

**3. Rate Limit**
```json
{
  "error": "Publishing failed",
  "details": "Application request limit reached",
  "errorDetails": {
    "code": 4,
    "message": "Application request limit reached"
  }
}
```
**Solution:** Wait and retry, or upgrade Facebook App tier

**4. Invalid Permissions**
```json
{
  "error": "Publishing failed",
  "details": "(#200) Requires extended permission: instagram_content_publish"
}
```
**Solution:** User must reconnect account and grant required permissions

## Best Practices

### Image Hosting

✅ **Use CDN** for image hosting (CloudFlare, AWS CloudFront)  
✅ **HTTPS Only** - HTTP URLs rejected  
✅ **Direct URLs** - No redirects  
✅ **Optimize Size** - Compress images before upload  
✅ **Test Accessibility** - Verify URL is publicly accessible  

### Caption Writing

✅ **Keep Under Limits** - 2,200 for Instagram, 63,206 for Facebook  
✅ **Use Hashtags** - Max 30 per Instagram post  
✅ **Test Emojis** - Ensure they render correctly  
✅ **Line Breaks** - Use `\n` for readability  
✅ **Call-to-Action** - Include clear CTA  

### Error Handling

✅ **Show User-Friendly Messages** - Don't expose technical errors  
✅ **Retry Logic** - Implement exponential backoff for rate limits  
✅ **Token Refresh** - Handle automatic refresh transparently  
✅ **Audit Logging** - Log all attempts for debugging  
✅ **Validation** - Validate before sending to API  

## Next Steps

- **[Token Management](./03-token-management.md)** - Understand token lifecycle
- **[Audit Logging](./04-audit-logging.md)** - Track all publishing events
- **[Provider APIs](../03-advanced-usage/01-provider-apis.md)** - Use API wrappers directly
