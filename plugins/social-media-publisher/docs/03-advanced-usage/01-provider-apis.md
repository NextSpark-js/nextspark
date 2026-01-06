# Provider APIs

## Overview

The Social Media Publisher plugin provides two comprehensive API wrappers for interacting with Facebook Graph API and Instagram Business API. These wrappers abstract the complexity of API calls, handle authentication, and provide type-safe interfaces.

**Available Providers:**
- **FacebookAPI** - Facebook Pages publishing and insights
- **InstagramAPI** - Instagram Business publishing and analytics

## FacebookAPI

### Import

```typescript
import { FacebookAPI } from '@/contents/plugins/social-media-publisher/lib/providers/facebook'
```

### Publishing Methods

#### `publishTextPost()`

Publish text-only post to Facebook Page.

**Signature:**
```typescript
static async publishTextPost(options: {
  pageId: string
  pageAccessToken: string
  message: string
}): Promise<FacebookPublishResult>
```

**Parameters:**
- `pageId` - Facebook Page ID
- `pageAccessToken` - Page access token (decrypted)
- `message` - Post text content

**Returns:**
```typescript
{
  success: boolean
  postId?: string  // e.g., "123456789_987654321"
  postUrl?: string  // e.g., "https://www.facebook.com/123456789/posts/987654321"
  error?: string
  errorDetails?: unknown
}
```

**Example:**
```typescript
const result = await FacebookAPI.publishTextPost({
  pageId: '123456789',
  pageAccessToken: decryptedToken,
  message: 'Hello from our Facebook Page! 👋'
})

if (result.success) {
  console.log(`Published: ${result.postUrl}`)
} else {
  console.error(`Failed: ${result.error}`)
}
```

**Graph API Call:**
```
POST https://graph.facebook.com/v18.0/{PAGE_ID}/feed
{
  "message": "Post text here",
  "access_token": "{PAGE_TOKEN}"
}
```

#### `publishPhotoPost()`

Publish photo with optional caption to Facebook Page.

**Signature:**
```typescript
static async publishPhotoPost(options: {
  pageId: string
  pageAccessToken: string
  message: string
  imageUrl: string
}): Promise<FacebookPublishResult>
```

**Parameters:**
- `pageId` - Facebook Page ID
- `pageAccessToken` - Page access token
- `message` - Photo caption
- `imageUrl` - Public HTTPS URL to image

**Example:**
```typescript
const result = await FacebookAPI.publishPhotoPost({
  pageId: '123456789',
  pageAccessToken: decryptedToken,
  message: 'Check out our new product!',
  imageUrl: 'https://cdn.example.com/product.jpg'
})
```

**Graph API Call:**
```
POST https://graph.facebook.com/v18.0/{PAGE_ID}/photos
{
  "url": "https://example.com/image.jpg",
  "message": "Photo caption",
  "access_token": "{PAGE_TOKEN}"
}
```

**Image Requirements:**
- Format: JPG, PNG, GIF, BMP
- Max size: 4MB (recommended), up to 15MB
- Must be publicly accessible via HTTPS

#### `publishLinkPost()`

Publish link with preview to Facebook Page.

**Signature:**
```typescript
static async publishLinkPost(options: {
  pageId: string
  pageAccessToken: string
  message: string
  link: string
}): Promise<FacebookPublishResult>
```

**Example:**
```typescript
const result = await FacebookAPI.publishLinkPost({
  pageId: '123456789',
  pageAccessToken: decryptedToken,
  message: 'Read our latest blog post!',
  link: 'https://example.com/blog/post'
})
```

**Graph API Call:**
```
POST https://graph.facebook.com/v18.0/{PAGE_ID}/feed
{
  "message": "Check this out!",
  "link": "https://example.com/article",
  "access_token": "{PAGE_TOKEN}"
}
```

**Link Requirements:**
- Must use HTTPS
- Facebook auto-generates preview using Open Graph tags
- Preview customization via meta tags:
  ```html
  <meta property="og:title" content="Article Title" />
  <meta property="og:description" content="Description" />
  <meta property="og:image" content="https://example.com/preview.jpg" />
  ```

### Page Management Methods

#### `getUserPages()`

Get list of Facebook Pages user manages.

**Signature:**
```typescript
static async getUserPages(userAccessToken: string): Promise<FacebookPageInfo[]>
```

**Returns:**
```typescript
interface FacebookPageInfo {
  id: string              // Page ID
  name: string            // Page name
  category: string        // Page category
  accessToken: string     // Page-specific access token
  tasks: string[]         // Permissions granted
  pictureUrl?: string     // Profile picture URL
}
```

**Example:**
```typescript
const pages = await FacebookAPI.getUserPages(userAccessToken)

pages.forEach(page => {
  console.log(`${page.name} (${page.id})`)
  console.log(`Permissions: ${page.tasks.join(', ')}`)
})
```

**Graph API Call:**
```
GET https://graph.facebook.com/v18.0/me/accounts
  ?fields=id,name,category,access_token,tasks,picture
  &access_token={USER_TOKEN}
```

#### `getPageInfo()`

Get detailed information about Facebook Page.

**Signature:**
```typescript
static async getPageInfo(
  pageId: string,
  pageAccessToken: string
): Promise<FacebookPageStats>
```

**Returns:**
```typescript
interface FacebookPageStats {
  id: string
  name: string
  fanCount: number           // Follower count
  about?: string
  category?: string
  profilePictureUrl?: string
  coverPhotoUrl?: string
  link?: string              // Page URL
}
```

**Example:**
```typescript
const pageInfo = await FacebookAPI.getPageInfo(pageId, pageAccessToken)

console.log(`${pageInfo.name}`)
console.log(`Followers: ${pageInfo.fanCount.toLocaleString()}`)
console.log(`About: ${pageInfo.about}`)
```

**Graph API Call:**
```
GET https://graph.facebook.com/v18.0/{PAGE_ID}
  ?fields=id,name,fan_count,about,category,picture,cover,link
  &access_token={PAGE_TOKEN}
```

#### `getPageInsights()`

Get analytics for Facebook Page.

**Signature:**
```typescript
static async getPageInsights(
  pageId: string,
  pageAccessToken: string
): Promise<FacebookInsights>
```

**Returns:**
```typescript
interface FacebookInsights {
  impressions: number     // Total impressions
  reach: number           // Total reach
  engagement: number      // Total engagement
  reactions: number       // Total reactions
  comments: number        // Total comments
  shares: number          // Total shares
}
```

**Example:**
```typescript
const insights = await FacebookAPI.getPageInsights(pageId, pageAccessToken)

console.log(`Impressions: ${insights.impressions}`)
console.log(`Engagement Rate: ${(insights.engagement / insights.reach * 100).toFixed(2)}%`)
```

**Note:** Requires `read_insights` permission.

### Instagram Integration Methods

#### `getInstagramBusinessAccount()`

Get Instagram Business Account linked to Facebook Page.

**Signature:**
```typescript
static async getInstagramBusinessAccount(
  pageId: string,
  pageAccessToken: string
): Promise<{
  id: string
  username: string
  name?: string
  profilePictureUrl?: string
  followersCount?: number
  followsCount?: number
  mediaCount?: number
  biography?: string
  website?: string
} | null>
```

**Returns:** Instagram account info or `null` if not connected

**Example:**
```typescript
const igAccount = await FacebookAPI.getInstagramBusinessAccount(
  pageId,
  pageAccessToken
)

if (igAccount) {
  console.log(`Instagram: @${igAccount.username}`)
  console.log(`Followers: ${igAccount.followersCount}`)
} else {
  console.log('No Instagram account connected to this Page')
}
```

**Graph API Call:**
```
GET https://graph.facebook.com/v18.0/{PAGE_ID}
  ?fields=instagram_business_account{id,username,name,profile_picture_url,followers_count,follows_count,media_count,biography,website}
  &access_token={PAGE_TOKEN}
```

#### `validatePagePermissions()`

Check which permissions are granted for a Page.

**Signature:**
```typescript
static async validatePagePermissions(
  pageId: string,
  pageAccessToken: string
): Promise<{
  valid: boolean
  permissions: string[]
  missing: string[]
}>
```

**Example:**
```typescript
const validation = await FacebookAPI.validatePagePermissions(
  pageId,
  pageAccessToken
)

console.log('Granted:', validation.permissions)
console.log('Missing:', validation.missing)

if (validation.missing.includes('pages_manage_posts')) {
  console.warn('Cannot publish - missing pages_manage_posts permission')
}
```

## InstagramAPI

### Import

```typescript
import { InstagramAPI } from '@/contents/plugins/social-media-publisher/lib/providers/instagram'
```

### Publishing Methods

#### `publishPhoto()`

Publish photo to Instagram Business Account.

**Signature:**
```typescript
static async publishPhoto(options: {
  igAccountId: string
  accessToken: string
  imageUrl: string
  caption?: string
}): Promise<InstagramPublishResult>
```

**Parameters:**
- `igAccountId` - Instagram Business Account ID
- `accessToken` - Page access token (for linked Page)
- `imageUrl` - Public HTTPS URL to image
- `caption` - Optional caption (max 2,200 chars)

**Returns:**
```typescript
{
  success: boolean
  postId?: string  // e.g., "17899618652010220"
  postUrl?: string  // e.g., "https://www.instagram.com/p/ABC123"
  error?: string
  errorDetails?: unknown
}
```

**Example:**
```typescript
const result = await InstagramAPI.publishPhoto({
  igAccountId: '17841401234567890',
  accessToken: decryptedToken,
  imageUrl: 'https://cdn.example.com/photo.jpg',
  caption: 'My awesome Instagram post! 📸 #photography'
})

if (result.success) {
  console.log(`Posted: ${result.postUrl}`)
}
```

**Process (2-Step Container):**
1. **Create Media Container:**
   ```
   POST https://graph.facebook.com/v18.0/{IG_ACCOUNT_ID}/media
   {
     "image_url": "https://example.com/image.jpg",
     "caption": "Caption here",
     "access_token": "{TOKEN}"
   }
   ```

2. **Publish Container:**
   ```
   POST https://graph.facebook.com/v18.0/{IG_ACCOUNT_ID}/media_publish
   {
     "creation_id": "{CONTAINER_ID}",
     "access_token": "{TOKEN}"
   }
   ```

**Image Requirements:**
- Format: JPG or PNG
- Size: Max 8MB
- Dimensions: 320px to 1080px (width)
- Aspect Ratio: 4:5 to 1.91:1
- Must be publicly accessible via HTTPS

**Caption Requirements:**
- Max length: 2,200 characters
- Max hashtags: 30
- Max mentions: 20 (@username)
- Supports emojis and line breaks

#### `publishVideo()`

Publish video to Instagram Business Account.

**Signature:**
```typescript
static async publishVideo(options: {
  igAccountId: string
  accessToken: string
  videoUrl: string
  caption?: string
}): Promise<InstagramPublishResult>
```

**Example:**
```typescript
const result = await InstagramAPI.publishVideo({
  igAccountId: '17841401234567890',
  accessToken: decryptedToken,
  videoUrl: 'https://cdn.example.com/video.mp4',
  caption: 'Watch this! 🎬 #video'
})
```

**Video Requirements:**
- Format: MP4 or MOV
- Size: Max 100MB
- Duration: 3 to 60 seconds
- Dimensions: Min 600px (any dimension)
- Aspect Ratio: 4:5 to 1.91:1
- Frame Rate: Max 30fps

**Processing Time:**
- Videos require processing before publishing
- Method waits up to 30 seconds for `FINISHED` status
- Polls every 2 seconds for completion

### Account Information Methods

#### `getAccountInfo()`

Get Instagram Business Account information.

**Signature:**
```typescript
static async getAccountInfo(
  igAccountId: string,
  accessToken: string
): Promise<InstagramAccountInfo>
```

**Returns:**
```typescript
interface InstagramAccountInfo {
  id: string
  username: string
  accountType?: string
  profilePictureUrl?: string
  followersCount?: number
  followsCount?: number
  mediaCount?: number
}
```

**Example:**
```typescript
const info = await InstagramAPI.getAccountInfo(igAccountId, accessToken)

console.log(`@${info.username}`)
console.log(`Followers: ${info.followersCount?.toLocaleString()}`)
console.log(`Posts: ${info.mediaCount}`)
```

**Graph API Call:**
```
GET https://graph.facebook.com/v18.0/{IG_ACCOUNT_ID}
  ?fields=id,username,account_type,profile_picture_url,followers_count,follows_count,media_count
  &access_token={TOKEN}
```

#### `getAccountInsights()`

Get Instagram account-level insights.

**Signature:**
```typescript
static async getAccountInsights(
  igAccountId: string,
  accessToken: string
): Promise<InstagramInsights>
```

**Returns:**
```typescript
interface InstagramInsights {
  impressions: number
  reach: number
  engagement: number
  likes: number
  comments: number
  saves: number
  profileViews: number
}
```

**Example:**
```typescript
const insights = await InstagramAPI.getAccountInsights(igAccountId, accessToken)

console.log(`Total Impressions: ${insights.impressions}`)
console.log(`Engagement Rate: ${(insights.engagement / insights.reach * 100).toFixed(2)}%`)
```

**Note:** Requires `instagram_manage_insights` permission.

#### `getMediaInsights()`

Get insights for specific Instagram post.

**Signature:**
```typescript
static async getMediaInsights(
  mediaId: string,
  accessToken: string
): Promise<Partial<InstagramInsights>>
```

**Example:**
```typescript
const postInsights = await InstagramAPI.getMediaInsights(
  '17899618652010220',
  accessToken
)

console.log(`Likes: ${postInsights.likes}`)
console.log(`Comments: ${postInsights.comments}`)
console.log(`Saves: ${postInsights.saves}`)
```

**Graph API Call:**
```
GET https://graph.facebook.com/v18.0/{MEDIA_ID}/insights
  ?metric=impressions,reach,engagement,likes,comments,saves
  &access_token={TOKEN}
```

## Error Handling

### Common Error Types

**Invalid Token:**
```typescript
try {
  await FacebookAPI.publishTextPost({ ... })
} catch (error) {
  if (error.message.includes('Invalid OAuth')) {
    // Token expired or revoked - need to reconnect
    console.error('Token invalid - user must reconnect account')
  }
}
```

**Rate Limiting:**
```typescript
try {
  await InstagramAPI.publishPhoto({ ... })
} catch (error) {
  if (error.message.includes('rate limit')) {
    // Too many requests - wait and retry
    console.error('Rate limit reached - retry later')
  }
}
```

**Permission Errors:**
```typescript
try {
  await FacebookAPI.getPageInsights({ ... })
} catch (error) {
  if (error.message.includes('read_insights')) {
    // Missing required permission
    console.error('User needs to grant read_insights permission')
  }
}
```

**Image Not Accessible:**
```typescript
try {
  await InstagramAPI.publishPhoto({ ... })
} catch (error) {
  if (error.message.includes('publicly accessible')) {
    // Image URL not reachable
    console.error('Image must be publicly accessible via HTTPS')
  }
}
```

### Error Handling Pattern

```typescript
async function safePublish(options: PublishOptions): Promise<PublishResult> {
  try {
    const result = await InstagramAPI.publishPhoto(options)
    
    if (!result.success) {
      // Log failure
      await logAuditEvent('post_failed', {
        error: result.error,
        errorDetails: result.errorDetails
      })
      
      return { success: false, error: result.error }
    }
    
    // Log success
    await logAuditEvent('post_published', {
      postId: result.postId,
      postUrl: result.postUrl
    })
    
    return result
    
  } catch (error) {
    // Unexpected error
    console.error('Unexpected publish error:', error)
    
    await logAuditEvent('post_failed', {
      error: 'Unexpected error',
      details: error instanceof Error ? error.message : String(error)
    })
    
    return { success: false, error: 'Unexpected error occurred' }
  }
}
```

## Usage Examples

### Batch Publishing

```typescript
async function publishToMultiplePlatforms(
  accounts: SocialAccount[],
  imageUrl: string,
  caption: string
) {
  const results = await Promise.allSettled(
    accounts.map(async (account) => {
      const [encrypted, iv, keyId] = account.accessToken.split(':')
      const token = await TokenEncryption.decrypt(encrypted, iv, keyId)
      
      if (account.platform === 'instagram_business') {
        return await InstagramAPI.publishPhoto({
          igAccountId: account.platformAccountId,
          accessToken: token,
          imageUrl,
          caption
        })
      } else {
        return await FacebookAPI.publishPhotoPost({
          pageId: account.platformAccountId,
          pageAccessToken: token,
          message: caption,
          imageUrl
        })
      }
    })
  )
  
  return {
    successful: results.filter(r => r.status === 'fulfilled').length,
    failed: results.filter(r => r.status === 'rejected').length,
    results
  }
}
```

### Account Sync

```typescript
async function syncAccountStats(accountId: string) {
  const account = await getAccountFromDB(accountId)
  const [encrypted, iv, keyId] = account.accessToken.split(':')
  const token = await TokenEncryption.decrypt(encrypted, iv, keyId)
  
  if (account.platform === 'instagram_business') {
    const info = await InstagramAPI.getAccountInfo(
      account.platformAccountId,
      token
    )
    
    await updateAccountMetadata(accountId, {
      followersCount: info.followersCount,
      mediaCount: info.mediaCount,
      profilePictureUrl: info.profilePictureUrl,
      lastSyncAt: new Date().toISOString()
    })
  } else {
    const info = await FacebookAPI.getPageInfo(
      account.platformAccountId,
      token
    )
    
    await updateAccountMetadata(accountId, {
      fanCount: info.fanCount,
      about: info.about,
      profilePictureUrl: info.profilePictureUrl,
      lastSyncAt: new Date().toISOString()
    })
  }
}
```

## Next Steps

- **[Custom Integrations](./02-custom-integrations.md)** - Build custom features with providers
- **[Publishing](../02-core-features/02-publishing.md)** - Use providers in publishing endpoint
- **[Token Management](../02-core-features/03-token-management.md)** - Secure token handling
