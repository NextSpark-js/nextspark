# Custom Integrations

## Overview

The Social Media Publisher plugin provides flexible building blocks that allow you to create custom publishing workflows, scheduled posts, analytics dashboards, and content management integrations. This guide shows you how to extend the plugin's capabilities.

**What You Can Build:**
- Batch publishing systems
- Scheduled post queues
- Cross-posting automation
- Analytics dashboards
- Content approval workflows
- Custom publishing endpoints

## Building Custom Endpoints

### Custom Publishing Endpoint

Create a custom endpoint with additional business logic:

```typescript
// app/api/v1/custom/publish-with-approval/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { authenticateRequest } from '@/core/lib/api/auth/dual-auth'
import { InstagramAPI, FacebookAPI } from '@/contents/plugins/social-media-publisher/lib/providers'
import { TokenEncryption } from '@/core/lib/oauth/encryption'
import { query } from '@/core/lib/db'

export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { accountId, imageUrl, caption, requireApproval } = await request.json()

  // Custom business logic: Check if approval needed
  if (requireApproval) {
    // Save to pending queue
    await query(`
      INSERT INTO "pending_posts" (
        "accountId", "imageUrl", caption, "createdBy", status
      ) VALUES ($1, $2, $3, $4, 'pending_approval')
    `, [accountId, imageUrl, caption, authResult.user!.id])

    return NextResponse.json({
      success: true,
      status: 'pending_approval',
      message: 'Post submitted for approval'
    })
  }

  // Direct publish (no approval needed)
  const account = await getAccount(accountId)
  const token = await decryptToken(account.accessToken)

  const result = account.platform === 'instagram_business'
    ? await InstagramAPI.publishPhoto({
        igAccountId: account.platformAccountId,
        accessToken: token,
        imageUrl,
        caption
      })
    : await FacebookAPI.publishPhotoPost({
        pageId: account.platformAccountId,
        pageAccessToken: token,
        message: caption,
        imageUrl
      })

  return NextResponse.json(result)
}
```

### Approval System Endpoint

Approve and publish pending posts:

```typescript
// app/api/v1/custom/approve-post/[postId]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> }
) {
  const { postId } = await params
  const authResult = await authenticateRequest(request)

  // Check if user has approval permission
  if (!hasApprovalPermission(authResult.user!.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Get pending post
  const post = await query(`
    SELECT * FROM "pending_posts"
    WHERE id = $1 AND status = 'pending_approval'
  `, [postId])

  if (post.rowCount === 0) {
    return NextResponse.json({ error: 'Post not found' }, { status: 404 })
  }

  const postData = post.rows[0]

  // Publish the post
  const account = await getAccount(postData.accountId)
  const token = await decryptToken(account.accessToken)

  const result = await publishToAccount(account, token, {
    imageUrl: postData.imageUrl,
    caption: postData.caption
  })

  if (result.success) {
    // Update status
    await query(`
      UPDATE "pending_posts"
      SET status = 'published',
          "publishedAt" = NOW(),
          "approvedBy" = $1,
          "postId" = $2
      WHERE id = $3
    `, [authResult.user!.id, result.postId, postId])
  }

  return NextResponse.json(result)
}
```

## Scheduled Publishing

### Database Schema for Scheduled Posts

```sql
CREATE TABLE "scheduled_posts" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL REFERENCES "clients_social_platforms"(id),
  "scheduledFor" TIMESTAMPTZ NOT NULL,
  "imageUrl" TEXT NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'scheduled', -- 'scheduled', 'publishing', 'published', 'failed'
  "postId" TEXT,
  "postUrl" TEXT,
  "createdBy" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "publishedAt" TIMESTAMPTZ,
  error TEXT
);

CREATE INDEX "idx_scheduled_posts_scheduledFor" 
  ON "scheduled_posts"("scheduledFor") 
  WHERE status = 'scheduled';
```

### Schedule Endpoint

```typescript
// app/api/v1/custom/schedule-post/route.ts
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { accountId, imageUrl, caption, scheduledFor } = await request.json()

  // Validate scheduled time is in future
  const scheduledDate = new Date(scheduledFor)
  if (scheduledDate <= new Date()) {
    return NextResponse.json(
      { error: 'Scheduled time must be in the future' },
      { status: 400 }
    )
  }

  // Save scheduled post
  const result = await query(`
    INSERT INTO "scheduled_posts" (
      "accountId", "scheduledFor", "imageUrl", caption, "createdBy"
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [accountId, scheduledDate, imageUrl, caption, authResult.user!.id])

  return NextResponse.json({
    success: true,
    scheduledPostId: result.rows[0].id,
    scheduledFor: scheduledDate.toISOString()
  })
}
```

### Cron Job to Process Scheduled Posts

```typescript
// app/api/cron/process-scheduled-posts/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { query } from '@/core/lib/db'
import { publishScheduledPost } from '@/lib/scheduled-posts'

export async function GET(request: NextRequest) {
  // Verify cron secret (Vercel Cron)
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get posts ready to publish (within next 5 minutes)
  const posts = await query(`
    SELECT * FROM "scheduled_posts"
    WHERE status = 'scheduled'
    AND "scheduledFor" <= NOW() + INTERVAL '5 minutes'
    ORDER BY "scheduledFor" ASC
    LIMIT 10
  `)

  const results = []

  for (const post of posts.rows) {
    // Mark as publishing
    await query(`
      UPDATE "scheduled_posts"
      SET status = 'publishing'
      WHERE id = $1
    `, [post.id])

    try {
      // Publish
      const result = await publishScheduledPost(post)

      if (result.success) {
        // Mark as published
        await query(`
          UPDATE "scheduled_posts"
          SET status = 'published',
              "publishedAt" = NOW(),
              "postId" = $1,
              "postUrl" = $2
          WHERE id = $3
        `, [result.postId, result.postUrl, post.id])

        results.push({ id: post.id, success: true })
      } else {
        // Mark as failed
        await query(`
          UPDATE "scheduled_posts"
          SET status = 'failed',
              error = $1
          WHERE id = $2
        `, [result.error, post.id])

        results.push({ id: post.id, success: false, error: result.error })
      }
    } catch (error) {
      // Mark as failed
      await query(`
        UPDATE "scheduled_posts"
        SET status = 'failed',
            error = $1
        WHERE id = $2
      `, [error instanceof Error ? error.message : 'Unknown error', post.id])

      results.push({ id: post.id, success: false, error: String(error) })
    }
  }

  return NextResponse.json({
    success: true,
    processed: results.length,
    results
  })
}

// Helper function
async function publishScheduledPost(post: any) {
  const account = await getAccount(post.accountId)
  const token = await decryptToken(account.accessToken)

  if (account.platform === 'instagram_business') {
    return await InstagramAPI.publishPhoto({
      igAccountId: account.platformAccountId,
      accessToken: token,
      imageUrl: post.imageUrl,
      caption: post.caption
    })
  } else {
    return await FacebookAPI.publishPhotoPost({
      pageId: account.platformAccountId,
      pageAccessToken: token,
      message: post.caption,
      imageUrl: post.imageUrl
    })
  }
}
```

### Vercel Cron Configuration

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/process-scheduled-posts",
      "schedule": "*/5 * * * *"
    }
  ]
}
```

## Cross-Posting Automation

### Publish to Multiple Accounts at Once

```typescript
// app/api/v1/custom/cross-post/route.ts
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { accountIds, imageUrl, caption } = await request.json()

  // Validate user has access to all accounts
  const accounts = await query(`
    SELECT csp.*
    FROM "clients_social_platforms" csp
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE csp.id = ANY($1)
    AND c."userId" = $2
    AND csp."isActive" = true
  `, [accountIds, authResult.user!.id])

  if (accounts.rowCount !== accountIds.length) {
    return NextResponse.json(
      { error: 'Access denied to one or more accounts' },
      { status: 403 }
    )
  }

  // Publish to all accounts
  const results = await Promise.allSettled(
    accounts.rows.map(async (account) => {
      const token = await decryptToken(account.accessToken)

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

  const successful = results.filter(r => 
    r.status === 'fulfilled' && r.value.success
  )
  const failed = results.filter(r => 
    r.status === 'rejected' || (r.status === 'fulfilled' && !r.value.success)
  )

  return NextResponse.json({
    success: successful.length > 0,
    total: accountIds.length,
    successful: successful.length,
    failed: failed.length,
    results: results.map((r, i) => ({
      accountId: accountIds[i],
      accountName: accounts.rows[i].platformAccountName,
      status: r.status === 'fulfilled' && r.value.success ? 'published' : 'failed',
      postUrl: r.status === 'fulfilled' ? r.value.postUrl : null,
      error: r.status === 'rejected' 
        ? r.reason 
        : (r.status === 'fulfilled' && !r.value.success ? r.value.error : null)
    }))
  })
}
```

## Analytics Dashboard Integration

### Aggregate Analytics Endpoint

```typescript
// app/api/v1/custom/analytics/summary/route.ts
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')

  // Get all active accounts for client
  const accounts = await query(`
    SELECT csp.*
    FROM "clients_social_platforms" csp
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE csp."parentId" = $1
    AND c."userId" = $2
    AND csp."isActive" = true
  `, [clientId, authResult.user!.id])

  const analytics = await Promise.all(
    accounts.rows.map(async (account) => {
      const token = await decryptToken(account.accessToken)

      try {
        if (account.platform === 'instagram_business') {
          const insights = await InstagramAPI.getAccountInsights(
            account.platformAccountId,
            token
          )
          
          return {
            accountId: account.id,
            accountName: account.platformAccountName,
            platform: account.platform,
            ...insights
          }
        } else {
          const insights = await FacebookAPI.getPageInsights(
            account.platformAccountId,
            token
          )
          
          return {
            accountId: account.id,
            accountName: account.platformAccountName,
            platform: account.platform,
            ...insights
          }
        }
      } catch (error) {
        return {
          accountId: account.id,
          accountName: account.platformAccountName,
          platform: account.platform,
          error: error instanceof Error ? error.message : 'Failed to fetch insights'
        }
      }
    })
  )

  // Calculate totals
  const totals = analytics.reduce((acc, curr) => {
    if (!curr.error) {
      acc.impressions += curr.impressions || 0
      acc.reach += curr.reach || 0
      acc.engagement += curr.engagement || 0
    }
    return acc
  }, { impressions: 0, reach: 0, engagement: 0 })

  return NextResponse.json({
    success: true,
    totals,
    accounts: analytics
  })
}
```

### Publish History Dashboard

```typescript
// app/api/v1/custom/analytics/publish-history/route.ts
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const days = parseInt(searchParams.get('days') || '30')

  // Get publish history from audit logs
  const history = await query(`
    SELECT 
      DATE(al."createdAt") as date,
      al.details->>'platform' as platform,
      COUNT(*) FILTER (WHERE al.action = 'post_published') as successful,
      COUNT(*) FILTER (WHERE al.action = 'post_failed') as failed,
      array_agg(DISTINCT al."accountId") as account_ids
    FROM "audit_logs" al
    WHERE al."userId" = $1
    AND al.action IN ('post_published', 'post_failed')
    AND al."createdAt" > NOW() - INTERVAL '${days} days'
    GROUP BY DATE(al."createdAt"), al.details->>'platform'
    ORDER BY date DESC
  `, [authResult.user!.id])

  return NextResponse.json({
    success: true,
    period: `${days} days`,
    history: history.rows
  })
}
```

## Content Management Integration

### Save Post as Template

```typescript
// app/api/v1/custom/templates/save/route.ts
export async function POST(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, caption, imageUrl, tags } = await request.json()

  const result = await query(`
    INSERT INTO "post_templates" (
      name, caption, "imageUrl", tags, "createdBy"
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [name, caption, imageUrl, tags, authResult.user!.id])

  return NextResponse.json({
    success: true,
    templateId: result.rows[0].id
  })
}
```

### Use Template to Publish

```typescript
// app/api/v1/custom/templates/publish/[templateId]/route.ts
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ templateId: string }> }
) {
  const { templateId } = await params
  const authResult = await authenticateRequest(request)
  const { accountId, customCaption } = await request.json()

  // Get template
  const template = await query(`
    SELECT * FROM "post_templates"
    WHERE id = $1
  `, [templateId])

  if (template.rowCount === 0) {
    return NextResponse.json({ error: 'Template not found' }, { status: 404 })
  }

  const { imageUrl, caption } = template.rows[0]
  const finalCaption = customCaption || caption

  // Publish using template
  const account = await getAccount(accountId)
  const token = await decryptToken(account.accessToken)

  const result = await publishToAccount(account, token, {
    imageUrl,
    caption: finalCaption
  })

  return NextResponse.json(result)
}
```

## Webhook Integration

### Receive Notifications from Meta

```typescript
// app/api/webhooks/meta/route.ts
export async function POST(request: NextRequest) {
  const signature = request.headers.get('x-hub-signature-256')
  const body = await request.text()

  // Verify signature
  if (!verifyWebhookSignature(signature, body)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const event = JSON.parse(body)

  // Handle different event types
  for (const entry of event.entry) {
    for (const change of entry.changes) {
      if (change.field === 'feed') {
        // Post published or updated
        await handleFeedChange(change.value)
      } else if (change.field === 'comments') {
        // New comment
        await handleNewComment(change.value)
      }
    }
  }

  return NextResponse.json({ success: true })
}

// Verification endpoint (GET)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('hub.mode')
  const token = searchParams.get('hub.verify_token')
  const challenge = searchParams.get('hub.challenge')

  if (mode === 'subscribe' && token === process.env.WEBHOOK_VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 })
  }

  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

## Best Practices

### Do's ✅

**1. Validate Permissions:**
```typescript
// Always check user has access to resources
const hasAccess = await checkUserAccessToAccount(userId, accountId)
if (!hasAccess) throw new Error('Access denied')
```

**2. Handle Failures Gracefully:**
```typescript
// Don't fail entire batch if one post fails
const results = await Promise.allSettled(publishOperations)
```

**3. Rate Limit Custom Endpoints:**
```typescript
// Implement rate limiting
const rateLimit = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500,
})

await rateLimit.check(request, 10, userId) // 10 requests per minute
```

**4. Audit Custom Actions:**
```typescript
// Log custom operations
await logAudit('custom_bulk_publish', {
  accountCount: accountIds.length,
  successful: results.successful,
  failed: results.failed
})
```

### Don'ts ❌

**1. Don't Skip Token Validation:**
```typescript
// ❌ Bad
const token = await decryptToken(account.accessToken)
await publishDirectly(token)

// ✅ Good
if (isTokenExpired(account.tokenExpiresAt)) {
  await refreshToken(account.id)
}
const token = await decryptToken(account.accessToken)
```

**2. Don't Expose Internal Errors:**
```typescript
// ❌ Bad
catch (error) {
  return NextResponse.json({ error: error.stack })
}

// ✅ Good
catch (error) {
  console.error('Internal error:', error)
  return NextResponse.json({ error: 'Publishing failed' })
}
```

## Next Steps

- **[Provider APIs](./01-provider-apis.md)** - API wrappers reference
- **[Per-Client Architecture](./03-per-client-architecture.md)** - Understand data model
- **[Agency Management](../04-use-cases/01-agency-management.md)** - Real-world examples
