# Analytics and Reporting

## Overview

This guide covers how to leverage the Social Media Publisher plugin's analytics capabilities to track performance, generate reports, and make data-driven decisions for social media management.

**Covered Topics:**
- Account-level analytics
- Post performance tracking
- Client reporting
- Comparative analysis
- Export and visualization
- ROI measurement

## Account-Level Analytics

### Instagram Business Insights

**Fetch Account Metrics:**
```typescript
import { InstagramAPI } from '@/contents/plugins/social-media-publisher/lib/providers/instagram'
import { TokenEncryption } from '@/core/lib/oauth/encryption'

export async function getInstagramAnalytics(accountId: string) {
  // Get account with encrypted token
  const account = await query(`
    SELECT * FROM "clients_social_platforms"
    WHERE id = $1
  `, [accountId])

  if (account.rowCount === 0) throw new Error('Account not found')

  // Decrypt token
  const [encrypted, iv, keyId] = account.rows[0].accessToken.split(':')
  const decryptedToken = await TokenEncryption.decrypt(encrypted, iv, keyId)

  // Fetch insights from Instagram API
  const insights = await InstagramAPI.getAccountInsights(
    account.rows[0].platformAccountId,
    decryptedToken
  )

  // Fetch account info
  const info = await InstagramAPI.getAccountInfo(
    account.rows[0].platformAccountId,
    decryptedToken
  )

  return {
    account: {
      id: account.rows[0].id,
      username: account.rows[0].platformAccountName,
      followersCount: info.followersCount,
      followsCount: info.followsCount,
      mediaCount: info.mediaCount,
      profilePictureUrl: info.profilePictureUrl
    },
    insights: {
      impressions: insights.impressions,
      reach: insights.reach,
      engagement: insights.engagement,
      likes: insights.likes,
      comments: insights.comments,
      saves: insights.saves,
      profileViews: insights.profileViews
    },
    metrics: {
      engagementRate: ((insights.engagement / insights.reach) * 100).toFixed(2),
      averageEngagementPerPost: (insights.engagement / info.mediaCount).toFixed(0),
      savesRate: ((insights.saves / insights.reach) * 100).toFixed(2)
    }
  }
}
```

**Display in Dashboard:**
```typescript
// app/dashboard/analytics/[accountId]/page.tsx
export default async function AccountAnalyticsPage({
  params
}: {
  params: Promise<{ accountId: string }>
}) {
  const { accountId } = await params
  const analytics = await getInstagramAnalytics(accountId)

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <img
          src={analytics.account.profilePictureUrl}
          alt={analytics.account.username}
          className="w-20 h-20 rounded-full"
        />
        <div>
          <h1 className="text-2xl font-bold">@{analytics.account.username}</h1>
          <p className="text-gray-600">
            {analytics.account.followersCount.toLocaleString()} followers
          </p>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Impressions"
          value={analytics.insights.impressions.toLocaleString()}
          icon="👁️"
        />
        <MetricCard
          title="Reach"
          value={analytics.insights.reach.toLocaleString()}
          icon="📊"
        />
        <MetricCard
          title="Engagement"
          value={analytics.insights.engagement.toLocaleString()}
          icon="❤️"
        />
        <MetricCard
          title="Engagement Rate"
          value={`${analytics.metrics.engagementRate}%`}
          icon="📈"
        />
      </div>

      {/* Detailed Metrics */}
      <div className="grid grid-cols-2 gap-6">
        <Card>
          <CardHeader>Engagement Breakdown</CardHeader>
          <CardContent>
            <div className="space-y-3">
              <MetricRow label="Likes" value={analytics.insights.likes} />
              <MetricRow label="Comments" value={analytics.insights.comments} />
              <MetricRow label="Saves" value={analytics.insights.saves} />
              <MetricRow label="Profile Views" value={analytics.insights.profileViews} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>Performance Metrics</CardHeader>
          <CardContent>
            <div className="space-y-3">
              <MetricRow 
                label="Engagement Rate" 
                value={`${analytics.metrics.engagementRate}%`} 
              />
              <MetricRow 
                label="Avg. Engagement/Post" 
                value={analytics.metrics.averageEngagementPerPost} 
              />
              <MetricRow 
                label="Saves Rate" 
                value={`${analytics.metrics.savesRate}%`} 
              />
              <MetricRow 
                label="Total Posts" 
                value={analytics.account.mediaCount} 
              />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function MetricCard({ title, value, icon }: {
  title: string
  value: string
  icon: string
}) {
  return (
    <div className="border rounded-lg p-4">
      <div className="text-2xl mb-2">{icon}</div>
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function MetricRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  )
}
```

### Facebook Page Insights

**Similar to Instagram but with Page-specific metrics:**
```typescript
export async function getFacebookPageAnalytics(accountId: string) {
  // Similar structure to Instagram
  const account = await getAccount(accountId)
  const decryptedToken = await decryptToken(account.accessToken)

  const insights = await FacebookAPI.getPageInsights(
    account.platformAccountId,
    decryptedToken
  )

  const pageInfo = await FacebookAPI.getPageInfo(
    account.platformAccountId,
    decryptedToken
  )

  return {
    account: {
      id: account.id,
      name: account.platformAccountName,
      fanCount: pageInfo.fanCount,
      about: pageInfo.about,
      link: pageInfo.link
    },
    insights: {
      impressions: insights.impressions,
      reach: insights.reach,
      engagement: insights.engagement,
      reactions: insights.reactions,
      comments: insights.comments,
      shares: insights.shares
    }
  }
}
```

## Post Performance Tracking

### Individual Post Analytics

**Track Post Performance from Audit Logs:**
```typescript
export async function getPostPerformance(clientId: string, days: number = 30) {
  // Get all published posts from audit logs
  const posts = await query(`
    SELECT 
      al.id,
      al."createdAt" as "publishedAt",
      al.details->>'postId' as "postId",
      al.details->>'postUrl' as "postUrl",
      al.details->>'platform' as platform,
      al.details->>'accountName' as "accountName",
      al.details->>'caption' as caption,
      al.details->>'imageUrl' as "imageUrl",
      al."accountId"
    FROM "audit_logs" al
    JOIN "clients_social_platforms" csp ON csp.id = al."accountId"
    WHERE csp."parentId" = $1
    AND al.action = 'post_published'
    AND al."createdAt" > NOW() - INTERVAL '${days} days'
    ORDER BY al."createdAt" DESC
  `, [clientId])

  // Enrich with real-time insights from APIs
  const enrichedPosts = await Promise.all(
    posts.rows.map(async (post) => {
      try {
        const account = await getAccount(post.accountId)
        const token = await decryptToken(account.accessToken)

        let insights = {}
        
        if (post.platform === 'instagram_business') {
          insights = await InstagramAPI.getMediaInsights(post.postId, token)
        } else {
          // Facebook post insights
          // Note: Requires additional API implementation
        }

        return {
          ...post,
          insights
        }
      } catch (error) {
        return {
          ...post,
          insights: null,
          error: 'Failed to fetch insights'
        }
      }
    })
  )

  return enrichedPosts
}
```

**Display Top Performing Posts:**
```typescript
// app/dashboard/analytics/top-posts/page.tsx
export default async function TopPostsPage({
  searchParams
}: {
  searchParams: Promise<{ clientId?: string; days?: string }>
}) {
  const params = await searchParams
  const clientId = params.clientId
  const days = parseInt(params.days || '30')

  const posts = await getPostPerformance(clientId, days)

  // Sort by engagement
  const sortedPosts = posts
    .filter(p => p.insights)
    .sort((a, b) => (b.insights.engagement || 0) - (a.insights.engagement || 0))

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">
        Top Performing Posts ({days} days)
      </h1>

      <div className="grid grid-cols-1 gap-4">
        {sortedPosts.slice(0, 10).map((post, index) => (
          <div key={post.id} className="border rounded-lg p-4 flex gap-4">
            {/* Rank */}
            <div className="text-3xl font-bold text-gray-300 w-12">
              #{index + 1}
            </div>

            {/* Image */}
            <img
              src={post.imageUrl}
              alt=""
              className="w-32 h-32 object-cover rounded"
            />

            {/* Content */}
            <div className="flex-1">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-medium">{post.accountName}</p>
                  <p className="text-sm text-gray-600">
                    {new Date(post.publishedAt).toLocaleDateString()}
                  </p>
                </div>
                <a
                  href={post.postUrl}
                  target="_blank"
                  className="text-blue-600 text-sm"
                >
                  View Post →
                </a>
              </div>
              
              <p className="text-sm mt-2 line-clamp-2">{post.caption}</p>

              {/* Metrics */}
              <div className="flex gap-6 mt-3">
                <Metric 
                  label="Impressions" 
                  value={post.insights.impressions} 
                />
                <Metric 
                  label="Engagement" 
                  value={post.insights.engagement} 
                />
                <Metric 
                  label="Likes" 
                  value={post.insights.likes} 
                />
                <Metric 
                  label="Comments" 
                  value={post.insights.comments} 
                />
                <Metric 
                  label="Saves" 
                  value={post.insights.saves} 
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <p className="text-xs text-gray-600">{label}</p>
      <p className="font-semibold">{value?.toLocaleString() || '0'}</p>
    </div>
  )
}
```

## Client Reporting

### Monthly Report Generation

**Comprehensive Client Report:**
```typescript
export async function generateMonthlyReport(
  clientId: string,
  year: number,
  month: number
) {
  // Date range
  const startDate = new Date(year, month - 1, 1)
  const endDate = new Date(year, month, 0)

  // Get client info
  const client = await query(`
    SELECT * FROM "clients" WHERE id = $1
  `, [clientId])

  // Get all accounts
  const accounts = await query(`
    SELECT * FROM "clients_social_platforms"
    WHERE "parentId" = $1 AND "isActive" = true
  `, [clientId])

  // Get publishing activity
  const publishingStats = await query(`
    SELECT 
      al.details->>'platform' as platform,
      COUNT(*) FILTER (WHERE al.action = 'post_published') as successful,
      COUNT(*) FILTER (WHERE al.action = 'post_failed') as failed
    FROM "audit_logs" al
    WHERE al."accountId" = ANY($1)
    AND al."createdAt" BETWEEN $2 AND $3
    GROUP BY al.details->>'platform'
  `, [accounts.rows.map(a => a.id), startDate, endDate])

  // Fetch insights for each account
  const accountInsights = await Promise.all(
    accounts.rows.map(async (account) => {
      const token = await decryptToken(account.accessToken)

      try {
        if (account.platform === 'instagram_business') {
          const insights = await InstagramAPI.getAccountInsights(
            account.platformAccountId,
            token
          )
          const info = await InstagramAPI.getAccountInfo(
            account.platformAccountId,
            token
          )

          return {
            accountName: account.platformAccountName,
            platform: account.platform,
            followersCount: info.followersCount,
            ...insights
          }
        } else {
          const insights = await FacebookAPI.getPageInsights(
            account.platformAccountId,
            token
          )
          const info = await FacebookAPI.getPageInfo(
            account.platformAccountId,
            token
          )

          return {
            accountName: account.platformAccountName,
            platform: account.platform,
            fanCount: info.fanCount,
            ...insights
          }
        }
      } catch (error) {
        return {
          accountName: account.platformAccountName,
          platform: account.platform,
          error: 'Failed to fetch insights'
        }
      }
    })
  )

  // Calculate totals
  const totals = accountInsights.reduce(
    (acc, curr) => {
      if (!curr.error) {
        acc.impressions += curr.impressions || 0
        acc.reach += curr.reach || 0
        acc.engagement += curr.engagement || 0
      }
      return acc
    },
    { impressions: 0, reach: 0, engagement: 0 }
  )

  const totalPosts = publishingStats.rows.reduce(
    (sum, row) => sum + row.successful,
    0
  )

  return {
    client: client.rows[0],
    period: {
      month,
      year,
      startDate,
      endDate
    },
    summary: {
      totalPosts,
      totalAccounts: accounts.rowCount,
      totalImpressions: totals.impressions,
      totalReach: totals.reach,
      totalEngagement: totals.engagement,
      engagementRate: ((totals.engagement / totals.reach) * 100).toFixed(2)
    },
    accounts: accountInsights,
    publishingStats: publishingStats.rows
  }
}
```

**Export as PDF:**
```typescript
import { jsPDF } from 'jspdf'

export async function exportReportAsPDF(clientId: string, month: number, year: number) {
  const report = await generateMonthlyReport(clientId, year, month)

  const doc = new jsPDF()
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']

  // Title Page
  doc.setFontSize(24)
  doc.text(report.client.name, 20, 30)
  doc.setFontSize(18)
  doc.text(`Social Media Report`, 20, 45)
  doc.setFontSize(14)
  doc.text(`${monthNames[month - 1]} ${year}`, 20, 55)

  // Summary
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Executive Summary', 20, 30)
  
  doc.setFontSize(12)
  let y = 50
  doc.text(`Total Posts Published: ${report.summary.totalPosts}`, 20, y)
  y += 10
  doc.text(`Total Impressions: ${report.summary.totalImpressions.toLocaleString()}`, 20, y)
  y += 10
  doc.text(`Total Reach: ${report.summary.totalReach.toLocaleString()}`, 20, y)
  y += 10
  doc.text(`Total Engagement: ${report.summary.totalEngagement.toLocaleString()}`, 20, y)
  y += 10
  doc.text(`Engagement Rate: ${report.summary.engagementRate}%`, 20, y)

  // Account Breakdown
  doc.addPage()
  doc.setFontSize(16)
  doc.text('Account Performance', 20, 30)

  y = 50
  report.accounts.forEach((account) => {
    if (account.error) return

    doc.setFontSize(14)
    doc.text(`${account.accountName}`, 20, y)
    
    doc.setFontSize(11)
    y += 10
    doc.text(`Platform: ${account.platform === 'instagram_business' ? 'Instagram' : 'Facebook'}`, 30, y)
    y += 8
    doc.text(`Followers: ${(account.followersCount || account.fanCount || 0).toLocaleString()}`, 30, y)
    y += 8
    doc.text(`Impressions: ${(account.impressions || 0).toLocaleString()}`, 30, y)
    y += 8
    doc.text(`Engagement: ${(account.engagement || 0).toLocaleString()}`, 30, y)
    y += 15

    if (y > 250) {
      doc.addPage()
      y = 30
    }
  })

  // Save
  doc.save(`${report.client.slug}-report-${year}-${month}.pdf`)
}
```

## Comparative Analysis

### Month-over-Month Comparison

```typescript
export async function getComparativeAnalytics(clientId: string) {
  const currentMonth = new Date().getMonth() + 1
  const currentYear = new Date().getFullYear()
  const previousMonth = currentMonth === 1 ? 12 : currentMonth - 1
  const previousYear = currentMonth === 1 ? currentYear - 1 : currentYear

  const [current, previous] = await Promise.all([
    generateMonthlyReport(clientId, currentYear, currentMonth),
    generateMonthlyReport(clientId, previousYear, previousMonth)
  ])

  return {
    current: current.summary,
    previous: previous.summary,
    changes: {
      posts: calculateChange(current.summary.totalPosts, previous.summary.totalPosts),
      impressions: calculateChange(current.summary.totalImpressions, previous.summary.totalImpressions),
      reach: calculateChange(current.summary.totalReach, previous.summary.totalReach),
      engagement: calculateChange(current.summary.totalEngagement, previous.summary.totalEngagement),
      engagementRate: calculateChange(
        parseFloat(current.summary.engagementRate),
        parseFloat(previous.summary.engagementRate)
      )
    }
  }
}

function calculateChange(current: number, previous: number) {
  if (previous === 0) return { value: 0, percentage: 0 }
  
  const difference = current - previous
  const percentage = ((difference / previous) * 100).toFixed(1)
  
  return {
    value: difference,
    percentage: parseFloat(percentage),
    isPositive: difference >= 0
  }
}
```

**Display Comparison:**
```typescript
export function ComparativeAnalyticsDashboard({ data }: { data: any }) {
  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Current Month */}
      <div>
        <h3 className="font-medium mb-4">This Month</h3>
        <div className="space-y-3">
          <MetricWithChange
            label="Posts"
            current={data.current.totalPosts}
            change={data.changes.posts}
          />
          <MetricWithChange
            label="Impressions"
            current={data.current.totalImpressions}
            change={data.changes.impressions}
          />
          <MetricWithChange
            label="Engagement"
            current={data.current.totalEngagement}
            change={data.changes.engagement}
          />
          <MetricWithChange
            label="Engagement Rate"
            current={`${data.current.engagementRate}%`}
            change={data.changes.engagementRate}
          />
        </div>
      </div>

      {/* Previous Month */}
      <div>
        <h3 className="font-medium mb-4">Last Month</h3>
        <div className="space-y-3">
          <SimplMetric label="Posts" value={data.previous.totalPosts} />
          <SimpleMetric label="Impressions" value={data.previous.totalImpressions} />
          <SimpleMetric label="Engagement" value={data.previous.totalEngagement} />
          <SimpleMetric label="Engagement Rate" value={`${data.previous.engagementRate}%`} />
        </div>
      </div>
    </div>
  )
}

function MetricWithChange({ label, current, change }: {
  label: string
  current: number | string
  change: { value: number; percentage: number; isPositive: boolean }
}) {
  return (
    <div className="border rounded p-3">
      <p className="text-sm text-gray-600">{label}</p>
      <div className="flex justify-between items-end">
        <p className="text-2xl font-bold">{current}</p>
        <div className={`text-sm ${change.isPositive ? 'text-green-600' : 'text-red-600'}`}>
          {change.isPositive ? '↑' : '↓'} {Math.abs(change.percentage)}%
        </div>
      </div>
    </div>
  )
}
```

## Best Practices

### Data Refresh Strategy

```typescript
// Cache insights for 24 hours
export async function getCachedInsights(accountId: string) {
  const cacheKey = `insights:${accountId}`
  
  // Check cache
  const cached = await redis.get(cacheKey)
  if (cached) return JSON.parse(cached)

  // Fetch fresh data
  const insights = await getInstagramAnalytics(accountId)

  // Cache for 24 hours
  await redis.setex(cacheKey, 86400, JSON.stringify(insights))

  return insights
}
```

### Rate Limit Handling

```typescript
// Batch insights fetching to avoid rate limits
export async function batchFetchInsights(accountIds: string[]) {
  const results = []
  
  for (const accountId of accountIds) {
    results.push(await getCachedInsights(accountId))
    
    // Wait 1 second between requests
    await new Promise(resolve => setTimeout(resolve, 1000))
  }
  
  return results
}
```

## Next Steps

- **[Agency Management](./01-agency-management.md)** - Multi-client workflows
- **[Content Publishing](./02-content-publishing.md)** - Publishing workflows
- **[Provider APIs](../03-advanced-usage/01-provider-apis.md)** - API reference
