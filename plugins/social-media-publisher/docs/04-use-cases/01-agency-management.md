# Agency Management Use Case

## Overview

This guide demonstrates how a **social media agency** can use the Social Media Publisher plugin to manage multiple client social accounts, handle publishing workflows, track activity, and maintain compliance.

**Agency Profile:**
- Name: Social Media Pro Agency
- Clients: 50+ businesses
- Team: 10 social media managers
- Accounts Managed: 150+ Instagram/Facebook accounts
- Posts/Month: 1,000+ across all clients

## Agency Setup

### 1. Client Onboarding

**Scenario:** New client "Acme Corp" signs up for social media management.

**Steps:**

**Create Client Record:**
```typescript
// app/actions/clients/create-client.ts
'use server'

import { auth } from '@/core/lib/auth'
import { query } from '@/core/lib/db'

export async function createClient(data: {
  name: string
  email: string
  website?: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session?.user) throw new Error('Unauthorized')

  const result = await query(`
    INSERT INTO "clients" (
      "userId", name, slug, email, status
    ) VALUES ($1, $2, $3, $4, 'active')
    RETURNING id
  `, [
    session.user.id,
    data.name,
    data.name.toLowerCase().replace(/\s+/g, '-'),
    data.email
  ])

  return { clientId: result.rows[0].id }
}
```

**Connect Social Accounts:**
```typescript
// Client detail page component
'use client'

export function ClientSocialAccounts({ clientId }: { clientId: string }) {
  const handleConnectInstagram = () => {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin
    const oauthUrl = `${baseUrl}/api/v1/plugin/social-media-publisher/social/connect?platform=instagram_business&clientId=${clientId}`
    
    const popup = window.open(oauthUrl, 'oauth-popup', 'width=600,height=700')
    
    window.addEventListener('message', (event) => {
      if (event.origin !== window.location.origin) return
      
      if (event.data.type === 'oauth-success') {
        toast.success(`Connected ${event.data.connectedCount} account(s)`)
        router.refresh()
      }
    })
  }

  return (
    <div>
      <h2>Social Media Accounts</h2>
      <button onClick={handleConnectInstagram}>
        Connect Instagram Business
      </button>
      <button onClick={() => handleConnectPlatform('facebook_page')}>
        Connect Facebook Page
      </button>
    </div>
  )
}
```

**Result:**
- Client record created
- OAuth popup opens
- Client connects @acmecorp Instagram
- Account saved to database
- Agency can now publish to @acmecorp

### 2. Team Structure

**Roles:**
- **Agency Owner** - Full access to all clients
- **Account Manager** - Manages specific clients
- **Content Creator** - Creates content, submits for approval
- **Social Media Manager** - Publishes approved content

**Implementation (Optional Extension):**
```sql
-- Add team member access control
CREATE TABLE "client_collaborators" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clientId" UUID NOT NULL REFERENCES "clients"(id),
  "userId" TEXT NOT NULL,
  role TEXT NOT NULL, -- 'owner', 'manager', 'creator', 'viewer'
  "createdAt" TIMESTAMPTZ DEFAULT now()
);

-- Check if user has access to client
CREATE FUNCTION can_access_client(
  p_user_id TEXT,
  p_client_id UUID
) RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM "clients"
    WHERE id = p_client_id AND "userId" = p_user_id
  ) OR EXISTS (
    SELECT 1 FROM "client_collaborators"
    WHERE "clientId" = p_client_id AND "userId" = p_user_id
  );
END;
$$ LANGUAGE plpgsql;
```

## Daily Workflows

### Morning: Review Client Dashboard

**Agency Dashboard Component:**
```typescript
// app/dashboard/agency/page.tsx
import { getAgencyDashboard } from '@/lib/agency'

export default async function AgencyDashboardPage() {
  const dashboard = await getAgencyDashboard()

  return (
    <div>
      <h1>Agency Dashboard</h1>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-4 gap-4">
        <Card>
          <CardHeader>Total Clients</CardHeader>
          <CardContent>{dashboard.totalClients}</CardContent>
        </Card>
        <Card>
          <CardHeader>Active Accounts</CardHeader>
          <CardContent>{dashboard.activeAccounts}</CardContent>
        </Card>
        <Card>
          <CardHeader>Posts Today</CardHeader>
          <CardContent>{dashboard.postsToday}</CardContent>
        </Card>
        <Card>
          <CardHeader>Expiring Tokens</CardHeader>
          <CardContent className="text-red-600">
            {dashboard.expiringTokens}
          </CardContent>
        </Card>
      </div>

      {/* Client List */}
      <div className="mt-8">
        <h2>Clients</h2>
        {dashboard.clients.map(client => (
          <div key={client.id} className="border p-4 mb-2">
            <h3>{client.name}</h3>
            <p>
              {client.instagramCount} Instagram · {client.facebookCount} Facebook
            </p>
            <Link href={`/dashboard/clients/${client.id}`}>
              Manage →
            </Link>
          </div>
        ))}
      </div>
    </div>
  )
}

// lib/agency.ts
export async function getAgencyDashboard() {
  const session = await auth.api.getSession({ headers: await headers() })
  
  // Get all clients with account counts
  const clients = await query(`
    SELECT 
      c.*,
      COUNT(csp.id) FILTER (WHERE csp.platform = 'instagram_business' AND csp."isActive" = true) as "instagramCount",
      COUNT(csp.id) FILTER (WHERE csp.platform = 'facebook_page' AND csp."isActive" = true) as "facebookCount"
    FROM "clients" c
    LEFT JOIN "clients_social_platforms" csp ON csp."parentId" = c.id
    WHERE c."userId" = $1
    GROUP BY c.id
    ORDER BY c.name
  `, [session.user.id])

  // Get today's posts
  const postsToday = await query(`
    SELECT COUNT(*) as count
    FROM "audit_logs"
    WHERE "userId" = $1
    AND action = 'post_published'
    AND "createdAt"::date = CURRENT_DATE
  `, [session.user.id])

  // Get expiring tokens (< 7 days)
  const expiringTokens = await query(`
    SELECT COUNT(*) as count
    FROM "clients_social_platforms" csp
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE c."userId" = $1
    AND csp."tokenExpiresAt" < NOW() + INTERVAL '7 days'
    AND csp."isActive" = true
  `, [session.user.id])

  return {
    totalClients: clients.rowCount,
    activeAccounts: clients.rows.reduce((sum, c) => 
      sum + c.instagramCount + c.facebookCount, 0
    ),
    postsToday: postsToday.rows[0].count,
    expiringTokens: expiringTokens.rows[0].count,
    clients: clients.rows
  }
}
```

### Content Creation & Publishing

**Scenario:** Social media manager needs to publish content for 3 clients.

**Bulk Publishing Interface:**
```typescript
// app/dashboard/publish/page.tsx
'use client'

export default function BulkPublishPage() {
  const [selectedClients, setSelectedClients] = useState<string[]>([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)

  const handlePublish = async () => {
    setPublishing(true)

    const response = await fetch('/api/v1/custom/cross-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountIds: selectedAccounts,
        imageUrl,
        caption
      })
    })

    const result = await response.json()
    
    toast.success(`Published to ${result.successful}/${result.total} accounts`)
    
    setPublishing(false)
  }

  return (
    <div>
      <h1>Bulk Publishing</h1>

      {/* Client Selector */}
      <div>
        <h2>Select Clients</h2>
        <ClientMultiSelect 
          onChange={setSelectedClients}
        />
      </div>

      {/* Account Selector */}
      <div>
        <h2>Select Accounts</h2>
        <AccountMultiSelect 
          clientIds={selectedClients}
          onChange={setSelectedAccounts}
        />
      </div>

      {/* Content Input */}
      <div>
        <h2>Content</h2>
        <input
          type="url"
          placeholder="Image URL"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
        />
        <textarea
          placeholder="Caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={2200}
        />
      </div>

      {/* Publish Button */}
      <button 
        onClick={handlePublish}
        disabled={publishing || selectedAccounts.length === 0}
      >
        {publishing 
          ? 'Publishing...' 
          : `Publish to ${selectedAccounts.length} account(s)`
        }
      </button>
    </div>
  )
}
```

### Afternoon: Review Analytics

**Client Performance Report:**
```typescript
// app/dashboard/clients/[clientId]/analytics/page.tsx
export default async function ClientAnalyticsPage({
  params
}: {
  params: Promise<{ clientId: string }>
}) {
  const { clientId } = await params
  const analytics = await getClientAnalytics(clientId)

  return (
    <div>
      <h1>{analytics.client.name} - Analytics</h1>

      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader>Total Posts (30 days)</CardHeader>
          <CardContent>{analytics.totalPosts}</CardContent>
        </Card>
        <Card>
          <CardHeader>Total Impressions</CardHeader>
          <CardContent>{analytics.totalImpressions.toLocaleString()}</CardContent>
        </Card>
        <Card>
          <CardHeader>Engagement Rate</CardHeader>
          <CardContent>
            {((analytics.totalEngagement / analytics.totalReach) * 100).toFixed(2)}%
          </CardContent>
        </Card>
      </div>

      {/* Per-Account Breakdown */}
      <div className="mt-8">
        <h2>Account Performance</h2>
        {analytics.accounts.map(account => (
          <div key={account.id} className="border p-4 mb-2">
            <h3>{account.platformAccountName}</h3>
            <div className="grid grid-cols-4 gap-2">
              <div>
                <small>Posts</small>
                <p>{account.postCount}</p>
              </div>
              <div>
                <small>Impressions</small>
                <p>{account.impressions.toLocaleString()}</p>
              </div>
              <div>
                <small>Engagement</small>
                <p>{account.engagement}</p>
              </div>
              <div>
                <small>Followers</small>
                <p>{account.followersCount.toLocaleString()}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// lib/analytics.ts
async function getClientAnalytics(clientId: string) {
  // Get client
  const client = await query(`
    SELECT * FROM "clients" WHERE id = $1
  `, [clientId])

  // Get social accounts
  const accounts = await query(`
    SELECT * FROM "clients_social_platforms"
    WHERE "parentId" = $1 AND "isActive" = true
  `, [clientId])

  // Get post count from audit logs
  const postStats = await query(`
    SELECT 
      al."accountId",
      COUNT(*) as post_count
    FROM "audit_logs" al
    WHERE al."accountId" = ANY($1)
    AND al.action = 'post_published'
    AND al."createdAt" > NOW() - INTERVAL '30 days'
    GROUP BY al."accountId"
  `, [accounts.rows.map(a => a.id)])

  // Fetch insights from APIs
  const accountsWithInsights = await Promise.all(
    accounts.rows.map(async (account) => {
      const token = await decryptToken(account.accessToken)
      
      try {
        const insights = account.platform === 'instagram_business'
          ? await InstagramAPI.getAccountInsights(account.platformAccountId, token)
          : await FacebookAPI.getPageInsights(account.platformAccountId, token)

        const postCount = postStats.rows.find(p => p.accountId === account.id)?.post_count || 0

        return {
          ...account,
          ...insights,
          postCount
        }
      } catch (error) {
        return {
          ...account,
          error: 'Failed to fetch insights',
          postCount: 0
        }
      }
    })
  )

  return {
    client: client.rows[0],
    totalPosts: accountsWithInsights.reduce((sum, a) => sum + a.postCount, 0),
    totalImpressions: accountsWithInsights.reduce((sum, a) => sum + (a.impressions || 0), 0),
    totalReach: accountsWithInsights.reduce((sum, a) => sum + (a.reach || 0), 0),
    totalEngagement: accountsWithInsights.reduce((sum, a) => sum + (a.engagement || 0), 0),
    accounts: accountsWithInsights
  }
}
```

## Compliance & Reporting

### Monthly Client Reports

**Generate PDF Report:**
```typescript
// lib/reports/client-report.ts
import { jsPDF } from 'jspdf'

export async function generateClientReport(
  clientId: string,
  month: string // 'YYYY-MM'
) {
  const analytics = await getClientAnalyticsForMonth(clientId, month)
  const posts = await getClientPostsForMonth(clientId, month)
  
  const doc = new jsPDF()
  
  // Cover Page
  doc.setFontSize(24)
  doc.text(`${analytics.client.name}`, 20, 30)
  doc.setFontSize(16)
  doc.text(`Social Media Report - ${month}`, 20, 45)
  
  // Summary
  doc.setFontSize(14)
  doc.text('Summary', 20, 70)
  doc.setFontSize(12)
  doc.text(`Total Posts: ${analytics.totalPosts}`, 20, 85)
  doc.text(`Total Impressions: ${analytics.totalImpressions.toLocaleString()}`, 20, 95)
  doc.text(`Total Engagement: ${analytics.totalEngagement}`, 20, 105)
  doc.text(`Engagement Rate: ${analytics.engagementRate}%`, 20, 115)
  
  // Account Breakdown
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Account Performance', 20, 30)
  
  let y = 45
  analytics.accounts.forEach(account => {
    doc.setFontSize(12)
    doc.text(`${account.platformAccountName} (${account.platform})`, 20, y)
    doc.setFontSize(10)
    doc.text(`Posts: ${account.postCount}`, 30, y + 8)
    doc.text(`Impressions: ${account.impressions.toLocaleString()}`, 30, y + 16)
    doc.text(`Engagement: ${account.engagement}`, 30, y + 24)
    y += 40
    
    if (y > 250) {
      doc.addPage()
      y = 30
    }
  })
  
  // Top Posts
  doc.addPage()
  doc.setFontSize(14)
  doc.text('Top Performing Posts', 20, 30)
  
  y = 45
  posts.slice(0, 5).forEach((post, i) => {
    doc.setFontSize(12)
    doc.text(`${i + 1}. ${post.caption.substring(0, 50)}...`, 20, y)
    doc.setFontSize(10)
    doc.text(`Engagement: ${post.engagement} · ${new Date(post.publishedAt).toLocaleDateString()}`, 30, y + 8)
    y += 25
  })
  
  // Save
  doc.save(`${analytics.client.slug}-report-${month}.pdf`)
}
```

### Audit Trail for Compliance

**Export All Activity:**
```typescript
// app/api/v1/custom/export-audit-log/route.ts
export async function GET(request: NextRequest) {
  const authResult = await authenticateRequest(request)
  if (!authResult.success) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const clientId = searchParams.get('clientId')
  const startDate = searchParams.get('startDate')
  const endDate = searchParams.get('endDate')

  // Get audit logs
  const logs = await query(`
    SELECT 
      al.*,
      csp."platformAccountName",
      c.name as "clientName"
    FROM "audit_logs" al
    JOIN "clients_social_platforms" csp ON csp.id = al."accountId"
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE c.id = $1
    AND c."userId" = $2
    AND al."createdAt" BETWEEN $3 AND $4
    ORDER BY al."createdAt" DESC
  `, [clientId, authResult.user!.id, startDate, endDate])

  // Convert to CSV
  const csv = [
    'Date,Time,User,Client,Account,Action,Details,IP Address',
    ...logs.rows.map(log => [
      new Date(log.createdAt).toLocaleDateString(),
      new Date(log.createdAt).toLocaleTimeString(),
      log.userId,
      log.clientName,
      log.platformAccountName,
      log.action,
      JSON.stringify(log.details),
      log.ipAddress || 'N/A'
    ].join(','))
  ].join('\n')

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="audit-log-${clientId}-${startDate}-to-${endDate}.csv"`
    }
  })
}
```

## Best Practices for Agencies

### 1. Client Naming Convention

```typescript
// Use consistent naming
const clientSlug = name
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '')
```

### 2. Regular Token Checks

```typescript
// Weekly cron job to alert about expiring tokens
export async function checkExpiringTokens() {
  const expiring = await query(`
    SELECT 
      csp.*,
      c.name as "clientName",
      c.email as "clientEmail"
    FROM "clients_social_platforms" csp
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE csp."tokenExpiresAt" < NOW() + INTERVAL '14 days'
    AND csp."isActive" = true
  `)

  for (const account of expiring.rows) {
    await sendEmail({
      to: account.clientEmail,
      subject: `Action Required: ${account.platformAccountName} needs reconnection`,
      body: `Your ${account.platform} account expires in less than 14 days. Please reconnect.`
    })
  }
}
```

### 3. Content Calendar Integration

```typescript
// Sync with content calendar
export async function syncWithContentCalendar(clientId: string) {
  // Get scheduled posts from external calendar
  const calendarPosts = await fetchFromCalendar(clientId)
  
  // Create scheduled posts in system
  for (const post of calendarPosts) {
    await query(`
      INSERT INTO "scheduled_posts" (
        "accountId", "scheduledFor", "imageUrl", caption, "createdBy"
      ) VALUES ($1, $2, $3, $4, 'calendar_sync')
    `, [post.accountId, post.scheduledFor, post.imageUrl, post.caption])
  }
}
```

### 4. Client Portal Access

```typescript
// Give clients view-only access to their analytics
// Create separate client portal route
// app/client-portal/[slug]/page.tsx
```

## Key Takeaways

✅ **Per-Client Organization** - Clear separation of client accounts  
✅ **Bulk Operations** - Publish to multiple clients efficiently  
✅ **Complete Audit Trail** - Full compliance and reporting  
✅ **Scalable** - Handle 50+ clients seamlessly  
✅ **Team Collaboration** - Multiple users managing same clients  

## Next Steps

- **[Content Publishing](./02-content-publishing.md)** - Publishing workflows
- **[Analytics Reporting](./03-analytics-reporting.md)** - Advanced analytics
- **[Custom Integrations](../03-advanced-usage/02-custom-integrations.md)** - Extend functionality
