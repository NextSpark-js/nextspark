'use client'

/**
 * Blog Theme - Create Post Page
 *
 * Full-width WYSIWYG editor with side panel for metadata.
 * Designed for distraction-free writing.
 *
 * Layout: Works within dashboard layout with fixed sub-topbar, fixed title,
 * fixed right sidebar, and scrollable content editor only.
 */

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Eye, Loader2, Check, X } from 'lucide-react'
import { Button } from '@nextsparkjs/core/components/ui/button'
import { Input } from '@nextsparkjs/core/components/ui/input'
import { Label } from '@nextsparkjs/core/components/ui/label'
import { Textarea } from '@nextsparkjs/core/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@nextsparkjs/core/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@nextsparkjs/core/components/ui/card'
import { Switch } from '@nextsparkjs/core/components/ui/switch'
import { WysiwygEditor } from '@/themes/blog/components/editor/WysiwygEditor'
import { FeaturedImageUpload } from '@/themes/blog/components/editor/FeaturedImageUpload'

interface PostData {
  title: string
  slug: string
  content: string
  excerpt: string
  status: 'draft' | 'published'
  featuredImage: string
  featured: boolean
}

function getActiveTeamId(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('activeTeamId')
}

function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  }
  const teamId = getActiveTeamId()
  if (teamId) {
    headers['x-team-id'] = teamId
  }
  return headers
}

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim()
}

export default function CreatePostPage() {
  const router = useRouter()
  const [post, setPost] = useState<PostData>({
    title: '',
    slug: '',
    content: '',
    excerpt: '',
    status: 'draft',
    featuredImage: '',
    featured: false
  })
  const [saving, setSaving] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)

  // Auto-generate slug from title
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    setPost(prev => ({
      ...prev,
      title,
      slug: generateSlug(title)
    }))
  }, [])

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!post.title && !post.content) return

    const timer = setTimeout(async () => {
      if (post.status === 'draft') {
        await handleSave(false)
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      }
    }, 30000)

    return () => clearTimeout(timer)
  }, [post.title, post.content, post.status])

  const handleSave = async (redirect = true, statusOverride?: 'draft' | 'published') => {
    if (!post.title.trim()) {
      setError('title-required')
      return
    }

    setSaving(true)
    setError(null)

    // Use status override if provided (for publish), otherwise use current post status
    const statusToSave = statusOverride ?? post.status

    try {
      const headers = buildHeaders()
      const response = await fetch('/api/v1/posts', {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          title: post.title,
          slug: post.slug || generateSlug(post.title),
          content: post.content,
          excerpt: post.excerpt,
          status: statusToSave,
          featuredImage: post.featuredImage || null,
          featured: post.featured,
          publishedAt: statusToSave === 'published' ? new Date().toISOString() : null
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to save post')
      }

      const result = await response.json()

      if (redirect) {
        router.push(`/dashboard/posts/${result.data.id}/edit`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    await handleSave(true, 'published')
  }

  return (
    <div className="relative h-[calc(100vh-7rem)] flex flex-col" data-cy="post-create-container">
      {/* Sub-topbar */}
      <header className="shrink-0 border-b border-border bg-background" data-cy="post-create-header">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/posts">
              <Button variant="ghost" size="sm" data-cy="post-create-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Posts
              </Button>
            </Link>
            <span
              className="text-sm text-muted-foreground"
              data-cy="post-create-status"
              data-cy-status={post.status === 'draft' ? 'new-draft' : 'new-post'}
            >
              {post.status === 'draft' ? 'New Draft' : 'New Post'}
            </span>
            {autoSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1" data-cy="post-create-autosaved">
                <Check className="h-3 w-3" />
                Auto-saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              data-cy="post-create-settings-toggle"
            >
              {showSidebar ? 'Hide' : 'Show'} Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving}
              data-cy="post-create-save"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save Draft
                </>
              )}
            </Button>
            <Button
              size="sm"
              onClick={handlePublish}
              disabled={saving}
              data-cy="post-create-publish"
            >
              <Eye className="h-4 w-4 mr-2" />
              Publish
            </Button>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div
          className="shrink-0 bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between"
          data-cy="post-create-error"
          data-cy-error={error}
        >
          <span className="text-sm text-destructive">
            {error === 'title-required' ? 'Title is required' : error}
          </span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} data-cy="post-create-error-dismiss">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Editor Column */}
        <div className="flex-1 flex flex-col min-h-0">
          {/* Fixed Title */}
          <div className="shrink-0 px-6 pt-4 pb-4 bg-background">
            <Input
              value={post.title}
              onChange={handleTitleChange}
              placeholder="Post title..."
              className="text-3xl font-bold border-0 border-b rounded-none px-0 focus-visible:ring-0 focus-visible:border-primary"
              data-cy="post-create-title"
            />
          </div>

          {/* Content Editor - fills remaining space */}
          <div className="flex-1 min-h-0 px-6 pb-6" data-cy="post-create-content">
            <WysiwygEditor
              value={post.content}
              onChange={(content) => setPost(prev => ({ ...prev, content }))}
              placeholder="Start writing your post..."
              className="h-full flex flex-col"
              autoFocus
            />
          </div>
        </div>

        {/* Right Sidebar */}
        {showSidebar && (
          <div className="w-72 border-l border-border bg-background overflow-y-auto shrink-0" data-cy="post-create-settings">
            <div className="p-4 space-y-4">
              <Card>
                <CardHeader className="py-3">
                  <CardTitle className="text-sm">Post Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Status */}
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select
                      value={post.status}
                      onValueChange={(value: 'draft' | 'published') =>
                        setPost(prev => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger data-cy="post-create-status-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Slug */}
                  <div className="space-y-2">
                    <Label>URL Slug</Label>
                    <Input
                      value={post.slug}
                      onChange={(e) => setPost(prev => ({ ...prev, slug: e.target.value }))}
                      placeholder="post-url-slug"
                      data-cy="post-create-slug"
                    />
                  </div>

                  {/* Excerpt */}
                  <div className="space-y-2">
                    <Label>Excerpt</Label>
                    <Textarea
                      value={post.excerpt}
                      onChange={(e) => setPost(prev => ({ ...prev, excerpt: e.target.value }))}
                      placeholder="Brief description for previews..."
                      rows={3}
                      data-cy="post-create-excerpt"
                    />
                  </div>

                  {/* Featured Image */}
                  <div className="space-y-2" data-cy="post-create-featured-image">
                    <Label>Featured Image</Label>
                    <FeaturedImageUpload
                      value={post.featuredImage}
                      onChange={(url) => setPost(prev => ({ ...prev, featuredImage: url }))}
                    />
                  </div>

                  {/* Featured Toggle */}
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="featured">Featured Post</Label>
                      <p className="text-xs text-muted-foreground">
                        Show on homepage
                      </p>
                    </div>
                    <Switch
                      id="featured"
                      checked={post.featured}
                      onCheckedChange={(checked: boolean) => setPost(prev => ({ ...prev, featured: checked }))}
                      data-cy="post-create-featured-toggle"
                    />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
