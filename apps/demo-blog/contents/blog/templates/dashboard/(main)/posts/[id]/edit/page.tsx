'use client'

/**
 * Blog Theme - Edit Post Page
 *
 * Full-width WYSIWYG editor with side panel for metadata.
 * Loads existing post data and supports auto-save.
 *
 * Layout: Works within dashboard layout with fixed sub-topbar, fixed title,
 * fixed right sidebar, and scrollable content editor only.
 */

import { useState, useCallback, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Eye, Loader2, Check, X, Trash2, ExternalLink } from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@nextsparkjs/core/components/ui/dialog'
import { Switch } from '@nextsparkjs/core/components/ui/switch'
import { WysiwygEditor } from '@/themes/blog/components/editor/WysiwygEditor'
import { FeaturedImageUpload } from '@/themes/blog/components/editor/FeaturedImageUpload'

interface PostData {
  id: string
  title: string
  slug: string
  content: string
  excerpt: string
  status: 'draft' | 'published'
  featuredImage: string
  featured: boolean
  publishedAt: string | null
  createdAt: string
  updatedAt: string
}

interface PageProps {
  params: Promise<{ id: string }>
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

export default function EditPostPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [post, setPost] = useState<PostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [autoSaved, setAutoSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(true)
  const [hasChanges, setHasChanges] = useState(false)

  // Fetch post data
  useEffect(() => {
    async function fetchPost() {
      try {
        const headers = buildHeaders()
        const response = await fetch(`/api/v1/posts/${id}`, {
          credentials: 'include',
          headers,
        })

        if (!response.ok) {
          throw new Error('Post not found')
        }

        const result = await response.json()
        setPost({
          ...result.data,
          content: result.data.content || '',
          excerpt: result.data.excerpt || '',
          featuredImage: result.data.featuredImage || '',
          featured: result.data.featured ?? false
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load post')
      } finally {
        setLoading(false)
      }
    }

    fetchPost()
  }, [id])

  // Track changes
  const updatePost = useCallback((updates: Partial<PostData>) => {
    setPost(prev => prev ? { ...prev, ...updates } : null)
    setHasChanges(true)
  }, [])

  // Auto-generate slug from title
  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const title = e.target.value
    updatePost({
      title,
      slug: generateSlug(title)
    })
  }, [updatePost])

  // Auto-save draft every 30 seconds
  useEffect(() => {
    if (!post || !hasChanges || post.status !== 'draft') return

    const timer = setTimeout(async () => {
      await handleSave(false)
      setAutoSaved(true)
      setTimeout(() => setAutoSaved(false), 2000)
    }, 30000)

    return () => clearTimeout(timer)
  }, [post, hasChanges])

  const handleSave = async (showFeedback = true, statusOverride?: 'draft' | 'published') => {
    if (!post) return

    if (!post.title.trim()) {
      setError('Title is required')
      return
    }

    setSaving(true)
    setError(null)

    // Use status override if provided (for publish/unpublish), otherwise use current post status
    const statusToSave = statusOverride ?? post.status
    const publishedAtToSave = statusToSave === 'published' && !post.publishedAt
      ? new Date().toISOString()
      : statusToSave === 'draft'
        ? null
        : post.publishedAt

    try {
      const headers = buildHeaders()
      const response = await fetch(`/api/v1/posts/${id}`, {
        method: 'PATCH',
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
          publishedAt: publishedAtToSave
        })
      })

      if (!response.ok) {
        const result = await response.json()
        throw new Error(result.error || 'Failed to save post')
      }

      // Update local state to match what was saved
      setPost(prev => prev ? { ...prev, status: statusToSave, publishedAt: publishedAtToSave } : null)
      setHasChanges(false)

      if (showFeedback) {
        setAutoSaved(true)
        setTimeout(() => setAutoSaved(false), 2000)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save post')
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (!post) return
    await handleSave(true, 'published')
  }

  const handleUnpublish = async () => {
    if (!post) return
    await handleSave(true, 'draft')
  }

  const handleDelete = async () => {
    if (!post) return

    setDeleting(true)
    setError(null)

    try {
      const headers = buildHeaders()
      const response = await fetch(`/api/v1/posts/${id}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to delete post')
      }

      router.push('/dashboard/posts')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete post')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="h-[calc(100vh-7rem)] flex items-center justify-center" data-cy="post-edit-loading">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="h-[calc(100vh-7rem)] flex flex-col items-center justify-center gap-4" data-cy="post-edit-not-found">
        <p className="text-muted-foreground">Post not found</p>
        <Link href="/dashboard/posts">
          <Button variant="outline">Back to Posts</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="relative h-[calc(100vh-7rem)] flex flex-col" data-cy="post-edit-container">
      {/* Sub-topbar */}
      <header className="shrink-0 border-b border-border bg-background" data-cy="post-edit-header">
        <div className="flex items-center justify-between h-12 px-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard/posts">
              <Button variant="ghost" size="sm" data-cy="post-edit-back">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Posts
              </Button>
            </Link>
            <span
              className="text-sm text-muted-foreground"
              data-cy="post-edit-status"
              data-cy-status={post.status}
            >
              {post.status === 'published' ? 'Published' : 'Draft'}
              {hasChanges && (
                <span data-cy="post-unsaved-indicator"> (unsaved changes)</span>
              )}
            </span>
            {autoSaved && (
              <span className="text-xs text-green-600 flex items-center gap-1" data-cy="post-edit-autosaved">
                <Check className="h-3 w-3" />
                Saved
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            {post.status === 'published' && (
              <Link href={`/posts/${post.slug || post.id}`} target="_blank">
                <Button variant="ghost" size="sm" data-cy="post-edit-view-live">
                  <ExternalLink className="h-4 w-4 mr-2" />
                  View
                </Button>
              </Link>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              data-cy="post-edit-settings-toggle"
            >
              {showSidebar ? 'Hide' : 'Show'} Settings
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving}
              data-cy="post-edit-save"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  Save
                </>
              )}
            </Button>
            {post.status === 'draft' ? (
              <Button size="sm" onClick={handlePublish} disabled={saving} data-cy="post-edit-publish">
                <Eye className="h-4 w-4 mr-2" />
                Publish
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleUnpublish}
                disabled={saving}
                data-cy="post-edit-unpublish"
              >
                Unpublish
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="shrink-0 bg-destructive/10 border-b border-destructive/20 px-4 py-2 flex items-center justify-between" data-cy="post-edit-error">
          <span className="text-sm text-destructive">{error}</span>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} data-cy="post-edit-error-dismiss">
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
              data-cy="post-edit-title"
            />
          </div>

          {/* Content Editor - fills remaining space */}
          <div className="flex-1 min-h-0 px-6 pb-6" data-cy="post-edit-content">
            <WysiwygEditor
              value={post.content}
              onChange={(content) => updatePost({ content })}
              placeholder="Start writing your post..."
              className="h-full flex flex-col"
            />
          </div>
        </div>

        {/* Right Sidebar */}
        {showSidebar && (
          <div className="w-72 border-l border-border bg-background overflow-y-auto shrink-0" data-cy="post-edit-settings">
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
                        updatePost({ status: value })
                      }
                    >
                      <SelectTrigger data-cy="post-edit-status-select">
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
                      onChange={(e) => updatePost({ slug: e.target.value })}
                      placeholder="post-url-slug"
                      data-cy="post-edit-slug"
                    />
                  </div>

                  {/* Excerpt */}
                  <div className="space-y-2">
                    <Label>Excerpt</Label>
                    <Textarea
                      value={post.excerpt}
                      onChange={(e) => updatePost({ excerpt: e.target.value })}
                      placeholder="Brief description for previews..."
                      rows={3}
                      data-cy="post-edit-excerpt"
                    />
                  </div>

                  {/* Featured Image */}
                  <div className="space-y-2" data-cy="post-edit-featured-image">
                    <Label>Featured Image</Label>
                    <FeaturedImageUpload
                      value={post.featuredImage}
                      onChange={(url) => updatePost({ featuredImage: url })}
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
                      onCheckedChange={(checked: boolean) => updatePost({ featured: checked })}
                      data-cy="post-edit-featured-toggle"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Danger Zone */}
              <Card className="border-destructive/50">
                <CardHeader className="py-3">
                  <CardTitle className="text-sm text-destructive">Danger Zone</CardTitle>
                </CardHeader>
                <CardContent>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full text-destructive border-destructive/50 hover:bg-destructive/10"
                        disabled={deleting}
                        data-cy="post-edit-delete"
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        ) : (
                          <Trash2 className="h-4 w-4 mr-2" />
                        )}
                        Delete Post
                      </Button>
                    </DialogTrigger>
                    <DialogContent data-cy="post-edit-delete-dialog">
                      <DialogHeader>
                        <DialogTitle>Delete Post</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to delete &quot;{post.title}&quot;? This action cannot be undone.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline" data-cy="post-edit-delete-cancel">Cancel</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          onClick={handleDelete}
                          data-cy="post-edit-delete-confirm"
                        >
                          Delete
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </CardContent>
              </Card>

              {/* Meta Info */}
              <div className="text-xs text-muted-foreground space-y-1 pt-4">
                <p>Created: {new Date(post.createdAt).toLocaleDateString()}</p>
                <p>Updated: {new Date(post.updatedAt).toLocaleDateString()}</p>
                {post.publishedAt && (
                  <p>Published: {new Date(post.publishedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
