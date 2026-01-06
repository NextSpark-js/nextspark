# Content Publishing Workflows

## Overview

This guide covers various content publishing workflows using the Social Media Publisher plugin, from simple single-post publishing to advanced batch operations and content management systems.

**Covered Workflows:**
- Single post publishing
- Batch publishing (cross-posting)
- Content approval workflows
- Scheduled publishing
- Template-based publishing
- Media management integration

## Single Post Publishing

### Basic Publishing Flow

**Scenario:** Publish one image to one Instagram account

**React Component:**
```typescript
'use client'

import { useState } from 'react'
import { toast } from 'sonner'

export function SinglePostPublisher({ 
  accountId, 
  platform 
}: {
  accountId: string
  platform: 'instagram_business' | 'facebook_page'
}) {
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [loading, setLoading] = useState(false)

  const handlePublish = async () => {
    // Validation
    if (!imageUrl.startsWith('https://')) {
      toast.error('Image URL must use HTTPS')
      return
    }

    if (platform === 'instagram_business' && caption.length > 2200) {
      toast.error('Instagram captions must be under 2,200 characters')
      return
    }

    setLoading(true)

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

      const result = await response.json()

      if (result.success) {
        toast.success('Posted successfully!')
        // Open post in new tab
        window.open(result.postUrl, '_blank')
        // Reset form
        setImageUrl('')
        setCaption('')
      } else {
        toast.error(result.error || 'Publishing failed')
      }
    } catch (error) {
      toast.error('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Publish Post</h2>

      {/* Image URL Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Image URL
        </label>
        <input
          type="url"
          placeholder="https://example.com/image.jpg"
          value={imageUrl}
          onChange={(e) => setImageUrl(e.target.value)}
          className="w-full px-4 py-2 border rounded"
        />
        {imageUrl && (
          <div className="mt-2">
            <img 
              src={imageUrl} 
              alt="Preview" 
              className="max-w-xs rounded"
              onError={() => toast.error('Failed to load image')}
            />
          </div>
        )}
      </div>

      {/* Caption Input */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-2">
          Caption
          <span className="text-gray-500 text-xs ml-2">
            {caption.length}/{platform === 'instagram_business' ? '2,200' : '63,206'}
          </span>
        </label>
        <textarea
          placeholder="Write your caption..."
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={platform === 'instagram_business' ? 2200 : 63206}
          rows={6}
          className="w-full px-4 py-2 border rounded"
        />
        <p className="text-xs text-gray-500 mt-1">
          Tip: Use emojis 🎉 and hashtags #instagram for better engagement
        </p>
      </div>

      {/* Publish Button */}
      <button
        onClick={handlePublish}
        disabled={loading || !imageUrl || !caption}
        className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Publishing...' : 'Publish Now'}
      </button>
    </div>
  )
}
```

## Batch Publishing (Cross-Posting)

### Publish to Multiple Accounts

**Scenario:** Post same content to 5 different client accounts

**Multi-Select Component:**
```typescript
'use client'

import { useState, useEffect } from 'react'

export function BatchPublisher() {
  const [clients, setClients] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>([])
  const [imageUrl, setImageUrl] = useState('')
  const [caption, setCaption] = useState('')
  const [publishing, setPublishing] = useState(false)
  const [results, setResults] = useState<any[]>([])

  useEffect(() => {
    // Fetch clients and their accounts
    fetch('/api/v1/custom/clients-with-accounts')
      .then(r => r.json())
      .then(data => setClients(data.clients))
  }, [])

  const handlePublish = async () => {
    if (selectedAccounts.length === 0) {
      toast.error('Select at least one account')
      return
    }

    setPublishing(true)
    setResults([])

    const response = await fetch('/api/v1/custom/cross-post', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        accountIds: selectedAccounts,
        imageUrl,
        caption
      })
    })

    const data = await response.json()
    setResults(data.results)
    setPublishing(false)

    toast.success(`Published to ${data.successful}/${data.total} accounts`)
  }

  const toggleAccount = (accountId: string) => {
    setSelectedAccounts(prev =>
      prev.includes(accountId)
        ? prev.filter(id => id !== accountId)
        : [...prev, accountId]
    )
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Batch Publishing</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* Left: Account Selection */}
        <div>
          <h3 className="font-medium mb-4">Select Accounts</h3>
          <div className="border rounded p-4 max-h-96 overflow-y-auto">
            {clients.map((client: any) => (
              <div key={client.id} className="mb-4">
                <p className="font-medium text-sm text-gray-600 mb-2">
                  {client.name}
                </p>
                {client.accounts.map((account: any) => (
                  <label
                    key={account.id}
                    className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={selectedAccounts.includes(account.id)}
                      onChange={() => toggleAccount(account.id)}
                    />
                    <span className="text-sm">
                      {account.platformAccountName}
                      <span className="text-xs text-gray-500 ml-1">
                        ({account.platform === 'instagram_business' ? 'Instagram' : 'Facebook'})
                      </span>
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
          <p className="text-sm text-gray-600 mt-2">
            {selectedAccounts.length} account(s) selected
          </p>
        </div>

        {/* Right: Content */}
        <div>
          <h3 className="font-medium mb-4">Content</h3>
          
          <div className="mb-4">
            <input
              type="url"
              placeholder="Image URL (https://...)"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              className="w-full px-4 py-2 border rounded"
            />
            {imageUrl && (
              <img 
                src={imageUrl} 
                alt="Preview" 
                className="mt-2 max-w-full h-48 object-cover rounded"
              />
            )}
          </div>

          <textarea
            placeholder="Caption (max 2,200 chars for Instagram)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2200}
            rows={8}
            className="w-full px-4 py-2 border rounded mb-4"
          />

          <button
            onClick={handlePublish}
            disabled={publishing || selectedAccounts.length === 0 || !imageUrl}
            className="w-full bg-blue-600 text-white py-3 rounded font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {publishing 
              ? `Publishing to ${selectedAccounts.length} account(s)...`
              : `Publish to ${selectedAccounts.length} account(s)`
            }
          </button>
        </div>
      </div>

      {/* Results */}
      {results.length > 0 && (
        <div className="mt-8">
          <h3 className="font-medium mb-4">Results</h3>
          <div className="border rounded divide-y">
            {results.map((result: any, i) => (
              <div key={i} className="p-4 flex justify-between items-center">
                <div>
                  <p className="font-medium">{result.accountName}</p>
                  <p className="text-sm text-gray-600">
                    {result.status === 'published' ? (
                      <span className="text-green-600">✓ Published</span>
                    ) : (
                      <span className="text-red-600">✗ Failed: {result.error}</span>
                    )}
                  </p>
                </div>
                {result.postUrl && (
                  <a 
                    href={result.postUrl} 
                    target="_blank"
                    className="text-blue-600 text-sm"
                  >
                    View Post →
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

## Content Approval Workflow

### 3-Step Approval Process

**Flow:** Creator → Manager → Publish

**Database Schema:**
```sql
CREATE TABLE "pending_posts" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "accountId" UUID NOT NULL REFERENCES "clients_social_platforms"(id),
  "imageUrl" TEXT NOT NULL,
  caption TEXT,
  status TEXT DEFAULT 'pending_approval', -- 'pending_approval', 'approved', 'rejected', 'published'
  "createdBy" TEXT NOT NULL,
  "approvedBy" TEXT,
  "rejectedBy" TEXT,
  "rejectionReason" TEXT,
  "publishedAt" TIMESTAMPTZ,
  "postId" TEXT,
  "postUrl" TEXT,
  "createdAt" TIMESTAMPTZ DEFAULT now(),
  "updatedAt" TIMESTAMPTZ DEFAULT now()
);
```

**Submit for Approval:**
```typescript
// app/actions/submit-for-approval.ts
'use server'

export async function submitForApproval(data: {
  accountId: string
  imageUrl: string
  caption: string
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  const result = await query(`
    INSERT INTO "pending_posts" (
      "accountId", "imageUrl", caption, "createdBy", status
    ) VALUES ($1, $2, $3, $4, 'pending_approval')
    RETURNING id
  `, [data.accountId, data.imageUrl, data.caption, session.user.id])

  // Notify managers
  await notifyManagers(data.accountId, result.rows[0].id)

  return { success: true, postId: result.rows[0].id }
}
```

**Approval Interface:**
```typescript
// app/dashboard/approvals/page.tsx
export default async function ApprovalsPage() {
  const pendingPosts = await query(`
    SELECT 
      pp.*,
      csp."platformAccountName",
      c.name as "clientName"
    FROM "pending_posts" pp
    JOIN "clients_social_platforms" csp ON csp.id = pp."accountId"
    JOIN "clients" c ON c.id = csp."parentId"
    WHERE pp.status = 'pending_approval'
    ORDER BY pp."createdAt" ASC
  `)

  return (
    <div>
      <h1>Pending Approvals</h1>
      
      {pendingPosts.rows.map(post => (
        <div key={post.id} className="border p-4 mb-4">
          <div className="flex gap-4">
            <img 
              src={post.imageUrl} 
              alt="" 
              className="w-32 h-32 object-cover rounded"
            />
            <div className="flex-1">
              <p className="font-medium">{post.clientName} - {post.platformAccountName}</p>
              <p className="text-sm text-gray-600 mt-2">{post.caption}</p>
              <p className="text-xs text-gray-500 mt-2">
                Submitted by {post.createdBy} on {new Date(post.createdAt).toLocaleString()}
              </p>
            </div>
          </div>
          
          <div className="mt-4 flex gap-2">
            <form action={approvePost}>
              <input type="hidden" name="postId" value={post.id} />
              <button 
                type="submit"
                className="bg-green-600 text-white px-4 py-2 rounded"
              >
                Approve & Publish
              </button>
            </form>
            
            <form action={rejectPost}>
              <input type="hidden" name="postId" value={post.id} />
              <button 
                type="submit"
                className="bg-red-600 text-white px-4 py-2 rounded"
              >
                Reject
              </button>
            </form>
          </div>
        </div>
      ))}
    </div>
  )
}
```

## Scheduled Publishing

### Content Calendar

**Calendar View:**
```typescript
'use client'

import { Calendar } from '@/components/ui/calendar'
import { useState } from 'react'

export function ContentCalendar() {
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [scheduledPosts, setScheduledPosts] = useState([])

  useEffect(() => {
    // Fetch scheduled posts for selected month
    fetch(`/api/v1/custom/scheduled-posts?month=${selectedDate.toISOString()}`)
      .then(r => r.json())
      .then(data => setScheduledPosts(data.posts))
  }, [selectedDate])

  return (
    <div className="grid grid-cols-2 gap-6">
      {/* Calendar */}
      <div>
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={setSelectedDate}
          className="rounded border"
        />
      </div>

      {/* Posts for Selected Date */}
      <div>
        <h3 className="font-medium mb-4">
          Scheduled for {selectedDate.toLocaleDateString()}
        </h3>
        
        {scheduledPosts
          .filter(post => 
            new Date(post.scheduledFor).toDateString() === selectedDate.toDateString()
          )
          .map(post => (
            <div key={post.id} className="border p-3 mb-2 rounded">
              <p className="text-sm font-medium">{post.accountName}</p>
              <p className="text-xs text-gray-600">
                {new Date(post.scheduledFor).toLocaleTimeString()}
              </p>
              <p className="text-sm mt-1">
                {post.caption.substring(0, 60)}...
              </p>
            </div>
          ))
        }

        <button
          onClick={() => openScheduleModal(selectedDate)}
          className="w-full border-2 border-dashed rounded p-4 text-gray-600 hover:border-blue-500 hover:text-blue-600"
        >
          + Schedule Post
        </button>
      </div>
    </div>
  )
}
```

## Template-Based Publishing

### Save and Reuse Templates

**Create Template:**
```typescript
export async function saveTemplate(data: {
  name: string
  imageUrl: string
  caption: string
  tags: string[]
}) {
  const session = await auth.api.getSession({ headers: await headers() })
  
  const result = await query(`
    INSERT INTO "post_templates" (
      name, "imageUrl", caption, tags, "createdBy"
    ) VALUES ($1, $2, $3, $4, $5)
    RETURNING id
  `, [data.name, data.imageUrl, data.caption, JSON.stringify(data.tags), session.user.id])

  return { templateId: result.rows[0].id }
}
```

**Template Library:**
```typescript
export function TemplateLibrary() {
  const [templates, setTemplates] = useState([])

  const useTemplate = async (template: any, accountId: string) => {
    const response = await fetch(`/api/v1/custom/templates/publish/${template.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ accountId })
    })

    const result = await response.json()
    
    if (result.success) {
      toast.success('Published from template!')
    }
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {templates.map(template => (
        <div key={template.id} className="border rounded p-4">
          <img 
            src={template.imageUrl} 
            alt={template.name}
            className="w-full h-48 object-cover rounded mb-2"
          />
          <p className="font-medium">{template.name}</p>
          <p className="text-sm text-gray-600 line-clamp-2 mt-1">
            {template.caption}
          </p>
          <div className="flex gap-1 mt-2">
            {template.tags.map((tag: string) => (
              <span key={tag} className="text-xs bg-gray-100 px-2 py-1 rounded">
                {tag}
              </span>
            ))}
          </div>
          <button
            onClick={() => openUseTemplateModal(template)}
            className="w-full mt-3 bg-blue-600 text-white py-2 rounded text-sm"
          >
            Use Template
          </button>
        </div>
      ))}
    </div>
  )
}
```

## Media Management Integration

### Upload to CDN Before Publishing

```typescript
export async function uploadAndPublish(
  file: File,
  accountId: string,
  caption: string
) {
  // 1. Upload to CDN
  const formData = new FormData()
  formData.append('file', file)

  const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    body: formData
  })

  const { url: imageUrl } = await uploadResponse.json()

  // 2. Publish with CDN URL
  const publishResponse = await fetch('/api/v1/plugin/social-media-publisher/social/publish', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      accountId,
      platform: 'instagram_business',
      imageUrl,  // CDN URL
      caption
    })
  })

  return await publishResponse.json()
}
```

## Best Practices

### Content Validation

```typescript
function validateContent(
  imageUrl: string,
  caption: string,
  platform: string
): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Image URL
  if (!imageUrl.startsWith('https://')) {
    errors.push('Image URL must use HTTPS')
  }

  // Caption length
  const maxLength = platform === 'instagram_business' ? 2200 : 63206
  if (caption.length > maxLength) {
    errors.push(`Caption too long (max ${maxLength} chars)`)
  }

  // Instagram hashtag limit
  if (platform === 'instagram_business') {
    const hashtags = caption.match(/#\w+/g) || []
    if (hashtags.length > 30) {
      errors.push('Too many hashtags (max 30 for Instagram)')
    }
  }

  return {
    valid: errors.length === 0,
    errors
  }
}
```

## Next Steps

- **[Agency Management](./01-agency-management.md)** - Multi-client workflows
- **[Analytics Reporting](./03-analytics-reporting.md)** - Track performance
- **[Custom Integrations](../03-advanced-usage/02-custom-integrations.md)** - Extend publishing
