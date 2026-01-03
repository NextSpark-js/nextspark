# OAuth Integration

## Overview

The Social Media Publisher plugin uses **Facebook OAuth 2.0** to connect Instagram Business and Facebook Page accounts. OAuth connections are managed per-client, with tokens encrypted and stored securely in the database.

**Key Features:**
- Popup-based OAuth flow (no full-page redirects)
- Per-client account management
- Automatic token encryption
- Multi-account support
- CSRF protection via state parameter
- PostMessage communication between popup and parent window

## OAuth Flow Diagram

```
┌─────────────┐
│   User      │
│  (Client    │
│   Context)  │
└──────┬──────┘
       │ 1. Clicks "Connect Instagram"
       ↓
┌──────────────────────────────┐
│  /api/v1/plugin/social-      │
│   media-publisher/social/    │
│   connect?platform=          │
│   instagram_business&        │
│   clientId={uuid}            │
└──────┬───────────────────────┘
       │ 2. Generates OAuth URL
       ↓
┌──────────────────────────────┐
│  OAuth Popup Window          │
│  facebook.com/dialog/oauth   │
└──────┬───────────────────────┘
       │ 3. User authorizes
       ↓
┌──────────────────────────────┐
│  /api/v1/plugin/social-      │
│   media-publisher/social/    │
│   connect/callback?          │
│   code={code}&state={state}  │
└──────┬───────────────────────┘
       │ 4. Exchange code for token
       ↓
┌──────────────────────────────┐
│  Facebook Graph API          │
│  - Get access token          │
│  - Fetch user's Pages        │
│  - Get Instagram accounts    │
└──────┬───────────────────────┘
       │ 5. Encrypt tokens
       ↓
┌──────────────────────────────┐
│  Database                    │
│  clients_social_platforms    │
│  (encrypted tokens stored)   │
└──────┬───────────────────────┘
       │ 6. Return success HTML
       ↓
┌──────────────────────────────┐
│  Popup window.postMessage    │
│  { type: 'oauth-success',    │
│    connectedCount: 2 }       │
└──────┬───────────────────────┘
       │ 7. Parent receives message
       ↓
┌──────────────────────────────┐
│  Parent Window               │
│  - Refresh page              │
│  - Show new accounts         │
│  - Close popup (auto)        │
└──────────────────────────────┘
```

## Step-by-Step Flow

### Step 1: Initiate OAuth

**User Action:** Clicks "Connect Instagram Business" or "Connect Facebook Page"

**Frontend Code:**
```typescript
'use client'

import { useRouter } from 'next/navigation'

export function ConnectSocialButton({ 
  clientId, 
  platform 
}: { 
  clientId: string
  platform: 'instagram_business' | 'facebook_page'
}) {
  const router = useRouter()

  const handleConnect = () => {
    // Build OAuth initiation URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const oauthUrl = `${baseUrl}/api/v1/plugin/social-media-publisher/social/connect?platform=${platform}&clientId=${clientId}`

    // Open popup window
    const popup = window.open(
      oauthUrl,
      'oauth-popup',
      'width=600,height=700,scrollbars=yes'
    )

    // Listen for success message from popup
    const handleMessage = (event: MessageEvent) => {
      // Verify origin
      if (event.origin !== window.location.origin) return

      if (event.data.type === 'oauth-success') {
        console.log(`✅ Connected ${event.data.connectedCount} account(s)`)
        
        // Cleanup
        window.removeEventListener('message', handleMessage)
        
        // Refresh to show new accounts
        router.refresh()
      }
    }

    window.addEventListener('message', handleMessage)

    // Cleanup if popup closes without success
    const checkPopup = setInterval(() => {
      if (popup?.closed) {
        clearInterval(checkPopup)
        window.removeEventListener('message', handleMessage)
      }
    }, 1000)
  }

  return (
    <button onClick={handleConnect}>
      Connect {platform === 'instagram_business' ? 'Instagram' : 'Facebook Page'}
    </button>
  )
}
```

### Step 2: Generate OAuth URL

**Endpoint:** `GET /api/v1/plugin/social-media-publisher/social/connect`

**Query Parameters:**
- `platform` - `'instagram_business'` or `'facebook_page'`
- `clientId` - UUID of client to connect accounts to

**What Happens:**
1. Generates random state value (CSRF protection)
2. Constructs state parameter: `{randomState}&platform={platform}&clientId={clientId}`
3. Builds Facebook OAuth URL with required scopes
4. Redirects user to Facebook authorization page

**OAuth URL Format:**
```
https://www.facebook.com/v18.0/dialog/oauth
  ?client_id={FACEBOOK_CLIENT_ID}
  &redirect_uri={callback_url}
  &state={encoded_state}
  &scope={permissions}
```

**Scopes for Instagram Business:**
```
pages_show_list,instagram_basic,instagram_content_publish,instagram_manage_insights
```

**Scopes for Facebook Pages:**
```
pages_show_list,pages_manage_posts,pages_read_engagement,read_insights
```

### Step 3: User Authorization

**What User Sees:**
1. Facebook authorization page opens in popup
2. Shows app name, icon, and requested permissions
3. User can choose which Pages to grant access to
4. User clicks "Continue" or "Cancel"

**User Can:**
- ✅ Grant all permissions
- ✅ Grant partial permissions (select specific Pages)
- ❌ Deny all permissions

### Step 4: OAuth Callback

**Endpoint:** `GET /api/v1/plugin/social-media-publisher/social/connect/callback`

**Success Parameters:**
```
code: Authorization code from Facebook
state: CSRF token + platform + clientId
```

**Error Parameters:**
```
error: Error code (e.g., 'access_denied')
error_description: Human-readable error
```

**Callback Processing:**

1. **Validate State Parameter:**
   ```typescript
   const [randomState, platformParam, clientIdParam] = state.split('&')
   // Verify state matches expected format
   ```

2. **Exchange Code for Access Token:**
   ```typescript
   const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token`
   const params = new URLSearchParams({
     client_id: FACEBOOK_CLIENT_ID,
     client_secret: FACEBOOK_CLIENT_SECRET,
     redirect_uri: callbackUrl,
     code: authorizationCode
   })
   
   const response = await fetch(`${tokenUrl}?${params.toString()}`)
   const { access_token } = await response.json()
   ```

3. **Fetch User's Facebook Pages:**
   ```typescript
   const pages = await FacebookAPI.getUserPages(access_token)
   // Returns array of Pages with Page-specific tokens
   ```

4. **For Each Page:**
   ```typescript
   if (platform === 'instagram_business') {
     // Check if Page has Instagram Business Account
     const igAccount = await FacebookAPI.getInstagramBusinessAccount(
       page.id,
       page.accessToken
     )
     
     if (igAccount) {
       await saveToDatabase({
         parentId: clientId,
         platform: 'instagram_business',
         platformAccountId: igAccount.id,
         platformAccountName: igAccount.username,
         accessToken: await encrypt(page.accessToken),
         ...
       })
     }
   } else {
     // Save Facebook Page directly
     await saveToDatabase({
       parentId: clientId,
       platform: 'facebook_page',
       platformAccountId: page.id,
       platformAccountName: page.name,
       accessToken: await encrypt(page.accessToken),
       ...
     })
   }
   ```

5. **Encrypt and Store Tokens:**
   ```typescript
   // Encrypt access token
   const { encrypted, iv, keyId } = await TokenEncryption.encrypt(accessToken)
   const encryptedToken = `${encrypted}:${iv}:${keyId}`
   
   // Calculate expiration (60 days for long-lived tokens)
   const expiresAt = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000)
   
   // Store in database
   await query(`
     INSERT INTO "clients_social_platforms" (
       "parentId", platform, "platformAccountId", 
       "platformAccountName", "accessToken", "tokenExpiresAt"
     ) VALUES ($1, $2, $3, $4, $5, $6)
   `, [clientId, platform, accountId, accountName, encryptedToken, expiresAt])
   ```

6. **Create Audit Log:**
   ```typescript
   await query(`
     INSERT INTO "audit_logs" (
       "userId", "accountId", action, details
     ) VALUES ($1, $2, 'account_connected', $3)
   `, [userId, accountId, { platform, accountName }])
   ```

7. **Return Success HTML:**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <title>Authorization Successful</title>
   </head>
   <body>
     <h1>✅ Successfully Connected</h1>
     <p>Connected 2 Instagram Business account(s)</p>
     <p>This window will close automatically...</p>
     <script>
       // Send success message to parent window
       window.opener.postMessage({
         type: 'oauth-success',
         platform: 'instagram_business',
         connectedCount: 2
       }, window.location.origin)
       
       // Auto-close after 2 seconds
       setTimeout(() => window.close(), 2000)
     </script>
   </body>
   </html>
   ```

### Step 5: PostMessage Communication

**Popup Window:**
```javascript
// Send message to parent window
window.opener.postMessage({
  type: 'oauth-success',
  platform: 'instagram_business',
  connectedCount: 2
}, window.location.origin)
```

**Parent Window:**
```javascript
window.addEventListener('message', (event) => {
  // Verify origin (security)
  if (event.origin !== window.location.origin) return

  if (event.data.type === 'oauth-success') {
    // Refresh page to show new accounts
    router.refresh()
  }
})
```

## Security Features

### CSRF Protection (State Parameter)

**State Format:**
```
{randomString}&platform={platform}&clientId={clientId}

Example:
a7f9b2c8d1e3f4a5&platform=instagram_business&clientId=550e8400-e29b-41d4-a716-446655440000
```

**Validation:**
1. Generate random state before redirect
2. Include platform and clientId in state
3. Facebook returns state unchanged
4. Verify state format and extract data
5. Reject if state is invalid

### Token Encryption

**All tokens encrypted before storage:**
```typescript
// Plain text token from Facebook
const accessToken = "EAABwzLixnjY..."

// Encrypt
const { encrypted, iv, keyId } = await TokenEncryption.encrypt(accessToken)

// Store format: encrypted:iv:keyId
const storedToken = `${encrypted}:${iv}:${keyId}`
```

**Decryption (only when needed):**
```typescript
const [encrypted, iv, keyId] = storedToken.split(':')
const decryptedToken = await TokenEncryption.decrypt(encrypted, iv, keyId)
// Use for API call
// Never log or store decrypted token
```

### Origin Validation

**PostMessage security:**
```javascript
window.addEventListener('message', (event) => {
  // ✅ Validate origin
  if (event.origin !== window.location.origin) {
    console.warn('Rejected message from untrusted origin:', event.origin)
    return
  }

  // Process message
})
```

## Error Handling

### User Denies Permission

**Error Response:**
```
?error=access_denied
&error_description=The+user+denied+your+request
```

**Handling:**
```typescript
if (error === 'access_denied') {
  return NextResponse.html(`
    <html>
      <body>
        <h1>Authorization Cancelled</h1>
        <p>You chose not to connect your account.</p>
        <button onclick="window.close()">Close</button>
      </body>
    </html>
  `)
}
```

### Invalid OAuth Code

**Cause:** Code expired or already used

**Solution:** Restart OAuth flow

### No Instagram Account Found

**Cause:** Facebook Page not linked to Instagram Business

**Solution:**
1. Show clear error message
2. Provide link to Facebook Page settings
3. Guide user to connect Instagram

**Error HTML:**
```html
<html>
  <body>
    <h1>⚠️ No Instagram Business Account Found</h1>
    <p>None of your Facebook Pages have an Instagram Business Account connected.</p>
    <h3>How to Connect Instagram:</h3>
    <ol>
      <li>Go to your Facebook Page Settings</li>
      <li>Click "Instagram" in the sidebar</li>
      <li>Click "Connect Account"</li>
      <li>Log in to Instagram and authorize</li>
      <li>Try connecting again</li>
    </ol>
    <button onclick="window.close()">Close</button>
  </body>
</html>
```

## Multi-Account Support

### Connecting Multiple Accounts

**Same Platform, Different Accounts:**
```typescript
// User connects Instagram account @brand1
// Then connects Instagram account @brand2
// Both stored under same client
```

**Database:**
```sql
SELECT * FROM "clients_social_platforms" WHERE "parentId" = '{clientId}'

-- Results:
id | platform | platformAccountName | isActive
---|----------|---------------------|----------
1  | instagram_business | @brand1 | true
2  | instagram_business | @brand2 | true
```

### Preventing Duplicates

**Unique Constraint:**
```sql
UNIQUE("parentId", "platformAccountId") 
WHERE "platformAccountId" IS NOT NULL
```

**On Duplicate:**
- Update existing record
- Refresh token
- Update metadata
- Don't create new record

## Next Steps

- **[Publishing](./02-publishing.md)** - Use connected accounts to publish
- **[Token Management](./03-token-management.md)** - Understand token lifecycle
- **[Audit Logging](./04-audit-logging.md)** - Track all OAuth events
